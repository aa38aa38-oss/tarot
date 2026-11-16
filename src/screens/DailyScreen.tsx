import { useState } from 'react'
import type { GameCtx } from '../App'
import { MAJOR_ARCANA, cardById } from '../data/majorArcana'
import { XP, today, yesterday } from '../lib/game'
import { dailyPrompt } from '../lib/prompts'
import { CopyButton } from '../components/CardDetail'

export default function DailyScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, gainXp } = ctx
  const todayEntry = save.journal.find((j) => j.date === today())
  const [drawn, setDrawn] = useState<string | null>(todayEntry?.cardId ?? null)
  const [flipping, setFlipping] = useState(false)
  const [note, setNote] = useState(todayEntry?.note ?? '')
  const card = drawn ? cardById(drawn) : null

  const draw = () => {
    setFlipping(true)
    setTimeout(() => {
      setDrawn(MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)].id)
      setFlipping(false)
    }, 700)
  }

  const submit = () => {
    if (!drawn) return
    const first = !todayEntry
    setSave((s) => {
      const streak = s.lastDailyDate === yesterday() ? s.streak + 1 : s.lastDailyDate === today() ? s.streak : 1
      const journal = [...s.journal.filter((j) => j.date !== today()), { date: today(), cardId: drawn, note }]
      return { ...s, journal, streak, lastDailyDate: today() }
    })
    if (first) {
      const streak = save.lastDailyDate === yesterday() ? save.streak + 1 : 1
      const bonus = streak > 1 ? Math.min(streak, 7) * 2 : 0
      gainXp(XP.daily + bonus, bonus ? `每日一抽（連續 ${streak} 天）` : '每日一抽')
    } else ctx.toast('📝 心得已更新')
  }

  return (
    <div className="stack">
      <h1>🌅 每日一抽</h1>
      <p className="muted small">每天抽一張大牌，寫下你的解讀。連續天數越多，獎勵越多！目前連續 {save.streak} 天。</p>

      {!card ? (
        <div className="daily-draw">
          <button className={flipping ? 'deck flipping' : 'deck'} onClick={draw} disabled={flipping}>
            <div className="card-back big-back"><span>✦</span></div>
          </button>
          <p className="center muted">靜下心，想著今天，然後點擊牌堆抽牌</p>
        </div>
      ) : (
        <>
          <div className="daily-card">
            <img src={card.image} alt={card.nameZh} className="card-big reveal" />
            <div>
              <h2>{card.roman}・{card.nameZh}</h2>
              <div className="keywords">{card.keywordsUp.map((k) => <span key={k} className="kw">{k}</span>)}</div>
              <p className="small">{card.upright}</p>
            </div>
          </div>
          <div className="panel">
            <label className="label">✍️ 這張牌對今天的你，有什麼意義？</label>
            <p className="small muted">提示：{card.reflect}</p>
            <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="寫下你的直覺和想法……" />
            <button className="btn primary block" disabled={note.trim().length < 5} onClick={submit}>
              {todayEntry ? '更新心得' : `記錄心得（+${XP.daily} XP 起）`}
            </button>
          </div>
          <div className="panel ai">
            <h3>🤖 請 AI 老師回饋</h3>
            <p className="small muted">複製提示詞（已包含你的牌和心得），貼到你常用的 AI。</p>
            <CopyButton text={dailyPrompt(card, note)} />
          </div>
        </>
      )}

      {save.journal.length > 0 && (
        <>
          <h3>📔 塔羅日記</h3>
          <ul className="journal">
            {[...save.journal].reverse().slice(0, 30).map((j) => {
              const c = cardById(j.cardId)
              return (
                <li key={j.date} className="journal-item">
                  <img src={c.image} alt={c.nameZh} />
                  <div>
                    <div className="small muted">{j.date}・{c.nameZh}</div>
                    <div className="small">{j.note}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
