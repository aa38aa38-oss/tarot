// 大地圖：由下往上的「愚者之旅」，每一區對應一個章節
import { Monster } from './world'

export const ZONE_W = 21
export const ZONE_H = 13
export const GATE_X = 10

export type Tile = 'ground' | 'path' | 'block' | 'water' | 'wall' | 'gate'

export interface ZoneDef {
  id: string
  name: string
  chapterId: string
  cardIds: string[]
  ground: [string, string] // 兩種地面色（交錯）
  path: string
  wall: string
  blocker: string // 障礙物 emoji
  water?: boolean
  wild: Monster[]
}

const wild = (name: string, emoji: string, hp: number, attack: number, skill: string): Monster => ({
  name, emoji, hp, attack, skill, intro: `野生的${name}跳了出來！`,
})

// index 0 = 最下方的起點之村
export const ZONES: ZoneDef[] = [
  { id: 'village', name: '起點之村', chapterId: 'c0', cardIds: [], ground: ['#6aa857', '#64a052'], path: '#d9c08a', wall: '#3e6b34', blocker: '🌳', wild: [] },
  { id: 'cliff', name: '懸崖之路', chapterId: 'c1', cardIds: ['m00', 'm01', 'm02', 'm03'], ground: ['#a8b36b', '#9fab63'], path: '#d8c59a', wall: '#7a6a4a', blocker: '🪨',
    wild: [wild('懸崖蝙蝠', '🦇', 50, 8, '超音波'), wild('迷途小鳥', '🐦', 40, 7, '啄擊')] },
  { id: 'castle', name: '石之王城', chapterId: 'c2', cardIds: ['m04', 'm05', 'm06', 'm07'], ground: ['#8d8a96', '#86838f'], path: '#b9b2a2', wall: '#4a4656', blocker: '🗿',
    wild: [wild('巡邏衛兵', '💂', 60, 10, '長槍突刺'), wild('石像鬼', '🦅', 60, 10, '俯衝')] },
  { id: 'savanna', name: '獅子荒原', chapterId: 'c3', cardIds: ['m08', 'm09', 'm10', 'm11'], ground: ['#d6b264', '#cfaa5c'], path: '#e8d3a0', wall: '#8a6a30', blocker: '🌵',
    wild: [wild('荒原胡狼', '🐕', 70, 12, '撕咬'), wild('毒蠍', '🦂', 60, 13, '毒針')] },
  { id: 'cave', name: '幽暗洞窟', chapterId: 'c4', cardIds: ['m12', 'm13', 'm14', 'm15'], ground: ['#4a3c48', '#453842'], path: '#6b5a62', wall: '#241a22', blocker: '🪨',
    wild: [wild('洞窟蜘蛛', '🕷️', 70, 13, '纏絲'), wild('骷髏兵', '💀', 80, 14, '骨刃')] },
  { id: 'lake', name: '星夜湖畔', chapterId: 'c5', cardIds: ['m16', 'm17', 'm18'], ground: ['#2d4a6b', '#2a4565'], path: '#4f6d8f', wall: '#13223a', blocker: '🌲', water: true,
    wild: [wild('夜行貓頭鷹', '🦉', 80, 14, '月影爪'), wild('湖中水母', '🪼', 70, 15, '電擊觸手')] },
  { id: 'temple', name: '黃金聖殿', chapterId: 'c6', cardIds: ['m19', 'm20', 'm21'], ground: ['#e3c56a', '#dcbd62'], path: '#f5e6b0', wall: '#9a7a2a', blocker: '🏛️',
    wild: [wild('聖殿守衛', '🛡️', 90, 15, '盾擊'), wild('光之精靈', '✨', 80, 16, '炫光')] },
  { id: 'world', name: '世界之環', chapterId: 'boss', cardIds: [], ground: ['#3a2a6b', '#352663'], path: '#6a58a8', wall: '#150c33', blocker: '🌌', wild: [] },
]

export const MAP_W = ZONE_W
export const MAP_H = ZONES.length * ZONE_H + 1 // 最下方多一排牆

// 每區的上緣列（牆與門所在列）
export const zoneTop = (z: number) => (ZONES.length - 1 - z) * ZONE_H
export const zoneOfY = (y: number) => Math.min(ZONES.length - 1, Math.max(0, ZONES.length - 1 - Math.floor(y / ZONE_H)))
export const zoneEntry = (z: number) => ({ x: GATE_X, y: zoneTop(z) + ZONE_H - 1 })

// ---------- 地圖上的物件 ----------
export type ObjKind = 'building' | 'npc' | 'card' | 'guardian' | 'portal'
export interface MapObj {
  id: string
  kind: ObjKind
  x: number
  y: number
  zone: number
  emoji?: string
  label: string
  cardId?: string
  action?: 'basics' | 'commission' | 'daily' | 'training' | 'elder' | 'portal'
}

