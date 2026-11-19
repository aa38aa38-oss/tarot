import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameCtx } from '../App'
import { CHAPTERS } from '../data/world'
import { cardById } from '../data/majorArcana'
import {
  GATE_X, MAP_H, MAP_W, MapObj, Tile, ZONES, ZONE_H, buildObjects, buildTiles, guardianPos, zoneEntry, zoneOfY, zoneTop,
} from '../data/overworld'
import { battleReady } from '../lib/progress'
import { sfx } from '../lib/sfx'

const TILE = 40
const STEP_MS = 150
const MONSTER_MS = 900

interface Wild { id: number; zone: number; idx: number; x: number; y: number }

// 不寫入存檔、只在這次遊玩期間記住的地圖狀態（換畫面回來還在）
const memory: { wilds: Wild[] | null; nextId: number } = { wilds: null, nextId: 1 }

interface Dialog {
  title: string
  emoji?: string
  image?: string
  text: string
  buttons: { label: string; primary?: boolean; onClick: () => void }[]
}

const DIRS: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
// 八方向（含斜走），找路用
const DIRS8: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
const KEY_DIR: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
}

export default function WorldScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, go } = ctx
  const objects = useMemo(buildObjects, [])
  const tiles = useMemo(() => buildTiles(objects), [objects])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [zoneBanner, setZoneBanner] = useState<string | null>(null)
  const [encounter, setEncounter] = useState(false)
  const [zoneIdx, setZoneIdx] = useState(0)

  const saveRef = useRef(save)
  saveRef.current = save

  const start = save.pos ?? zoneEntry(0)
  const st = useRef({
    x: start.x, y: start.y, rx: start.x, ry: start.y,
    fromX: start.x, fromY: start.y, t0: 0, moving: false,
    held: null as [number, number] | null, path: [] as [number, number][], keys: new Set<string>(),
    stepMs: STEP_MS,
    paused: false, lastMonster: 0, zone: zoneOfY(start.y),
  })

  // ---------- 規則 ----------
  const chapterOf = (zi: number) => CHAPTERS.find((c) => c.id === ZONES[zi].chapterId)!
  const cleared = (zi: number) => saveRef.current.clearedChapters.includes(ZONES[zi].chapterId)
  const gateOpen = (zi: number) => cleared(zi) || saveRef.current.skipTestPassed
  const guardianAt = (zi: number) => {
    if (cleared(zi)) return null
    const g = guardianPos(zi)
    // 通過跳級測驗的玩家：門已開，守門人退到一旁（仍可挑戰）
    return saveRef.current.skipTestPassed && zi < ZONES.length - 1 ? { x: g.x + 2, y: g.y } : g
  }

  if (!memory.wilds) {
    memory.wilds = []
    ZONES.forEach((z, zi) => {
      z.wild.forEach((_, idx) => {
        for (let k = 0; k < 2; k++) memory.wilds!.push(spawnWild(zi, idx))
      })
    })
  }
  function spawnWild(zi: number, idx: number): Wild {
    const top = zoneTop(zi)
    for (let tries = 0; tries < 200; tries++) {
      const x = 1 + Math.floor(Math.random() * (MAP_W - 2))
      const y = top + 2 + Math.floor(Math.random() * (ZONE_H - 5))
      if (tiles[y][x] === 'ground' || tiles[y][x] === 'path') return { id: memory.nextId++, zone: zi, idx, x, y }
    }
    return { id: memory.nextId++, zone: zi, idx, x: GATE_X, y: top + 6 }
  }

  const objAt = (x: number, y: number): MapObj | null => objects.find((o) => o.x === x && o.y === y) ?? null
  const guardianOn = (x: number, y: number) => {
    const zi = zoneOfY(y)
    const g = guardianAt(zi)
    return g && g.x === x && g.y === y ? zi : -1
  }
  const walkable = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false
    const t: Tile = tiles[y][x]
    if (t === 'block' || t === 'water' || t === 'wall') return false
    if (t === 'gate') return gateOpen(zoneOfY(y + 1))
    if (objAt(x, y)) return false
    if (guardianOn(x, y) >= 0) return false
    return true
  }

  const persistPos = () => {
    const { x, y } = st.current
    setSave((s) => ({ ...s, pos: { x, y } }))
  }

  // ---------- 互動 ----------
  const close = () => { setDialog(null); st.current.paused = false }

  const startBattle = (mode: Parameters<GameCtx['go']>[0]) => {
    st.current.paused = true
    sfx.charge()
    setEncounter(true)
    persistPos()
    setTimeout(() => go(mode), 750)
  }

  const interact = (x: number, y: number) => {
    const s = saveRef.current
    const gz = guardianOn(x, y)
    if (gz >= 0) {
      const ch = chapterOf(gz)
      const ready = battleReady(s, ch)
      st.current.paused = true
      sfx.select()
      setDialog(ready ? {
        title: ch.monster.name, emoji: ch.monster.emoji, text: ch.monster.intro,
        buttons: [
          { label: '還沒準備好', onClick: close },
          { label: '⚔️ 戰鬥！', primary: true, onClick: () => { setDialog(null); startBattle({ name: 'battle', mode: { kind: 'chapter', chapterId: ch.id, from: 'world' } }) } },
        ],
      } : {
        title: ch.monster.name, emoji: ch.monster.emoji,
        text: ch.id === 'c0'
          ? '「想出村子？先去左上方的🏫塔羅學院上完入門課再來吧！」'
          : `「這一區有 ${ch.cardIds.length} 位牌靈，你才拜訪了 ${ch.cardIds.filter((c) => s.collected.includes(c)).length} 位。全部學會之後再來挑戰我！」`,
        buttons: [{ label: '知道了', primary: true, onClick: close }],
      })
      return
    }
    const o = objAt(x, y)
    if (!o) return
    st.current.paused = true
    sfx.select()
    if (o.kind === 'card' && o.cardId) {
      const card = cardById(o.cardId)
      const got = s.collected.includes(o.cardId)
      setDialog({
        title: `${card.roman}・${card.nameZh}的牌靈`, image: card.image,
        text: got ? `「又見面了。${card.mnemonic}」` : `「旅人啊，我是${card.nameZh}。${card.journey}」`,
        buttons: [
          { label: '離開', onClick: close },
          { label: got ? '📖 複習' : '📖 向牌靈學習', primary: true, onClick: () => { persistPos(); go({ name: 'lesson', cardId: card.id, from: 'world' }) } },
        ],
      })
      return
    }
    const nav = (label: string, onClick: () => void, text: string) =>
      setDialog({ title: o.label, emoji: o.emoji, text, buttons: [{ label: '離開', onClick: close }, { label, primary: true, onClick: () => { persistPos(); onClick() } }] })
    switch (o.action) {
      case 'basics': return nav('📖 上入門課', () => go({ name: 'basics' }), '學院的老師說：「塔羅一共有 78 張牌，先從地圖開始認識吧。」')
      case 'commission': return nav('📜 看委託', () => go({ name: 'commission' }), '村民們會在這裡留下煩惱，等待占卜師幫忙解讀。')
      case 'daily': return nav('🌅 每日一抽', () => go({ name: 'daily' }), '祭壇上的星光閃爍著。每天來這裡抽一張牌吧。')
      case 'training':
        return s.collected.length < 4
          ? setDialog({ title: o.label, emoji: o.emoji, text: '教練：「至少收服 4 張牌再來訓練吧！」', buttons: [{ label: '好', primary: true, onClick: close }] })
          : nav('🎯 開始訓練', () => go({ name: 'battle', mode: { kind: 'training', from: 'world' } }), '教練：「稻草人會專挑你最不熟的牌！」')
      case 'elder':
        return setDialog({ title: '村長', emoji: '👴', text: elderTip(s), buttons: [{ label: '謝謝村長', primary: true, onClick: close }] })
      case 'portal':
        return setDialog({ title: '通往逆影之森', emoji: '🌀', text: '漩渦的另一端，是學習「逆位」的逆影之森……（建設中，敬請期待）', buttons: [{ label: '好期待', primary: true, onClick: close }] })
    }
  }

  // ---------- 移動 ----------
  // 斜走時，兩側至少要有一邊是通的（避免穿過牆角）
  const diagOk = (x: number, y: number, dx: number, dy: number) => walkable(x + dx, y) || walkable(x, y + dy)

  const tryStep = (dx: number, dy: number, quiet = false): boolean => {
    const S = st.current
    const nx = S.x + dx, ny = S.y + dy
    const diag = dx !== 0 && dy !== 0
    const w = memory.wilds!.find((m) => m.x === nx && m.y === ny)
    if (w) return meetWild(w)
    if (!walkable(nx, ny) || (diag && !diagOk(S.x, S.y, dx, dy))) {
      if (!quiet && (objAt(nx, ny) || guardianOn(nx, ny) >= 0)) { interact(nx, ny); return false }
      if (!quiet && !diag && tiles[ny]?.[nx] === 'gate') { interact(GATE_X, ny + 1); return false }
      // 斜走被擋住：改成沿著能走的方向滑過去
      if (diag) return tryStep(dx, 0, true) || tryStep(0, dy, true)
      return false
    }
    S.fromX = S.x; S.fromY = S.y; S.x = nx; S.y = ny; S.t0 = performance.now(); S.moving = true
    S.stepMs = diag ? STEP_MS * 1.4 : STEP_MS // 斜走距離較長，速度保持一致
    return true
  }

  const meetWild = (w: Wild) => {
    memory.wilds = memory.wilds!.filter((m) => m.id !== w.id)
    // 一段時間後在同一區重生
    setTimeout(() => memory.wilds!.push(spawnWild(w.zone, w.idx)), 45000)
    startBattle({ name: 'battle', mode: { kind: 'wild', zone: w.zone, idx: w.idx, from: 'world' } })
    return false
  }

  // 點擊地圖 → 找路走過去（BFS）
  const pathTo = (tx: number, ty: number) => {
    const S = st.current
    const target = objAt(tx, ty) || guardianOn(tx, ty) >= 0 || memory.wilds!.some((m) => m.x === tx && m.y === ty)
    const key = (x: number, y: number) => y * MAP_W + x
    const prev = new Map<number, number>()
    const q: [number, number][] = [[S.x, S.y]]
    prev.set(key(S.x, S.y), -1)
    let found: [number, number] | null = null
    while (q.length) {
      const [x, y] = q.shift()!
      if (x === tx && y === ty) { found = [x, y]; break }
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy
        if (prev.has(key(nx, ny))) continue
        const isTarget = nx === tx && ny === ty
        if (!(isTarget && target) && !walkable(nx, ny)) continue
        if (dx && dy && !diagOk(x, y, dx, dy)) continue
        prev.set(key(nx, ny), key(x, y))
        q.push([nx, ny])
      }
      if (prev.size > 4000) break
    }
    if (!found) return
    const path: [number, number][] = []
    let k = key(found[0], found[1])
    while (prev.get(k) !== -1) { path.unshift([k % MAP_W, Math.floor(k / MAP_W)]); k = prev.get(k)! }
    S.path = path
  }

  // ---------- 主迴圈 ----------
  useEffect(() => {
    const canvas = canvasRef.current!
    const g = canvas.getContext('2d')!
    const cardImgs = new Map<string, HTMLImageElement>()
    objects.filter((o) => o.cardId).forEach((o) => {
      const im = new Image()
      im.src = cardById(o.cardId!).image
      cardImgs.set(o.cardId!, im)
    })
    let raf = 0
    let w = 0, h = 0
    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      w = r.width; h = r.height
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrapRef.current!)

    const onKey = (e: KeyboardEvent) => {
      const d = KEY_DIR[e.key]
      if (!d) return
      e.preventDefault()
      // 同時按兩個方向鍵＝斜走
      const S = st.current
      if (e.type === 'keydown') { S.keys.add(d); S.path = [] } else S.keys.delete(d)
      let vx = 0, vy = 0
      S.keys.forEach((k) => { vx += DIRS[k][0]; vy += DIRS[k][1] })
      S.held = vx || vy ? [Math.sign(vx), Math.sign(vy)] : null
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)

    let lastSave = performance.now()
    const loop = (now: number) => {
      const S = st.current
      // 移動插值
      if (S.moving) {
        const p = Math.min(1, (now - S.t0) / S.stepMs)
        S.rx = S.fromX + (S.x - S.fromX) * p
        S.ry = S.fromY + (S.y - S.fromY) * p
        if (p >= 1) {
          S.moving = false
          const z = zoneOfY(S.y)
          if (z !== S.zone) {
            S.zone = z
            setZoneIdx(z)
            setZoneBanner(ZONES[z].name)
            setTimeout(() => setZoneBanner(null), 1800)
          }
        }
      }
      if (!S.moving && !S.paused) {
        if (S.path.length) {
          const [nx, ny] = S.path.shift()!
          if (!tryStep(nx - S.x, ny - S.y)) S.path = []
        } else if (S.held) {
          tryStep(S.held[0], S.held[1])
        }
      }
      // 野生怪物遊走
      if (!S.paused && now - S.lastMonster > MONSTER_MS) {
        S.lastMonster = now
        for (const m of memory.wilds!) {
          if (m.zone !== S.zone || Math.random() < 0.4) continue
          const [dx, dy] = Object.values(DIRS)[Math.floor(Math.random() * 4)]
          const nx = m.x + dx, ny = m.y + dy
          if (nx === S.x && ny === S.y) { meetWild(m); break }
          if (zoneOfY(ny) !== m.zone || ny <= zoneTop(m.zone) + 1) continue
          if (walkable(nx, ny) && tiles[ny][nx] !== 'gate' && !memory.wilds!.some((o) => o.x === nx && o.y === ny)) { m.x = nx; m.y = ny }
        }
      }
      if (now - lastSave > 4000) { lastSave = now; if (saveRef.current.pos?.x !== S.x || saveRef.current.pos?.y !== S.y) persistPos() }

      draw(g, w, h, now, cardImgs)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    setZoneIdx(st.current.zone)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      const { x, y } = st.current
      setSave((s) => ({ ...s, pos: { x, y } }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 繪圖 ----------
  const draw = (g: CanvasRenderingContext2D, w: number, h: number, now: number, cardImgs: Map<string, HTMLImageElement>) => {
    const S = st.current
    const camX = Math.max(0, Math.min(MAP_W * TILE - w, S.rx * TILE + TILE / 2 - w / 2))
    const camY = Math.max(0, Math.min(MAP_H * TILE - h, S.ry * TILE + TILE / 2 - h / 2))
    const offX = MAP_W * TILE < w ? (w - MAP_W * TILE) / 2 : -camX
    g.fillStyle = '#0d0a1c'
    g.fillRect(0, 0, w, h)
    g.save()
    g.translate(offX, -camY)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((camY + h) / TILE))

    for (let y = y0; y <= y1; y++) {
      const z = ZONES[zoneOfY(y === MAP_H - 1 ? y - 1 : y)]
      for (let x = 0; x < MAP_W; x++) {
        const t = tiles[y][x]
        const px = x * TILE, py = y * TILE
        g.fillStyle = z.ground[(x + y) % 2]
        g.fillRect(px, py, TILE, TILE)
        if (t === 'path') { g.fillStyle = z.path; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4) }
        else if (t === 'water') {
          g.fillStyle = '#2f6fb0'; g.fillRect(px, py, TILE, TILE)
          g.fillStyle = '#ffffff33'; g.fillRect(px + 6 + Math.sin(now / 500 + x) * 4, py + 14, 14, 2)
        } else if (t === 'block') {
          g.font = '28px serif'; g.fillText(z.blocker, px + TILE / 2, py + TILE / 2 + 2)
        } else if (t === 'wall') {
          const wz = ZONES[zoneOfY(y + 1 >= MAP_H ? y : y + 1)]
          g.fillStyle = wz.wall; g.fillRect(px, py, TILE, TILE)
          g.fillStyle = '#00000033'; g.fillRect(px, py + TILE - 8, TILE, 8)
          g.fillStyle = '#ffffff14'; g.fillRect(px + 2, py + 4, TILE / 2 - 4, 10); g.fillRect(px + TILE / 2 + 2, py + 18, TILE / 2 - 4, 10)
        } else if (t === 'gate') {
          const zBelow = zoneOfY(y + 1)
          g.fillStyle = gateOpen(zBelow) ? ZONES[zBelow].path : '#2a1f14'
          g.fillRect(px, py, TILE, TILE)
          if (!gateOpen(zBelow)) { g.font = '26px serif'; g.fillText('🚧', px + TILE / 2, py + TILE / 2) }
          else { g.strokeStyle = '#f2c464'; g.lineWidth = 3; g.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4) }
        }
      }
    }

    // 物件
    for (const o of objects) {
      if (o.y < y0 - 1 || o.y > y1 + 1) continue
      const cx = o.x * TILE + TILE / 2, cy = o.y * TILE + TILE / 2
      if (o.kind === 'card' && o.cardId) {
        const got = saveRef.current.collected.includes(o.cardId)
        const img = cardImgs.get(o.cardId)!
        const bob = got ? 0 : Math.sin(now / 400 + o.x) * 3
        if (!got) {
          const glow = g.createRadialGradient(cx, cy, 2, cx, cy, 30)
          glow.addColorStop(0, '#fff6c8cc'); glow.addColorStop(1, '#fff6c800')
          g.fillStyle = glow; g.fillRect(cx - 30, cy - 30, 60, 60)
        }
        g.globalAlpha = got ? 0.55 : 1
        if (img.complete) g.drawImage(img, cx - 13, cy - 23 + bob, 26, 46)
        g.globalAlpha = 1
        if (got) { g.font = '14px sans-serif'; g.fillText('✅', cx + 12, cy - 18) }
      } else {
        g.font = o.kind === 'building' ? '34px serif' : '28px serif'
        g.fillText(o.emoji!, cx, cy + 2)
        if (o.kind === 'building') label(g, o.label, cx, cy + 24)
      }
    }
    // 守門人
    ZONES.forEach((z, zi) => {
      const gp = guardianAt(zi)
      if (!gp || gp.y < y0 - 1 || gp.y > y1 + 1) return
      const ch = chapterOf(zi)
      const cx = gp.x * TILE + TILE / 2, cy = gp.y * TILE + TILE / 2
      const pulse = 0.5 + Math.sin(now / 300) * 0.5
      g.strokeStyle = `rgba(255,70,100,${0.4 + pulse * 0.5})`; g.lineWidth = 3
      g.beginPath(); g.arc(cx, cy, 18 + pulse * 3, 0, Math.PI * 2); g.stroke()
      g.font = ch.monster.boss ? '40px serif' : '32px serif'
      g.fillText(ch.monster.emoji, cx, cy + 2)
      label(g, z.chapterId === 'boss' ? '最終試煉' : '守門人', cx, cy - 26)
    })
    // 野生怪物
    for (const m of memory.wilds!) {
      if (m.y < y0 - 1 || m.y > y1 + 1) continue
      const cx = m.x * TILE + TILE / 2, cy = m.y * TILE + TILE / 2 + Math.sin(now / 250 + m.id) * 2
      g.font = '26px serif'
      g.fillText(ZONES[m.zone].wild[m.idx].emoji, cx, cy)
    }
    // 玩家
    const bob = S.moving ? Math.abs(Math.sin(now / 60)) * -4 : Math.sin(now / 500) * 1.5
    const pcx = S.rx * TILE + TILE / 2, pcy = S.ry * TILE + TILE / 2
    g.fillStyle = '#0006'; g.beginPath(); g.ellipse(pcx, pcy + 14, 12, 5, 0, 0, Math.PI * 2); g.fill()
    g.font = '30px serif'
    g.fillText(saveRef.current.avatar, pcx, pcy + bob)
    // 路徑目標
    if (S.path.length) {
      const [tx, ty] = S.path[S.path.length - 1]
      g.strokeStyle = '#f2c464aa'; g.lineWidth = 2
      g.strokeRect(tx * TILE + 6, ty * TILE + 6, TILE - 12, TILE - 12)
    }
    g.restore()
  }

  const onCanvasClick = (e: { clientX: number; clientY: number }) => {
    if (st.current.paused) return
    const r = canvasRef.current!.getBoundingClientRect()
    const S = st.current
    const w = r.width, h = r.height
    const camX = Math.max(0, Math.min(MAP_W * TILE - w, S.rx * TILE + TILE / 2 - w / 2))
    const camY = Math.max(0, Math.min(MAP_H * TILE - h, S.ry * TILE + TILE / 2 - h / 2))
    const offX = MAP_W * TILE < w ? (w - MAP_W * TILE) / 2 : -camX
    const tx = Math.floor((e.clientX - r.left - offX) / TILE)
    const ty = Math.floor((e.clientY - r.top + camY) / TILE)
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return
    pathTo(tx, ty)
  }

  // ---------- 左半邊虛擬搖桿：按住拖曳＝持續移動；輕點＝走到那一格 ----------
  const [stick, setStick] = useState<{ ox: number; oy: number; kx: number; ky: number } | null>(null)
  const stickStart = useRef({ t: 0, x: 0, y: 0, moved: false })
  const STICK_R = 46
  const stickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    const ox = e.clientX - r.left, oy = e.clientY - r.top
    stickStart.current = { t: performance.now(), x: e.clientX, y: e.clientY, moved: false }
    st.current.path = []
    setStick({ ox, oy, kx: 0, ky: 0 })
  }
  const stickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stick) return
    const dx = e.clientX - stickStart.current.x, dy = e.clientY - stickStart.current.y
    const dist = Math.hypot(dx, dy)
    const k = dist > STICK_R ? STICK_R / dist : 1
    setStick({ ...stick, kx: dx * k, ky: dy * k })
    if (dist < 14) { st.current.held = null; return }
    stickStart.current.moved = true
    // 依角度分成 8 個方向（每 45° 一格）
    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
    const ang = sector * (Math.PI / 4)
    st.current.held = [Math.round(Math.cos(ang)), Math.round(Math.sin(ang))]
  }
  const stickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    st.current.held = null
    const s = stickStart.current
    if (!s.moved && performance.now() - s.t < 300) onCanvasClick(e)
    setStick(null)
  }

  const zone = ZONES[zoneIdx]
  const goal = zoneGoal(save, zoneIdx)

  return (
    <div className="world">
      <div className="world-hud">
        <div className="zone-chip">📍 {zone.name}</div>
        <div className="goal small">{goal}</div>
        <button className="btn ghost small hud-btn" onClick={() => { persistPos(); go({ name: 'journey' }) }}>📋 章節</button>
      </div>
      <div className="world-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} onClick={onCanvasClick} onContextMenu={(e) => e.preventDefault()} />
        <div
          className="stick-zone"
          onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp}
          onPointerCancel={() => { st.current.held = null; setStick(null) }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {stick ? (
            <div className="stick-base" style={{ left: stick.ox, top: stick.oy }}>
              <div className="stick-knob" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
            </div>
          ) : (
            <div className="stick-hint">
              <div className="stick-base idle"><div className="stick-knob" /></div>
              <span>左半邊按住拖曳移動（可斜走）</span>
            </div>
          )}
        </div>
        {zoneBanner && <div className="zone-banner">{zoneBanner}</div>}
        {encounter && <div className="encounter-fx" />}
      </div>

      {dialog && (
        <div className="dialog-wrap">
          <div className="win dialog">
            <div className="dialog-head">
              {dialog.image ? <img src={dialog.image} alt="" className="dialog-card" /> : <span className="dialog-emoji">{dialog.emoji}</span>}
              <div>
                <strong className="dialog-title">{dialog.title}</strong>
                <p>{dialog.text}</p>
              </div>
            </div>
            <div className="row">
              {dialog.buttons.map((b) => (
                <button key={b.label} className={b.primary ? 'btn primary grow' : 'btn ghost'} onClick={b.onClick}>{b.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number) {
  g.font = 'bold 11px "Noto Sans TC", sans-serif'
  const w = g.measureText(text).width + 10
  g.fillStyle = '#0d0a1ccc'
  g.fillRect(x - w / 2, y - 8, w, 16)
  g.fillStyle = '#f2ecff'
  g.fillText(text, x, y)
}

function zoneGoal(save: GameCtx['save'], zi: number): string {
  const z = ZONES[zi]
  if (save.clearedChapters.includes(z.chapterId)) return zi === ZONES.length - 1 ? '🏆 愚者之旅完成！' : '✅ 本區已通關，往北前進'
  if (zi === 0) return save.basicsDone ? '🎯 去北邊挑戰守門的小精靈' : '🎯 先到 🏫塔羅學院 上入門課'
  if (z.cardIds.length === 0) return '🎯 挑戰最終試煉'
  const n = z.cardIds.filter((c) => save.collected.includes(c)).length
  return n < z.cardIds.length ? `🎯 拜訪牌靈 ${n}/${z.cardIds.length}` : '🎯 挑戰北邊的守門人'
}

function elderTip(save: GameCtx['save']) {
  if (!save.basicsDone) return '「年輕的愚者啊，先去左上方的塔羅學院上課吧。學完再去北邊，小精靈會考你。」'
  if (!save.clearedChapters.includes('c0')) return '「準備好了就往北走，回答小精靈的問題，牠就會讓路。」'
  return '「路上會遇到在地上發光的牌，那是牌靈。拜訪它們、學會它們的意義，守門人就會放你通過。草叢裡的野生怪物，可以拿來練習喔！」'
}
