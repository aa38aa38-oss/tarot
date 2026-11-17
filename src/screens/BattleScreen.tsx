import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameCtx } from '../App'
import { CHAPTERS, Monster, StageTheme } from '../data/world'
import { ZONES, zoneEntry } from '../data/overworld'
import { MAJOR_ARCANA, TarotCard, cardById } from '../data/majorArcana'
import { HARD_TYPES, Question, makeBasicsQuestion, makeCardQuestion, poolFromIds } from '../lib/questions'
import { XP, levelInfo, maxHp, recordAnswer } from '../lib/game'
import { isMuted, setMuted, sfx } from '../lib/sfx'
import QuestionCard from '../components/QuestionCard'

export type BattleMode =
  | { kind: 'chapter'; chapterId: string; from?: 'world' }
  | { kind: 'training'; from?: 'world' }
  | { kind: 'wild'; zone: number; idx: number; from: 'world' }
  | { kind: 'skip' }

const ZONE_STAGE: StageTheme[] = ['dawn', 'cliff', 'hall', 'savanna', 'cave', 'night', 'golden', 'cosmos']

type Action = 'attack' | 'arcana' | 'pray'
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
  const heroMax = maxHp(levelInfo(save.xp).level)
  const usedBasics = useRef(new Set<number>())
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const [phase, setPhase] = useState<Phase>('intro')
  const [turn, setTurn] = useState(1)
  const [hp, setHp] = useState(heroMax)
  const [mp, setMp] = useState(MP_MAX)
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

  const pop = (target: Popup['target'], text: string, kind: Popup['kind']) => {
    const id = Date.now() + Math.random()
    setPopups((p) => [...p, { id, target, text, kind }])
    setTimeout(() => alive.current && setPopups((p) => p.filter((x) => x.id !== id)), 1300)
  }

  const newQuestion = (act: Action): Question =>
    setup.basics
      ? makeBasicsQuestion(usedBasics.current)
      : makeCardQuestion(save, setup.pool, q?.cardId, act === 'arcana' ? HARD_TYPES : undefined)

  const choose = (act: Action) => {
    sfx.select()
    if (act === 'arcana' && mp < ARCANA_COST) {
      setLog(`MP 不足！秘術需要 ${ARCANA_COST} MP。`)
      return
    }
    setAction(act)
    setQ(newQuestion(act))
    setPicked(null)
    setPhase('question')
    setLog(act === 'attack' ? '答對問題即可發動攻擊！' : act === 'arcana' ? '秘術：答對進階題，召喚塔羅牌的力量！' : '祈禱：答對問題即可恢復生命值。')
  }

  const answer = (i: number) => {
    if (!q || picked !== null) return
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
    const crit = ok && newCombo >= 3

    // ---- 我方行動 ----
    if (action === 'attack') {
      setLog(`${save.name} 的攻擊！`)
      setHeroAnim('lunge')
      await sleep(320)
      if (ok) {
        const dmg = ATK_DMG + (crit ? COMBO_BONUS : 0)
        eHp = Math.max(0, eHp - dmg)
        setFx('slash'); sfx.slash()
        setEnemyAnim('hit')
        setEnemyHp(eHp)
        pop('enemy', crit ? `${dmg}!!` : String(dmg), crit ? 'crit' : 'dmg')
        setMp((m) => Math.min(MP_MAX, m + MP_REGEN))
        setLog(crit ? `🔥 ${newCombo} 連擊！會心一擊，造成 ${dmg} 點傷害！` : `命中！${monster.name} 受到 ${dmg} 點傷害。`)
      } else {
        setFx('miss'); sfx.miss()
        setEnemyAnim('dodge')
        pop('enemy', 'MISS', 'miss')
        setLog(`${monster.name} 閃開了攻擊！`)
      }
    } else if (action === 'arcana') {
      setMp((m) => m - ARCANA_COST)
      const card = q.cardId ? cardById(q.cardId) : null
      setHeroAnim('cast')
      if (ok) {
        setLog(card ? `${save.name} 召喚了「${card.nameZh}」！` : `${save.name} 詠唱秘術！`)
        setSummonImg(card?.image ?? null)
        setFx('summon'); sfx.magic()
        await sleep(1100)
        const dmg = ARCANA_DMG + (crit ? COMBO_BONUS : 0)
        eHp = Math.max(0, eHp - dmg)
        setFx('burst'); sfx.boom()
        setStageShake(true)
        setEnemyAnim('hit')
        setEnemyHp(eHp)
        pop('enemy', `${dmg}!!`, 'crit')
        setLog(`${card ? card.nameZh + '之力' : '秘術'}爆發！造成 ${dmg} 點傷害！`)
      } else {
        await sleep(300)
        setFx('miss'); sfx.miss()
        pop('hero', '失敗', 'miss')
        setLog('咒語唸錯了……秘術失敗，MP 白白消耗。')
      }
    } else {
      setHeroAnim('cast')
      await sleep(250)
      if (ok) {
        const heal = Math.min(PRAY_HEAL, heroMax - hHp)
        hHp += heal
        setHp(hHp)
        setFx('heal'); sfx.heal()
        pop('hero', `+${heal}`, 'heal')
        setLog(`祈禱成功！恢復了 ${heal} 點生命值。`)
      } else {
        sfx.miss()
        pop('hero', '失敗', 'miss')
        setLog('心神不寧，祈禱沒有回應……')
      }
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
    const base = monster.attack * (special ? 1.5 : 1)
    const dmg = Math.round(ok ? base * 0.4 : base)
    if (special) {
      setBanner(monster.skill)
      setLog(`${monster.name} 施放了「${monster.skill}」！`)
      await sleep(900)
      setBanner(null)
    } else {
      setLog(`${monster.name} 的攻擊！`)
    }
    setEnemyAnim('attack')
    await sleep(330)
    setFx('claw'); sfx.hurt()
    setStageShake(true)
    setHeroAnim('hurt')
    hHp = Math.max(0, hHp - dmg)
    setHp(hHp)
    pop('hero', String(dmg), 'hurt')
    setLog(ok ? `你答對了，氣勢壓制對手，只受到 ${dmg} 點傷害。` : `受到 ${dmg} 點傷害！`)
    await sleep(800)
    if (!alive.current) return
    setHeroAnim(''); setEnemyAnim(''); setFx(null); setStageShake(false)

    if (hHp <= 0) {
      setHeroAnim('down')
      setLog(`${save.name} 倒下了……`)
      sfx.defeat()
      await sleep(1300)
      return finish(false)
    }

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
      if (mode.kind === 'wild' || (mode.kind === 'chapter' && mode.from)) {
        const zi = mode.kind === 'wild' ? mode.zone : ZONES.findIndex((z) => z.chapterId === mode.chapterId)
        setSave((s) => ({ ...s, pos: zoneEntry(Math.max(0, zi)) }))
      }
      gainXp(5, '失敗也是學習')
      setResult({ win, text: '別灰心！回去複習一下牌義，再來挑戰吧。' })
      return
    }
    setSave((s) => ({ ...s, battlesWon: s.battlesWon + 1 }))
    if (mode.kind === 'wild') {
      const xp = 10 + mode.zone * 3
      gainXp(xp, `打倒${monster.name}`)
      setResult({ win, text: `獲得 ${xp} XP！` })
      return
    }
    if (mode.kind !== 'chapter') {
      gainXp(XP.training, '訓練完成')
      setResult({ win, text: '訓練完成，熟練度提升了！' })
      return
    }
    const ch = CHAPTERS.find((c) => c.id === mode.chapterId)!
    const first = !save.clearedChapters.includes(ch.id)
    const xp = first ? ch.xpReward : Math.floor(ch.xpReward / 2)
    if (first) setSave((s) => ({ ...s, clearedChapters: [...s.clearedChapters, ch.id] }))
    gainXp(xp, `打倒${monster.name}`)
    setResult({ win, text: first ? `${ch.title} 通關！獲得 ${xp} XP，下一章已解鎖。` : `再次獲勝！獲得 ${xp} XP。` })
    if (first && ch.id === 'boss') toast('🏆 你完成了愚者之旅！')
  }

  const leave = () => go('from' in mode && mode.from ? { name: 'map' } : mode.kind === 'chapter' ? { name: 'chapter', id: mode.chapterId } : { name: 'journey' })
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
              <li>🃏 秘術：消耗 {ARCANA_COST} MP，答對進階題造成 {ARCANA_DMG} 傷害</li>
              <li>🙏 祈禱：答對恢復 {PRAY_HEAL} HP</li>
              <li>連續答對 3 題以上會心一擊 +{COMBO_BONUS}；答對時敵人的反擊傷害減少 60%</li>
            </ul>
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
              <button disabled={phase !== 'command' || mp < ARCANA_COST} onClick={() => choose('arcana')}>🃏 秘術 <small>{ARCANA_COST}MP</small></button>
              <button disabled={phase !== 'command' || hp >= heroMax} onClick={() => choose('pray')}>🙏 祈禱</button>
              <button disabled={phase !== 'command'} onClick={leave}>🏃 撤退</button>
            </div>
            <div className="win status">
              <div className="status-name">{save.avatar} {save.name}</div>
              <div className="stat-line"><span>HP</span><div className="mini-bar hp"><div style={{ width: `${(hp / heroMax) * 100}%` }} /></div><b className={hp < heroMax * 0.3 ? 'danger' : ''}>{hp}</b></div>
              <div className="stat-line"><span>MP</span><div className="mini-bar mp"><div style={{ width: `${(mp / MP_MAX) * 100}%` }} /></div><b>{mp}</b></div>
              {combo >= 2 && <div className="combo-tag">🔥 {combo} 連擊</div>}
            </div>
          </div>
        )}

        {(phase === 'question' || phase === 'feedback') && q && (
          <div className="win question-win">
            <div className="win-title">{action === 'attack' ? '⚔️ 攻擊' : action === 'arcana' ? '🃏 秘術・進階題' : '🙏 祈禱'}</div>
            <QuestionCard q={q} picked={picked} onAnswer={answer} compact />
            {phase === 'feedback' && (
              <div className={`feedback ${ok ? 'ok' : 'ng'}`}>
                <strong>{ok ? '⭕ 答對了！' : '❌ 答錯了'}</strong>
                <p className="small">{q.explain}</p>
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
