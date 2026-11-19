import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameCtx } from '../App'
import { CHAPTERS, Monster, StageTheme } from '../data/world'
import { ZONES, zoneEntry } from '../data/overworld'
import { MAJOR_ARCANA, TarotCard, cardById } from '../data/majorArcana'
import { HARD_TYPES, SCENARIO_TYPES, Question, makeBasicsQuestion, makeCardQuestion, poolFromIds } from '../lib/questions'
import { ZONE_LEVEL, deriveStats, hasSkill, suppressedXp } from '../lib/powers'
import { XP, levelInfo, maxHp, recordAnswer } from '../lib/game'
import { isMuted, setMuted, sfx } from '../lib/sfx'
import QuestionCard from '../components/QuestionCard'

export type BattleMode =
  | { kind: 'chapter'; chapterId: string; from?: 'world' | 'debug' }
  | { kind: 'training'; from?: 'world' | 'debug' }
  | { kind: 'wild'; zone: number; idx: number; from: 'world' | 'debug' }
  | { kind: 'skip' }

const ZONE_STAGE: StageTheme[] = ['dawn', 'cliff', 'hall', 'savanna', 'cave', 'night', 'golden', 'cosmos']

type Action = 'attack' | 'arcana' | 'pray' | 'dance'
type Phase = 'intro' | 'command' | 'question' | 'feedback' | 'anim' | 'result'
type Fx = 'slash' | 'summon' | 'burst' | 'heal' | 'claw' | 'miss' | null
interface Popup { id: number; target: 'enemy' | 'hero'; text: string; kind: 'dmg' | 'crit' | 'heal' | 'miss' | 'hurt' }

const ATK_DMG = 20
const ARCANA_DMG = 40
const COMBO_BONUS = 10
const PRAY_HEAL = 30
const MP_MAX = 30
const ARCANA_COST = 10
const MP_REGEN = 5
const DANCE_COST = 20
const DANCE_DMG = 80
const EYE_COST = 5

interface Setup { monster: Monster; pool: TarotCard[]; basics: boolean; title: string; stage: StageTheme }

