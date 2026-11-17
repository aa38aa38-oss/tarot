import { useState } from 'react'
import type { GameCtx } from '../App'
import { MAJOR_ARCANA } from '../data/majorArcana'
import { Question, makeCardQuestion } from '../lib/questions'
import { XP, recordAnswer } from '../lib/game'
import QuestionCard from '../components/QuestionCard'

const TOTAL = 15
const PASS = 12

// 跳級測驗：單純的 15 題測驗，不是戰鬥
export default function SkipTestScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, gainXp, go } = ctx
  const [started, setStarted] = useState(false)
  const [q, setQ] = useState<Question>(() => makeCardQuestion(save, MAJOR_ARCANA))
  const [picked, setPicked] = useState<number | null>(null)
  const [asked, setAsked] = useState(1)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<null | boolean>(null)

  const answer = (i: number) => {
    setPicked(i)
    const ok = i === q.answer
    if (ok) setScore((s) => s + 1)
    if (q.cardId) setSave((s) => recordAnswer(s, q.cardId!, ok))
  }

  const next = () => {
    if (asked >= TOTAL) {
      const win = score >= PASS
      setResult(win)
      if (win) {
        setSave((s) => ({
          ...s,
          skipTestPassed: true,
          basicsDone: true,
          collected: Array.from(new Set([...s.collected, ...MAJOR_ARCANA.map((c) => c.id)])),
        }))
        gainXp(XP.skipTest, '通過跳級測驗')
      }
      return
    }
    setQ(makeCardQuestion(save, MAJOR_ARCANA, q.cardId))
    setPicked(null)
    setAsked((a) => a + 1)
  }

  if (!started) {
    return (
      <div className="stack battle-intro">
        <button className="back" onClick={() => go({ name: 'map' })}>← 返回</button>
        <div className="monster-emoji huge">⏳</div>
        <h2 className="center">跳級測驗</h2>
        <p className="center">共 {TOTAL} 題，答對 {PASS} 題以上即可解鎖新手村所有章節，並直接收服 22 張大牌。</p>
        <button className="btn primary block" onClick={() => setStarted(true)}>開始！</button>
      </div>
    )
  }

  if (result !== null) {
    return (
      <div className="stack battle-result">
        <div className="monster-emoji huge">{result ? '🏆' : '💫'}</div>
        <h2 className="center">{result ? '測驗通過！' : '未通過'}</h2>
        <p className="center">
          {result
            ? `答對 ${score}/${TOTAL}！所有章節已解鎖，22 張大牌已加入圖鑑。`
            : `答對 ${score}/${TOTAL}，還差一點。建議從序章開始穩穩學起，之後再來挑戰！`}
        </p>
        <button className="btn primary block" onClick={() => go({ name: 'map' })}>返回</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row small">
        <button className="back" onClick={() => go({ name: 'map' })}>✕</button>
        <span>第 {asked}/{TOTAL} 題・答對 {score}</span>
      </div>
      <QuestionCard q={q} picked={picked} onAnswer={answer} />
      {picked !== null && (
        <div className={`feedback ${picked === q.answer ? 'ok' : 'ng'}`}>
          <strong>{picked === q.answer ? '⭕ 答對！' : '❌ 答錯了'}</strong>
          <p className="small">{q.explain}</p>
          <button className="btn primary block" onClick={next}>{asked >= TOTAL ? '查看結果' : '下一題 →'}</button>
        </div>
      )}
    </div>
  )
}
