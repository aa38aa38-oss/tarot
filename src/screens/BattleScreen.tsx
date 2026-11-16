import { useMemo, useRef, useState } from 'react'
import type { GameCtx } from '../App'
import { CHAPTERS, Monster } from '../data/world'
import { MAJOR_ARCANA, TarotCard } from '../data/majorArcana'
import { Question, makeBasicsQuestion, makeCardQuestion, poolFromIds } from '../lib/questions'
import { XP, levelInfo, maxHp, recordAnswer } from '../lib/game'

export type BattleMode =
  | { kind: 'chapter'; chapterId: string }
  | { kind: 'training' }
  | { kind: 'skip' }

const SKIP_TOTAL = 15
const SKIP_PASS = 12
const BASE_DMG = 20

interface Setup {
  monster: Monster
  pool: TarotCard[]
  basics: boolean
  title: string
}

function setupFor(mode: BattleMode, collected: string[]): Setup {
  if (mode.kind === 'training') {
    return {
      title: '訓練場',
      monster: { name: '訓練用稻草人', emoji: '🎯', hp: 100, attack: 10, intro: '稻草人會優先考你最不熟的牌。' },
      pool: poolFromIds(collected),
      basics: false,
    }
  }
  if (mode.kind === 'skip') {
    return {
      title: '跳級測驗',
      monster: { name: '時之守門人', emoji: '⏳', hp: SKIP_TOTAL, attack: 0, intro: `共 ${SKIP_TOTAL} 題，答對 ${SKIP_PASS} 題以上即可解鎖新手村所有章節，並直接收服 22 張大牌。` },
      pool: MAJOR_ARCANA,
      basics: false,
    }
  }
  const ch = CHAPTERS.find((c) => c.id === mode.chapterId)!
  return {
    title: ch.title,
    monster: ch.monster,
    pool: ch.quizPool === 'all-major' ? MAJOR_ARCANA : poolFromIds(ch.cardIds),
    basics: ch.quizPool === 'basics',
  }
}

