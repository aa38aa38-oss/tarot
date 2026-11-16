import type { GameCtx } from '../App'
import { CHAPTERS } from '../data/world'
import { cardById } from '../data/majorArcana'
import { battleReady } from '../lib/progress'

export default function ChapterScreen({ ctx, chapterId }: { ctx: GameCtx; chapterId: string }) {
  const { save, go } = ctx
  const ch = CHAPTERS.find((c) => c.id === chapterId)!
  const ready = battleReady(save, ch)
  const done = save.clearedChapters.includes(ch.id)

  return (
    <div className="stack">
      <button className="back" onClick={() => go({ name: 'map' })}>← 返回地圖</button>
      <h1>{ch.title}</h1>
      <p className="muted">{ch.subtitle}</p>

      <h3>📖 學習</h3>
      {ch.id === 'c0' && (
        <button className={`lesson-item ${save.basicsDone ? 'done' : ''}`} onClick={() => go({ name: 'basics' })}>
          <span className="lesson-thumb emoji">🃏</span>
          <span><strong>塔羅入門課</strong><br /><span className="small muted">78 張牌的結構、四花色、正逆位</span></span>
          <span>{save.basicsDone ? '✅' : '→'}</span>
        </button>
      )}
      {ch.id === 'boss' && <p className="panel small">這是最終試煉，題目會從 22 張大牌中隨機出題。準備好了嗎？</p>}
      <div className="lesson-grid">
        {ch.cardIds.map((id) => {
          const c = cardById(id)
          const got = save.collected.includes(id)
          return (
            <button key={id} className={`lesson-card ${got ? 'done' : ''}`} onClick={() => go({ name: 'lesson', cardId: id, chapterId: ch.id })}>
              <img src={c.image} alt={c.nameZh} loading="lazy" />
              <span className="lesson-card-name">{c.roman}・{c.nameZh}</span>
              <span className="lesson-card-badge">{got ? '✅ 已收服' : '未學習'}</span>
            </button>
          )
        })}
      </div>

      <h3>⚔️ 戰鬥</h3>
      <div className="panel monster-preview">
        <div className="monster-emoji big">{ch.monster.emoji}</div>
        <div>
          <strong>{ch.monster.name}</strong>
          <p className="small muted">HP {ch.monster.hp}・攻擊 {ch.monster.attack}・獎勵 {ch.xpReward} XP{done ? '（重複挑戰獎勵減半）' : ''}</p>
        </div>
      </div>
      <button className="btn primary block" disabled={!ready} onClick={() => go({ name: 'battle', mode: { kind: 'chapter', chapterId: ch.id } })}>
        {ready ? (done ? '再次挑戰' : '開始戰鬥！') : ch.id === 'c0' ? '先完成入門課' : '先學完本章所有的牌'}
      </button>
    </div>
  )
}