function setupFor(mode: BattleMode, collected: string[]): Setup {
  if (mode.kind === 'wild') {
    // 野生怪物：從目前為止學過的牌出題；學過的牌太少就考基礎知識
    const allowed = ZONES.slice(0, mode.zone + 1).flatMap((z) => z.cardIds).filter((id) => collected.includes(id))
    return {
      title: ZONES[mode.zone].name, stage: ZONE_STAGE[mode.zone], monster: ZONES[mode.zone].wild[mode.idx],
      basics: allowed.length < 3, pool: poolFromIds(allowed.length >= 3 ? allowed : collected.length ? collected : ['m00']),
    }
  }
  if (mode.kind !== 'chapter') {
    return {
      title: '訓練場', stage: 'field', basics: false, pool: poolFromIds(collected),
      monster: { name: '訓練用稻草人', emoji: '🎯', hp: 100, attack: 10, intro: '稻草人會優先考你最不熟的牌。', skill: '稻草亂舞' },
    }
  }
  const ch = CHAPTERS.find((c) => c.id === mode.chapterId)!
  return {
    title: ch.title, stage: ch.stage, monster: ch.monster, basics: ch.quizPool === 'basics',
    pool: ch.quizPool === 'all-major' ? MAJOR_ARCANA : poolFromIds(ch.cardIds),
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function BattleScreen({ ctx, mode }: { ctx: GameCtx; mode: BattleMode }) {
  const { save, setSave, gainXp, go, toast } = ctx
  const setup = useMemo(() => setupFor(mode, save.collected), []) // eslint-disable-line react-hooks/exhaustive-deps
  const { monster } = setup
  const level = levelInfo(save.xp).level
  // 守護牌與技能帶來的能力（開戰時計算一次）
  const P = useMemo(() => deriveStats(save), []) // eslint-disable-line react-hooks/exhaustive-deps
  const sk = (id: string) => hasSkill(save, id)
  const allMul = 1 + P.allPct / 100
  const heroMax = Math.round(maxHp(level) * (1 + P.hpPct / 100) * allMul)
  const mpMax = Math.round((MP_MAX + P.mpBonus) * allMul)
  const arcanaCost = Math.max(2, ARCANA_COST - P.arcanaDiscount)
  const comboAt = sk('chain') ? 2 : 3
  const comboBonus = sk('chain') ? 15 : COMBO_BONUS
  const atkMul = (1 + (P.atkPct + P.devilPct) / 100) * allMul
  const usedBasics = useRef(new Set<number>())
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const [phase, setPhase] = useState<Phase>('intro')
  const [turn, setTurn] = useState(1)
  const [hp, setHp] = useState(heroMax)
  const [mp, setMp] = useState(mpMax)
  const [enemyHp, setEnemyHp] = useState(monster.hp)
  const [combo, setCombo] = useState(0)
  const [action, setAction] = useState<Action>('attack')
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [log, setLog] = useState(monster.intro)
  const [heroAnim, setHeroAnim] = useState('')
  const [enemyAnim, setEnemyAnim] = useState('')
  const [stageShake, setStageShake] = useState(false)
  const [fx, setFx] = useState<Fx>(null)
  const [summonImg, setSummonImg] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [charging, setCharging] = useState(false)
  const [popups, setPopups] = useState<Popup[]>([])
  const [result, setResult] = useState<{ win: boolean; text: string } | null>(null)
  const [stats, setStats] = useState({ right: 0, total: 0 })
  const [mute, setMute] = useState(isMuted())
  const [hidden, setHidden] = useState<number[]>([]) // 被提示刪掉的選項
  const [hintsLeft, setHintsLeft] = useState(P.hints)
  const [redrawUsed, setRedrawUsed] = useState(false)
  const revived = useRef(false)

  const pop = (target: Popup['target'], text: string, kind: Popup['kind']) => {
    const id = Date.now() + Math.random()
    setPopups((p) => [...p, { id, target, text, kind }])
    setTimeout(() => alive.current && setPopups((p) => p.filter((x) => x.id !== id)), 1300)
  }

  const newQuestion = (act: Action): Question =>
    setup.basics
      ? makeBasicsQuestion(usedBasics.current)
      : makeCardQuestion(save, setup.pool, q?.cardId, {
          types: act === 'arcana' ? HARD_TYPES : act === 'dance' ? SCENARIO_TYPES : undefined,
          similar: level >= 6, // 等級越高，錯誤選項越容易混淆
        })

  const choose = (act: Action) => {
    sfx.select()
    const cost = act === 'arcana' ? arcanaCost : act === 'dance' ? DANCE_COST : 0
    if (mp < cost) {
      setLog(`MP 不足！需要 ${cost} MP。`)
      return
    }
    setHidden([])
    setAction(act)
    setQ(newQuestion(act))
    setPicked(null)
    setPhase('question')
    setLog(act === 'attack' ? '答對問題即可發動攻擊！' : act === 'arcana' ? '秘術：答對進階題，召喚塔羅牌的力量！' : act === 'dance' ? '世界之舞：答對情境題，釋放終極一擊！' : '祈禱：答對問題即可恢復生命值。')
  }

  // 提示：刪掉一個錯誤選項（隱士守護牌免費／直覺之眼花 MP）
  const eliminate = (by: 'hint' | 'eye') => {
    if (!q || picked !== null) return
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer && !hidden.includes(i))
    if (wrong.length <= 1) return
    sfx.select()
    setHidden([...hidden, wrong[Math.floor(Math.random() * wrong.length)]])
    if (by === 'hint') setHintsLeft((h) => h - 1)
    else setMp((m) => m - EYE_COST)
  }

  const retry = () => {
    sfx.select()
    setRedrawUsed(true)
    if (picked !== null) setHidden([...hidden, picked])
    setPicked(null)
    setPhase('question')
    setLog('🔄 再抽一次！重新作答。')
  }

  const answer = (i: number) => {
    if (!q || picked !== null || hidden.includes(i)) return
    setPicked(i)
    const ok = i === q.answer
    ok ? sfx.correct() : sfx.wrong()
    setStats((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
    if (q.cardId) setSave((s) => recordAnswer(s, q.cardId!, ok))
    setPhase('feedback')
  }

  // 一整個回合：我方行動 → 敵方行動
  const runTurn = async () => {
    if (!q || picked === null) return
    const ok = picked === q.answer
    setPhase('anim')
    let eHp = enemyHp
    let hHp = hp
    const newCombo = ok ? combo + 1 : 0
    setCombo(newCombo)
    const crit = ok && newCombo >= comboAt
    const hitEnemy = (raw: number, big: boolean) => {
      const lucky = Math.random() * 100 < P.luckyPct
      const dmg = Math.round(raw * (lucky ? 2 : 1))
      eHp = Math.max(0, eHp - dmg)
      setEnemyAnim('hit')
      setEnemyHp(eHp)
      pop('enemy', big || crit || lucky ? `${dmg}!!` : String(dmg), big || crit || lucky ? 'crit' : 'dmg')
      return { dmg, lucky }
    }

    // ---- 我方行動 ----
    if (action === 'attack') {
      setLog(`${save.name} 的攻擊！`)
      setHeroAnim('lunge')
      await sleep(320)
      if (ok) {
        setFx('slash'); sfx.slash()
        const { dmg, lucky } = hitEnemy((ATK_DMG + (crit ? comboBonus : 0)) * atkMul, false)
        setMp((m) => Math.min(mpMax, m + MP_REGEN))
        if (sk('blessing')) { hHp = Math.min(heroMax, hHp + 5); setHp(hHp) }
        setLog(lucky ? `🎡 命運之輪轉動！雙倍傷害 ${dmg}！` : crit ? `🔥 ${newCombo} 連擊！會心一擊，造成 ${dmg} 點傷害！` : `命中！${monster.name} 受到 ${dmg} 點傷害。`)
      } else {
        setFx('miss'); sfx.miss()
        setEnemyAnim('dodge')
        pop('enemy', 'MISS', 'miss')
        setLog(`${monster.name} 閃開了攻擊！`)
      }
    } else if (action === 'arcana' || action === 'dance') {
      const dance = action === 'dance'
      setMp((m) => m - (dance ? DANCE_COST : arcanaCost))
      const card = dance ? cardById('m21') : q.cardId ? cardById(q.cardId) : null
      setHeroAnim('cast')
      if (ok) {
        setLog(dance ? `${save.name} 跳起了世界之舞！` : card ? `${save.name} 召喚了「${card.nameZh}」！` : `${save.name} 詠唱秘術！`)
        setSummonImg(card?.image ?? null)
        setFx('summon'); sfx.magic()
        await sleep(1100)
        setFx('burst'); sfx.boom()
        setStageShake(true)
        const raw = dance ? DANCE_DMG * atkMul : (ARCANA_DMG + (crit ? comboBonus : 0)) * atkMul * (1 + P.arcanaPct / 100)
        const { dmg } = hitEnemy(raw, true)
        setLog(`${dance ? '世界之舞' : card ? card.nameZh + '之力' : '秘術'}爆發！造成 ${dmg} 點傷害！`)
      } else {
        await sleep(300)
        setFx('miss'); sfx.miss()
        pop('hero', '失敗', 'miss')
        setLog('咒語唸錯了……招式失敗，MP 白白消耗。')
      }
    } else {
      setHeroAnim('cast')
      await sleep(250)
      if (ok) {
        const amount = Math.round(PRAY_HEAL * (1 + P.prayPct / 100 + (sk('blessing') ? 0.5 : 0)))
        const heal = Math.min(amount, heroMax - hHp)
        hHp += heal
        setHp(hHp)
        if (P.prayMp) setMp((m) => Math.min(mpMax, m + P.prayMp))
        setFx('heal'); sfx.heal()
        pop('hero', `+${heal}`, 'heal')
        setLog(`祈禱成功！恢復了 ${heal} 點生命值。${P.prayMp ? `（MP +${P.prayMp}）` : ''}`)
      } else {
        sfx.miss()
        pop('hero', '失敗', 'miss')
        setLog('心神不寧，祈禱沒有回應……')
      }
    }

    // 死神守護牌：敵人殘血時直接擊倒
    if (ok && action !== 'pray' && eHp > 0 && (eHp / monster.hp) * 100 < P.executePct) {
      await sleep(500)
      eHp = 0
      setEnemyHp(0)
      pop('enemy', '斬', 'crit')
      setLog('💀 死神的鐮刀揮下，直接擊倒！')
    }

    await sleep(900)
    if (!alive.current) return
    setHeroAnim(''); setEnemyAnim(''); setFx(null); setSummonImg(null); setStageShake(false)

    // ---- 勝利 ----
    if (eHp <= 0) {
      setEnemyAnim('die')
      setLog(`${monster.name} 被打倒了！`)
      sfx.victory()
      await sleep(1400)
      return finish(true)
    }

    // ---- 敵方行動 ----
    await sleep(250)
    const special = charging
    if (special) {
      setBanner(monster.skill)
      setLog(`${monster.name} 施放了「${monster.skill}」！`)
      await sleep(900)
      setBanner(null)
    } else {
      setLog(`${monster.name} 的攻擊！`)
    }
    let dmg = monster.attack * (special ? 1.5 * (1 - P.specialGuardPct / 100) : 1)
    dmg *= ok ? 0.4 * (1 - P.justicePct / 100) : sk('shield') ? 0.7 : 1
    dmg *= (1 - P.guardPct / 100) * (P.devilPct ? 1.1 : 1)
    if (turn === 1) dmg *= 1 - P.firstTurnGuard / 100
    dmg = Math.round(dmg)
    let note = ''
    if (special && ok && sk('reverse')) {
      // 逆轉：把必殺技反彈回去
      setFx('slash'); sfx.slash()
      const back = Math.round(monster.attack * 1.5)
      eHp = Math.max(0, eHp - back)
      setEnemyHp(eHp)
      setEnemyAnim('hit')
      pop('enemy', `${back}!!`, 'crit')
      setLog(`🪞 逆轉！「${monster.skill}」被反彈回去，造成 ${back} 點傷害！`)
      await sleep(900)
      if (!alive.current) return
      setEnemyAnim(''); setFx(null)
      if (eHp <= 0) {
        setEnemyAnim('die'); sfx.victory()
        await sleep(1400)
        return finish(true)
      }
      dmg = -1
    } else if (special && sk('moonstep') && Math.random() < 0.5) {
      dmg = 0; note = '🌙 月影迷蹤：必殺技落空了！'
    } else if (!ok && Math.random() * 100 < P.dodgePct) {
      dmg = 0; note = '🙃 吊人：換個角度，躲過了攻擊！'
    }
    if (dmg >= 0) {
      setEnemyAnim('attack')
      await sleep(330)
      if (dmg > 0) {
        setFx('claw'); sfx.hurt()
        setStageShake(true)
        setHeroAnim('hurt')
        hHp = Math.max(0, hHp - dmg)
        setHp(hHp)
        pop('hero', String(dmg), 'hurt')
        setLog(ok ? `你答對了，氣勢壓制對手，只受到 ${dmg} 點傷害。` : `受到 ${dmg} 點傷害！`)
      } else {
        sfx.miss()
        pop('hero', 'MISS', 'miss')
        setLog(note || '攻擊沒有造成傷害！')
      }
      await sleep(800)
      if (!alive.current) return
      setHeroAnim(''); setEnemyAnim(''); setFx(null); setStageShake(false)
    }

    if (hHp <= 0 && P.revivePct && !revived.current) {
      // 審判守護牌：復活一次
      revived.current = true
      hHp = Math.max(1, Math.round(heroMax * P.revivePct / 100))
      setHp(hHp)
      setFx('heal'); sfx.heal()
      pop('hero', `+${hHp}`, 'heal')
      setLog('📯 審判的號角響起，你重新站了起來！')
      await sleep(1000)
      setFx(null)
    }
    if (hHp <= 0) {
      setHeroAnim('down')
      setLog(`${save.name} 倒下了……`)
      sfx.defeat()
      await sleep(1300)
      return finish(false)
    }

    // 回合結束：自動回復
    const regenMp = P.regenMp + (sk('focus') ? 3 : 0)
    if (regenMp) setMp((m) => Math.min(mpMax, m + regenMp))
    if (P.regenHp) { hHp = Math.min(heroMax, hHp + P.regenHp); setHp(hHp) }

    // 每 3 回合，敵人會蓄力準備必殺技
    const nextTurn = turn + 1
    const willCharge = nextTurn % 3 === 0
    setCharging(willCharge)
    if (willCharge) {
      sfx.charge()
      setLog(`⚠️ ${monster.name} 正在蓄力！下回合將施放「${monster.skill}」，答對才能減輕傷害！`)
    } else {
      setLog(`第 ${nextTurn} 回合，請選擇行動。`)
    }
    setTurn(nextTurn)
    setPhase('command')
  }

  const finish = (win: boolean) => {
    setPhase('result')
    if (!win) {
      // 在大地圖上被打倒：回到這一區的入口
      if ((mode.kind === 'wild' || mode.kind === 'chapter') && mode.from === 'world') {
        const zi = mode.kind === 'wild' ? mode.zone : ZONES.findIndex((z) => z.chapterId === mode.chapterId)
        setSave((s) => ({ ...s, pos: zoneEntry(Math.max(0, zi)) }))
      }
      gainXp(5, '失敗也是學習')
      setResult({ win, text: '別灰心！回去複習一下牌義，再來挑戰吧。' })
      return
    }
    setSave((s) => ({ ...s, battlesWon: s.battlesWon + 1 }))
    // 經驗值加成：太陽守護牌、太陽之心技能
    const xpMul = 1 + (P.xpPct + (sk('sunheart') ? 30 : 0)) / 100
    if (mode.kind === 'wild') {
      // 等級壓制：比區域推薦等級高太多，經驗值會變少
      const xp = Math.round(suppressedXp(10 + mode.zone * 3, level, ZONE_LEVEL[mode.zone]) * xpMul)
      gainXp(xp, `打倒${monster.name}`)
      setResult({ win, text: `獲得 ${xp} XP！` })
      return
    }
    if (mode.kind !== 'chapter') {
      gainXp(Math.round(XP.training * (1 + P.studyXpPct / 100)), '訓練完成')
      setResult({ win, text: '訓練完成，熟練度提升了！' })
      return
    }
    const ch = CHAPTERS.find((c) => c.id === mode.chapterId)!
    const first = !save.clearedChapters.includes(ch.id)
    const zi = Math.max(0, ZONES.findIndex((z) => z.chapterId === ch.id))
    const base = first ? ch.xpReward : suppressedXp(Math.floor(ch.xpReward / 2), level, ZONE_LEVEL[zi])
    const xp = Math.round(base * xpMul)
    if (first) setSave((s) => ({ ...s, clearedChapters: [...s.clearedChapters, ch.id] }))
    gainXp(xp, `打倒${monster.name}`)
    setResult({ win, text: first ? `${ch.title} 通關！獲得 ${xp} XP，下一章已解鎖。` : `再次獲勝！獲得 ${xp} XP。` })
    if (first && ch.id === 'boss') toast('🏆 你完成了愚者之旅！')
  }

  const from = 'from' in mode ? mode.from : undefined
  const leave = () => go(from === 'world' ? { name: 'map' } : from === 'debug' ? { name: 'debug' } : mode.kind === 'chapter' ? { name: 'chapter', id: mode.chapterId } : { name: 'journey' })
  const toggleMute = () => { setMuted(!mute); setMute(!mute) }

  const ok = q && picked !== null && picked === q.answer

  return (
    <div className={`jrpg stage-${setup.stage}`}>
      {/* ---------- 戰鬥舞台 ---------- */}
      <div className={`stage ${stageShake ? 'quake' : ''} ${fx === 'claw' ? 'red-flash' : ''}`}>
        <div className="stage-sky" />
        <div className="stage-ground" />
        <div className="logbox">
          <span className="turn-tag">回合 {turn}</span>
          <span className="log-text">{log}</span>
          <button className="mute" onClick={toggleMute} aria-label={mute ? '開啟音效' : '關閉音效'}>{mute ? '🔇' : '🔊'}</button>
        </div>

        <div className="enemy-unit">
          <div className="unit-label">
            <span>{monster.name}</span>
            <div className="mini-bar enemy"><div style={{ width: `${(enemyHp / monster.hp) * 100}%` }} /></div>
          </div>
          <div className={`sprite enemy-sprite ${enemyAnim} ${charging ? 'charging' : ''} ${monster.boss ? 'boss' : ''}`}>{monster.emoji}</div>
          <div className="shadow" />
          {fx === 'slash' && (
            <svg className="fx-slash" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M15 20 L85 80" /><path d="M30 10 L90 60" /><path d="M10 40 L70 92" />
            </svg>
          )}
          {fx === 'burst' && <div className="fx-burst" />}
          {fx === 'miss' && action === 'attack' && <div className="fx-whiff" />}
          {popups.filter((p) => p.target === 'enemy').map((p) => <span key={p.id} className={`popup ${p.kind}`}>{p.text}</span>)}
        </div>

        <div className="hero-unit">
          <div className={`sprite hero-sprite ${heroAnim}`}>{save.avatar}</div>
          <div className="shadow" />
          {fx === 'heal' && <div className="fx-heal">{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }}>✦</span>)}</div>}
          {fx === 'claw' && (
            <svg className="fx-claw" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M80 10 L30 90" /><path d="M95 20 L45 98" /><path d="M65 5 L18 78" />
            </svg>
          )}
          {popups.filter((p) => p.target === 'hero').map((p) => <span key={p.id} className={`popup ${p.kind}`}>{p.text}</span>)}
        </div>

        {fx === 'summon' && (
          <div className="fx-summon">
            <div className="magic-circle" />
            {summonImg ? <img src={summonImg} alt="" /> : <div className="card-back summon-back"><span>✦</span></div>}
          </div>
        )}
        {banner && <div className="skill-banner">{banner}</div>}
      </div>

      {/* ---------- 下方介面 ---------- */}
      <div className="hud">
        {phase === 'intro' && (
          <div className="win intro-win">
            <p><strong>{monster.name}</strong> 出現了！</p>
            <ul className="small rules">
              <li>⚔️ 攻擊：答對造成 {ATK_DMG} 傷害，回復 {MP_REGEN} MP</li>
              <li>🃏 秘術：消耗 {arcanaCost} MP，答對進階題造成 {ARCANA_DMG} 傷害</li>
              {sk('dance') && <li>🌍 世界之舞：消耗 {DANCE_COST} MP，答對情境題造成 {DANCE_DMG} 傷害</li>}
              <li>🙏 祈禱：答對恢復 {PRAY_HEAL} HP</li>
              <li>連續答對 {comboAt} 題以上會心一擊 +{comboBonus}；答對時敵人的反擊傷害減少 60%</li>
            </ul>
            {(save.guardians?.length || save.skills?.length) ? (
              <p className="small muted">🛡️ 守護牌與技能效果已生效（HP {heroMax}・MP {mpMax}）</p>
            ) : null}
            <div className="row">
              <button className="btn ghost" onClick={leave}>撤退</button>
              <button className="btn primary grow" onClick={() => { sfx.select(); setPhase('command'); setLog('第 1 回合，請選擇行動。') }}>戰鬥開始！</button>
            </div>
          </div>
        )}

        {(phase === 'command' || phase === 'anim') && (
          <div className="hud-row">
            <div className="win commands">
              <button disabled={phase !== 'command'} onClick={() => choose('attack')}>⚔️ 攻擊</button>
              <button disabled={phase !== 'command' || mp < arcanaCost} onClick={() => choose('arcana')}>🃏 秘術 <small>{arcanaCost}MP</small></button>
              {sk('dance') && <button disabled={phase !== 'command' || mp < DANCE_COST} onClick={() => choose('dance')}>🌍 世界之舞 <small>{DANCE_COST}MP</small></button>}
              <button disabled={phase !== 'command' || hp >= heroMax} onClick={() => choose('pray')}>🙏 祈禱</button>
              <button disabled={phase !== 'command'} onClick={leave}>🏃 撤退</button>
            </div>
            <div className="win status">
              <div className="status-name">{save.avatar} {save.name}</div>
              <div className="stat-line"><span>HP</span><div className="mini-bar hp"><div style={{ width: `${(hp / heroMax) * 100}%` }} /></div><b className={hp < heroMax * 0.3 ? 'danger' : ''}>{hp}</b></div>
              <div className="stat-line"><span>MP</span><div className="mini-bar mp"><div style={{ width: `${(mp / mpMax) * 100}%` }} /></div><b>{mp}</b></div>
              {combo >= 2 && <div className="combo-tag">🔥 {combo} 連擊</div>}
            </div>
          </div>
        )}

        {(phase === 'question' || phase === 'feedback') && q && (
          <div className="win question-win">
            <div className="win-title row">
              <span className="grow">{action === 'attack' ? '⚔️ 攻擊' : action === 'arcana' ? '🃏 秘術・進階題' : action === 'dance' ? '🌍 世界之舞・情境題' : '🙏 祈禱'}</span>
              {phase === 'question' && hintsLeft > 0 && <button className="mini-skill" onClick={() => eliminate('hint')}>🏮 提示 ×{hintsLeft}</button>}
              {phase === 'question' && sk('eye') && <button className="mini-skill" disabled={mp < EYE_COST} onClick={() => eliminate('eye')}>👁️ 直覺之眼 {EYE_COST}MP</button>}
            </div>
            <QuestionCard q={q} picked={picked} onAnswer={answer} compact hidden={hidden} reveal={!!ok || !(sk('redraw') && !redrawUsed)} />
            {phase === 'feedback' && (
              <div className={`feedback ${ok ? 'ok' : 'ng'}`}>
                <strong>{ok ? '⭕ 答對了！' : '❌ 答錯了'}</strong>
                <p className="small">{ok || !(sk('redraw') && !redrawUsed) ? q.explain : '還有一次機會，要再想想嗎？'}</p>
                {!ok && sk('redraw') && !redrawUsed && <button className="btn block" onClick={retry}>🔄 再抽一次（重新作答）</button>}
                <button className="btn primary block" onClick={runTurn}>{ok ? '發動！' : '繼續'}</button>
              </div>
            )}
            {phase === 'question' && <button className="btn ghost block small" onClick={() => setPhase('command')}>← 換個指令</button>}
          </div>
        )}

        {phase === 'result' && result && (
          <div className="win result-win">
            <div className={result.win ? 'result-title win-t' : 'result-title lose-t'}>{result.win ? 'VICTORY' : 'DEFEAT'}</div>
            <p>{result.text}</p>
            <p className="small muted">答對 {stats.right} / {stats.total} 題・共 {turn} 回合</p>
            <div className="row">
              {!result.win && <button className="btn ghost" onClick={() => go({ name: 'battle', mode })}>再挑戰</button>}
              <button className="btn primary grow" onClick={leave}>返回</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