const CARD_SPOTS: Record<number, [number, number][]> = {
  4: [[4, 10], [16, 9], [5, 5], [15, 4]],
  3: [[4, 9], [16, 7], [6, 4]],
}

export function buildObjects(): MapObj[] {
  const objs: MapObj[] = []
  ZONES.forEach((z, zi) => {
    const top = zoneTop(zi)
    if (zi === 0) {
      objs.push(
        { id: 'academy', kind: 'building', x: 4, y: top + 4, zone: 0, emoji: '🏫', label: '塔羅學院', action: 'basics' },
        { id: 'fortune', kind: 'building', x: 16, y: top + 4, zone: 0, emoji: '🔮', label: '占卜小屋', action: 'commission' },
        { id: 'altar', kind: 'building', x: 4, y: top + 9, zone: 0, emoji: '⛩️', label: '星之祭壇', action: 'daily' },
        { id: 'dojo', kind: 'building', x: 16, y: top + 9, zone: 0, emoji: '🎯', label: '訓練場', action: 'training' },
        { id: 'elder', kind: 'npc', x: 8, y: top + 7, zone: 0, emoji: '👴', label: '村長', action: 'elder' },
      )
    }
    const spots = CARD_SPOTS[z.cardIds.length]
    z.cardIds.forEach((cid, i) => {
      objs.push({ id: `card-${cid}`, kind: 'card', x: spots[i][0], y: top + spots[i][1], zone: zi, label: '牌靈', cardId: cid })
    })
    if (zi === ZONES.length - 1) {
      objs.push({ id: 'portal', kind: 'portal', x: GATE_X, y: top + 2, zone: zi, emoji: '🌀', label: '通往逆影之森', action: 'portal' })
    }
  })
  return objs
}

// 守門人位置（打倒前站在門前）
export const guardianPos = (zi: number) =>
  zi === ZONES.length - 1 ? { x: GATE_X, y: zoneTop(zi) + 5 } : { x: GATE_X, y: zoneTop(zi) + 1 }

// ---------- 產生地形（固定亂數種子，每次都一樣） ----------
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function buildTiles(objs: MapObj[]): Tile[][] {
  const tiles: Tile[][] = Array.from({ length: MAP_H }, () => Array<Tile>(MAP_W).fill('ground'))
  for (let x = 0; x < MAP_W; x++) tiles[MAP_H - 1][x] = 'wall'

  ZONES.forEach((z, zi) => {
    const top = zoneTop(zi)
    // 上緣牆＋門
    for (let x = 0; x < MAP_W; x++) tiles[top][x] = 'wall'
    if (zi < ZONES.length - 1) tiles[top][GATE_X] = 'gate'
    // 左右邊界
    for (let y = top + 1; y < top + ZONE_H; y++) {
      tiles[y][0] = 'block'
      tiles[y][MAP_W - 1] = 'block'
    }

    // 保留區：物件與其周圍、路徑
    const reserved = new Set<string>()
    const keep = (x: number, y: number) => reserved.add(`${x},${y}`)
    const important = objs.filter((o) => o.zone === zi).map((o) => [o.x, o.y] as [number, number])
    const g = guardianPos(zi)
    important.push([g.x, g.y])
    for (const [ox, oy] of important) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keep(ox + dx, oy + dy)
    for (let x = 1; x < MAP_W - 1; x++) { keep(x, top + 1); keep(x, top + ZONE_H - 1) }

    // 蜿蜒的小路：從入口走到門，順路經過各個牌靈
    const waypoints: [number, number][] = [[GATE_X, top + ZONE_H - 1], ...important.slice().sort((a, b) => b[1] - a[1]), [GATE_X, top + 1]]
    for (let i = 0; i < waypoints.length - 1; i++) {
      let [x, y] = waypoints[i]
      const [tx, ty] = waypoints[i + 1]
      while (x !== tx || y !== ty) {
        // 先走直的、再走橫的，形成整齊的 L 形道路
        if (y !== ty) y += Math.sign(ty - y)
        else x += Math.sign(tx - x)
        if (tiles[y][x] === 'ground') tiles[y][x] = 'path'
        keep(x, y)
      }
    }

    // 隨機障礙＋水池
    const r = rng(1000 + zi * 77)
    for (let y = top + 2; y < top + ZONE_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (reserved.has(`${x},${y}`)) continue
        const v = r()
        if (z.water && v < 0.12) tiles[y][x] = 'water'
        else if (v < (zi === 0 ? 0.1 : 0.16)) tiles[y][x] = 'block'
      }
    }
  })
  return tiles
}
