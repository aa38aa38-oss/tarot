import { useState } from 'react'
import type { GameCtx } from '../App'
import { BASICS_SLIDES } from '../data/world'
import { XP } from '../lib/game'

export default function BasicsScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, gainXp, go } = ctx
  const [i, setI] = useState(0)
  const slide = BASICS_SLIDES[i]
  const last = i === BASICS_SLIDES.length - 1

  const finish = () => {
    if (!save.basicsDone) {
      setSave((s) => ({ ...s, basicsDone: true }))
      gainXp(XP.basics, '完成塔羅入門課')
    }
    go({ name: 'chapter', id: 'c0' })
  }

  return (
    <div className="stack">
      <button className="back" onClick={() => go({ name: 'chapter', id: 'c0' })}>← 序章</button>
      <div className="slide panel">
        <div className="slide-emoji">{slide.emoji}</div>
        <h2>{slide.title}</h2>
        <p className="pre">{slide.body}</p>
      </div>
      <div className="dots">
        {BASICS_SLIDES.map((_, k) => <span key={k} className={k === i ? 'dot active' : 'dot'} />)}
      </div>
      <div className="row">
        <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← 上一頁</button>
        {last ? (
          <button className="btn primary grow" onClick={finish}>完成入門課{save.basicsDone ? '' : `（+${XP.basics} XP）`}</button>
        ) : (
          <button className="btn primary grow" onClick={() => setI(i + 1)}>下一頁 →</button>
        )}
      </div>
    </div>
  )
}