export default function BattleScreen({ ctx, mode }: { ctx: GameCtx; mode: BattleMode }) {
  const { save, setSave, gainXp, go, toast } = ctx
  const setup = useMemo(() => setupFor(mode, save.collected), []) // eslint-disable-line react-hooks/exhaustive-deps
  const playerMax = maxHp(levelInfo(save.xp).level)
  const usedBasics = useRef(new Set<number>())
  const isSkip = mode.kind === 'skip'

  const nextQuestion = (avoid?: string): Question =>
    setup.basics ? makeBasicsQuestion(usedBasics.current) : makeCardQuestion(save, setup.pool, avoid)

  const [started, setStarted] = useState(false)
  const [q, setQ] = useState<Question>(() => nextQuestion())
  const [picked, setPicked] = useState<number | null>(null)
  const [monsterHp, setMonsterHp] = useState(setup.monster.hp)
  const [playerHp, setPlayerHp] = useState(playerMax)
  const [combo, setCombo] = useState(0)
  const [asked, setAsked] = useState(1)
  const [score, setScore] = useState(0)
  const [fx, setFx] = useState<'hit' | 'hurt' | null>(null)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const [rewardText, setRewardText] = useState('')

  const answer = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    const ok = i === q.answer
    if (q.cardId) setSave((s) => recordAnswer(s, q.cardId!, ok))
    if (ok) {
      setScore((x) => x + 1)
      const newCombo = combo + 1
      setCombo(newCombo)
      const dmg = isSkip ? 1 : BASE_DMG + (newCombo >= 3 ? 10 : 0)
      setMonsterHp((h) => Math.max(0, h - dmg))
      setFx('hit')
    } else {
      setCombo(0)
      if (!isSkip) setPlayerHp((h) => Math.max(0, h - setup.monster.attack))
      setFx('hurt')
    }
    setTimeout(() => setFx(null), 500)
  }

  const finish = (win: boolean, finalScore: number) => {
    setResult(win ? 'win' : 'lose')
    if (mode.kind === 'skip') {
      if (win) {
        setSave((s) => ({
          ...s,
          skipTestPassed: true,
          basicsDone: true,
          collected: Array.from(new Set([...s.collected, ...MAJOR_ARCANA.map((c) => c.id)])),
        }))
        gainXp(XP.skipTest, '通過跳級測驗')
        setRewardText(`答對 ${finalScore}/${SKIP_TOTAL}！所有章節已解鎖，22 張大牌已加入圖鑑。`)
      } else {
        setRewardText(`答對 ${finalScore}/${SKIP_TOTAL}，還差一點。建議從序章開始穩穩學起，之後再來挑戰！`)
      }
      return
    }
    if (!win) {
      gainXp(5, '失敗也是學習')
      setRewardText('別灰心！回去複習一下牌義，再來挑戰吧。')
      return
    }
    setSave((s) => ({ ...s, battlesWon: s.battlesWon + 1 }))
    if (mode.kind === 'training') {
      gainXp(XP.training, '訓練完成')
      setRewardText('訓練完成，熟練度提升了！')
      return
    }
    const ch = CHAPTERS.find((c) => c.id === mode.chapterId)!
    const first = !save.clearedChapters.includes(ch.id)
    const xp = first ? ch.xpReward : Math.floor(ch.xpReward / 2)
    if (first) setSave((s) => ({ ...s, clearedChapters: [...s.clearedChapters, ch.id] }))
    gainXp(xp, `打倒${ch.monster.name}`)
    setRewardText(first ? `${ch.title} 通關！下一章已解鎖。` : '再次獲勝！')
    if (first && ch.id === 'boss') toast('🏆 你完成了愚者之旅！')
  }

  const next = () => {
    if (isSkip) {
      if (asked >= SKIP_TOTAL) return finish(score >= SKIP_PASS, score)
    } else {
      if (monsterHp <= 0) return finish(true, score)
      if (playerHp <= 0) return finish(false, score)
    }
    setQ(nextQuestion(q.cardId))
    setPicked(null)
    setAsked((a) => a + 1)
  }

  const leave = () => go(mode.kind === 'chapter' ? { name: 'chapter', id: mode.chapterId } : { name: 'map' })

  // ---------- 開場 ----------
  if (!started) {
    return (
      <div className="stack battle-intro">
        <button className="back" onClick={leave}>← 撤退</button>
        <h2 className="center">{setup.title}</h2>
        <div className="monster-emoji huge">{setup.monster.emoji}</div>
        <h3 className="center">{setup.monster.name}</h3>
        <p className="center">{setup.monster.intro}</p>
        {!isSkip && (
          <ul className="small muted rules">
            <li>答對：造成 {BASE_DMG} 點傷害，連續答對 3 題以上 +10 暴擊</li>
            <li>答錯：受到 {setup.monster.attack} 點傷害</li>
            <li>你的生命值：{playerMax}</li>
          </ul>
        )}
        <button className="btn primary block" onClick={() => setStarted(true)}>開始！</button>
      </div>
    )
  }

  // ---------- 結算 ----------
  if (result) {
    return (
      <div className="stack battle-result">
        <div className="monster-emoji huge">{result === 'win' ? '🏆' : '💫'}</div>
        <h2 className="center">{result === 'win' ? (isSkip ? '測驗通過！' : '勝利！') : isSkip ? '未通過' : '被打倒了……'}</h2>
        <p className="center">{rewardText}</p>
        <p className="center small muted">本場答對 {score} / {asked} 題</p>
        <button className="btn primary block" onClick={leave}>返回</button>
        {result === 'lose' && !isSkip && <button className="btn ghost block" onClick={() => go({ name: 'battle', mode })}>再挑戰一次</button>}
      </div>
    )
  }

  // ---------- 戰鬥中 ----------
  const answered = picked !== null
  const ok = picked === q.answer
  const isImageOptions = q.options.some((o) => o.image)

  return (
    <div className="battle">
      <div className="battle-top">
        <button className="back small" onClick={leave}>✕</button>
        {isSkip ? (
          <div className="grow small">第 {asked}/{SKIP_TOTAL} 題・答對 {score}</div>
        ) : (
          <div className="grow">
            <div className="hp-row">
              <span className={`monster-emoji ${fx === 'hit' ? 'shake' : ''}`}>{setup.monster.emoji}</span>
              <div className="hpbar enemy"><div style={{ width: `${(monsterHp / setup.monster.hp) * 100}%` }} /><span>{monsterHp}/{setup.monster.hp}</span></div>
            </div>
            <div className="hp-row">
              <span className={`monster-emoji ${fx === 'hurt' ? 'shake' : ''}`}>{save.avatar}</span>
              <div className="hpbar player"><div style={{ width: `${(playerHp / playerMax) * 100}%` }} /><span>{playerHp}/{playerMax}</span></div>
            </div>
          </div>
        )}
      </div>
      {combo >= 3 && !isSkip && <div className="combo">🔥 {combo} 連擊！</div>}
      {fx === 'hurt' && <div className="flash" />}

      <div className="question panel">
        {q.image && (
          <div className="q-image hide-name">
            <img src={q.image} alt="題目牌面" />
          </div>
        )}
        <p className="pre q-text">{q.prompt}</p>
      </div>

      <div className={isImageOptions ? 'options images' : 'options'}>
        {q.options.map((o, i) => {
          let cls = 'option'
          if (answered && i === q.answer) cls += ' correct'
          else if (answered && i === picked) cls += ' wrong'
          return (
            <button key={i} className={cls} onClick={() => answer(i)} disabled={answered}>
              {o.image ? (
                <span className="hide-name"><img src={o.image} alt={`選項 ${i + 1}`} /></span>
              ) : (
                o.label
              )}
              {o.image && answered && <span className="small opt-caption">{o.label}</span>}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className={`feedback ${ok ? 'ok' : 'ng'}`}>
          <strong>{ok ? (isSkip ? '⭕ 答對！' : combo >= 3 ? '💥 暴擊！' : '⚔️ 命中！') : isSkip ? '❌ 答錯了' : `💥 答錯了，受到 ${setup.monster.attack} 點傷害`}</strong>
          <p className="small">{q.explain}</p>
          <button className="btn primary block" onClick={next}>
            {(!isSkip && (monsterHp <= 0 || playerHp <= 0)) || (isSkip && asked >= SKIP_TOTAL) ? '查看結果' : '下一題 →'}
          </button>
        </div>
      )}
    </div>
  )
}
