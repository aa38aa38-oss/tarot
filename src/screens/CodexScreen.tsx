import { useState } from 'react'
import type { GameCtx } from '../App'
import { MAJOR_ARCANA } from '../data/majorArcana'
import CardDetail from '../components/CardDetail'
import { guardianText } from '../lib/powers'

const SUITS = [
  { emoji: '🪄', name: '權杖', el: '火' },
  { emoji: '🏆', name: '聖杯', el: '水' },
  { emoji: '⚔️', name: '寶劍', el: '風' },
  { emoji: '🪙', name: '錢幣', el: '土' },
]

export default function CodexScreen({ ctx }: { ctx: GameCtx }) {
  const { save } = ctx
  const [open, setOpen] = useState<string | null>(null)
  const card = open ? MAJOR_ARCANA.find((c) => c.id === open)! : null

  if (card) {
    return (
      <div className="stack">
        <button className="back" onClick={() => setOpen(null)}>← 圖鑑</button>
        <Mastery box={save.cardStats[card.id]?.box ?? 0} stat={save.cardStats[card.id]} />
        <div className="panel small">🛡️ 當作守護牌時：<strong>{guardianText(save, card.id)}</strong><span className="muted">（熟練度越高越強）</span></div>
        <CardDetail card={card} />
      </div>
    )
  }

  return (
    <div className="stack">
      <button className="back" onClick={ctx.back}>← 返回</button>
      <h1>📖 卡牌圖鑑</h1>
      <p className="muted small">已收服 {save.collected.length} / 78。學完一張牌就能收服它；答題越熟練，星星越多。</p>

      <h3>🌟 大阿爾克那（{save.collected.length}/22）</h3>
      <div className="codex-grid">
        {MAJOR_ARCANA.map((c) => {
          const got = save.collected.includes(c.id)
          const box = save.cardStats[c.id]?.box ?? 0
          return (
            <button key={c.id} className={got ? 'codex-card' : 'codex-card unknown'} disabled={!got} onClick={() => setOpen(c.id)}>
              {got ? <img src={c.image} alt={c.nameZh} loading="lazy" /> : <div className="card-back"><span>{c.roman}</span></div>}
              <span className="codex-name">{got ? c.nameZh : '？？？'}</span>
              {got && <span className="stars">{'★'.repeat(box)}{'☆'.repeat(5 - box)}</span>}
            </button>
          )
        })}
      </div>

      <h3>🌿 小阿爾克那（0/56）</h3>
      <div className="suit-row">
        {SUITS.map((s) => (
          <div key={s.name} className="suit-locked">
            <span className="big">{s.emoji}</span>
            <strong>{s.name}</strong>
            <span className="small muted">{s.el}・14 張</span>
            <span className="small muted">🔒 Lv 21</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Mastery({ box, stat }: { box: number; stat?: { correct: number; wrong: number } }) {
  return (
    <div className="panel row small">
      <span className="stars">{'★'.repeat(box)}{'☆'.repeat(5 - box)}</span>
      <span className="muted">熟練度</span>
      <span className="grow" />
      {stat && <span className="muted">答對 {stat.correct}・答錯 {stat.wrong}</span>}
    </div>
  )
}
