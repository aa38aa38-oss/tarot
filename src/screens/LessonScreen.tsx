import type { GameCtx } from '../App'
import { cardById } from '../data/majorArcana'
import { CHAPTERS } from '../data/world'
import CardDetail from '../components/CardDetail'
import { XP } from '../lib/game'

export default function LessonScreen({ ctx, cardId, chapterId }: { ctx: GameCtx; cardId: string; chapterId?: string }) {
  const { save, setSave, gainXp, go } = ctx
  const card = cardById(cardId)
  const got = save.collected.includes(cardId)
  const ch = CHAPTERS.find((c) => c.id === chapterId)
  const nextId = ch ? ch.cardIds[ch.cardIds.indexOf(cardId) + 1] : undefined

  const collect = () => {
    setSave((s) => ({ ...s, collected: [...s.collected, cardId] }))
    gainXp(XP.lesson, `收服「${card.nameZh}」`)
  }

  return (
    <div className="stack">
      <button className="back" onClick={() => go(ch ? { name: 'chapter', id: ch.id } : { name: 'codex' })}>
        ← {ch ? ch.title : '圖鑑'}
      </button>
      <CardDetail card={card} />
      <div className="sticky-actions">
        {!got ? (
          <button className="btn primary block" onClick={collect}>✨ 我學會了，收服這張牌（+{XP.lesson} XP）</button>
        ) : nextId ? (
          <button className="btn primary block" onClick={() => go({ name: 'lesson', cardId: nextId, chapterId })}>
            下一張：{cardById(nextId).nameZh} →
          </button>
        ) : ch ? (
          <button className="btn primary block" onClick={() => go({ name: 'chapter', id: ch.id })}>回到章節，準備戰鬥 ⚔️</button>
        ) : null}
      </div>
    </div>
  )
}
