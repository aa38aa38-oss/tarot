import { useState } from 'react'
import type { GameCtx } from '../App'
import { COMMISSIONS } from '../data/world'
import { cardById } from '../data/majorArcana'
import { COMMISSIONS_PER_DAY, XP, shuffle, today } from '../lib/game'
import { readingPrompt } from '../lib/prompts'
import { CopyButton } from '../components/CardDetail'

export default function CommissionScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, gainXp, toast } = ctx
  const [job, setJob] = useState<{ idx: number; cards: string[] } | null>(null)
  const [reading, setReading] = useState('')
  const [copied, setCopied] = useState(false)
  const doneToday = save.commissionDates.filter((d) => d === today()).length
  const remaining = COMMISSIONS_PER_DAY - doneToday

  if (save.collected.length < 3) {
    return (
      <div className="stack">
        <h1>📜 委託看板</h1>
        <div className="panel center">
          <div className="big">🔒</div>
          <p>村民們想請你幫忙占卜，但你還不夠熟練。</p>
          <p className="small muted">收服 3 張牌後開放（目前 {save.collected.length}/3）</p>
        </div>
      </div>
    )
  }

  const accept = () => {
    setJob({
      idx: Math.floor(Math.random() * COMMISSIONS.length),
      cards: shuffle(save.collected).slice(0, 3),
    })
    setReading('')
    setCopied(false)
  }

  const complete = () => {
    setSave((s) => ({ ...s, commissionsDone: s.commissionsDone + 1, commissionDates: [...s.commissionDates.slice(-50), today()] }))
    if (remaining > 0) gainXp(XP.commission, '完成委託')
    else toast('今天的委託獎勵已領完，但練習永遠有價值！')
    setJob(null)
  }

  if (!job) {
    return (
      <div className="stack">
        <h1>📜 委託看板</h1>
        <p className="muted small">村民帶著煩惱來找你。抽出三張牌（從你已收服的牌中），寫下你的解讀，再複製提示詞請 AI 老師批改。</p>
        <div className="panel">
          <p>今日剩餘獎勵次數：<strong>{Math.max(0, remaining)}</strong> / {COMMISSIONS_PER_DAY}</p>
          <p className="small muted">已完成委託：{save.commissionsDone} 件</p>
          <button className="btn primary block" onClick={accept}>接下一個委託</button>
        </div>
        <div className="panel small muted">
          💡 解讀小技巧：<br />
          1. 先看每張牌在它的「位置」代表什麼<br />
          2. 再把三張牌串成一個故事<br />
          3. 最後回到求問者的問題，給出溫柔、可行的建議
        </div>
      </div>
    )
  }

  const c = COMMISSIONS[job.idx]
  const cards = job.cards.map((id, i) => ({ position: c.spread[i], card: cardById(id) }))

  return (
    <div className="stack">
      <button className="back" onClick={() => setJob(null)}>← 委託看板</button>
      <div className="panel npc">
        <span className="big">{c.emoji}</span>
        <div>
          <strong>{c.npc}</strong>
          <p>「{c.question}」</p>
        </div>
      </div>

      <div className="spread">
        {cards.map(({ position, card }) => (
          <div key={card.id} className="spread-slot">
            <span className="small muted">{position}</span>
            <img src={card.image} alt={card.nameZh} />
            <strong className="small">{card.nameZh}</strong>
            <span className="small muted">{card.keywordsUp.slice(0, 2).join('、')}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <label className="label">✍️ 你的解讀</label>
        <textarea rows={6} value={reading} onChange={(e) => setReading(e.target.value)} placeholder={`例如：「${cards[0].position}」的${cards[0].card.nameZh}代表……`} />
      </div>

      <div className="panel ai">
        <h3>🤖 請 AI 老師批改</h3>
        <p className="small muted">提示詞已包含問題、牌陣和你的解讀。複製後貼到 ChatGPT、Claude、Gemini 等 AI，它會給你分數和建議。</p>
        <CopyButton text={readingPrompt(c.question, cards, reading)} onCopied={() => setCopied(true)} />
      </div>

      <button className="btn primary block" disabled={reading.trim().length < 20} onClick={complete}>
        完成委託{remaining > 0 ? `（+${XP.commission} XP）` : ''}
      </button>
      {reading.trim().length < 20 && <p className="small muted center">解讀至少寫 20 個字才能交付委託</p>}
      {copied && <p className="small muted center">看完 AI 的回饋後，可以回來修改你的解讀再交付喔！</p>}
    </div>
  )
}
