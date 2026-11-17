import { useMemo, useState } from 'react'
import type { GameCtx } from '../App'
import { MAJOR_ARCANA, cardById } from '../data/majorArcana'
import { XP, today, yesterday } from '../lib/game'
import { dailyPrompt } from '../lib/prompts'
import { CopyButton } from '../components/CardDetail'
import { PHRASES } from '../data/readingPhrases'
import { shuffle } from '../lib/game'

const MOODS = ['😄 很好', '🙂 不錯', '😐 普通', '😟 有點煩', '😢 低落']

export default function DailyScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, gainXp } = ctx
  const todayEntry = save.journal.find((j) => j.date === today())
  const [drawn, setDrawn] = useState<string | null>(todayEntry?.cardId ?? null)
  const [flipping, setFlipping] = useState(false)
  const [keyword, setKeyword] = useState<string | null>(null)
  const [mood, setMood] = useState<string | null>(null)
  const [advice, setAdvice] = useState<number | null>(null)
  const card = drawn ? cardById(drawn) : null
  // 小測驗：這張牌今天給你的建議是？（正解＋兩張其他牌的建議）
  const adviceOpts = useMemo(() => {
    if (!card) return []
    const others = shuffle(MAJOR_ARCANA.filter((c) => c.id !== card.id)).slice(0, 2)
    return shuffle([{ text: PHRASES[card.id].advice, ok: true }, ...others.map((o) => ({ text: PHRASES[o.id].advice, ok: false }))])
  }, [card])
  const adviceOk = advice !== null && adviceOpts[advice].ok
  const note = todayEntry && !keyword
    ? todayEntry.note
    : [keyword && `今天最貼近我的關鍵字：${keyword}`, mood && `心情：${mood}`, card && advice !== null && `牌給我的建議：${PHRASES[card.id].advice}`].filter(Boolean).join('；')

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
      const quiz = adviceOk ? 5 : 0
      gainXp(XP.daily + bonus + quiz, bonus ? `每日一抽（連續 ${streak} 天）` : '每日一抽')
    } else ctx.toast('📝 日記已更新')
  }

  return (
    <div className="stack">
      <h1>🌅 每日一抽</h1>
      <p className="muted small">每天抽一張大牌，點選今天的關鍵字和心情，再回答一題小測驗。連續天數越多，獎勵越多！目前連續 {save.streak} 天。</p>

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
          <div className="panel stack daily-pick">
            <div>
              <label className="label">① 今天哪個關鍵字最貼近你？</label>
              <div className="chips">
                {card.keywordsUp.map((k) => <button key={k} className={keyword === k ? 'chip active' : 'chip'} onClick={() => setKeyword(k)}>{k}</button>)}
              </div>
            </div>
            <div>
              <label className="label">② 今天的心情？</label>
              <div className="chips">
                {MOODS.map((m) => <button key={m} className={mood === m ? 'chip active' : 'chip'} onClick={() => setMood(m)}>{m}</button>)}
              </div>
            </div>
            <div>
              <label className="label">③ 小測驗：{card.nameZh}今天給你的建議是？<span className="small muted">（答對 +5 XP）</span></label>
              <div className="phrase-list">
                {adviceOpts.map((o, i) => (
                  <button key={o.text} disabled={advice !== null}
                    className={`phrase ${advice !== null && o.ok ? 'correct' : ''} ${advice === i && !o.ok ? 'wrong' : ''}`}
                    onClick={() => setAdvice(i)}>{o.text}</button>
                ))}
              </div>
            </div>
            <p className="small muted">🪞 想一想：{card.reflect}</p>
            <button className="btn primary block" disabled={!keyword || !mood || advice === null} onClick={submit}>
              {todayEntry ? '更新日記' : `記錄到塔羅日記（+${XP.daily} XP 起）`}
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
