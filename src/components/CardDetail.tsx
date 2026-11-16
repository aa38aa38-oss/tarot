import { useState } from 'react'
import { TarotCard } from '../data/majorArcana'
import { copyText, lessonPrompt } from '../lib/prompts'

export function CopyButton({ text, label = '📋 複製 AI 提示詞', onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn ghost"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          onCopied?.()
          setTimeout(() => setDone(false), 2000)
        }
      }}
    >
      {done ? '✅ 已複製！貼到你的 AI 吧' : label}
    </button>
  )
}

export default function CardDetail({ card, showReversed = true }: { card: TarotCard; showReversed?: boolean }) {
  return (
    <article className="card-detail">
      <div className="card-detail-top">
        <img className="card-big" src={card.image} alt={card.nameZh} />
        <div>
          <div className="card-number">{card.roman}</div>
          <h1 className="card-title">{card.nameZh}</h1>
          <div className="muted">{card.nameEn}</div>
          <div className="tag">✦ {card.astro}</div>
          <div className="keywords">
            {card.keywordsUp.map((k) => <span key={k} className="kw">{k}</span>)}
          </div>
        </div>
      </div>

      <section className="panel">
        <h3>☀️ 正位牌義</h3>
        <p>{card.upright}</p>
      </section>

      <section className="panel">
        <h3>🔍 牌面象徵</h3>
        <ul className="symbols">
          {card.symbols.map((s) => (
            <li key={s.name}><strong>{s.name}</strong>：{s.meaning}</li>
          ))}
        </ul>
      </section>

      <section className="panel journey">
        <h3>🚶 愚者之旅</h3>
        <p>{card.journey}</p>
      </section>

      <section className="panel tip">
        <h3>💡 記憶小訣竅</h3>
        <p>{card.mnemonic}</p>
      </section>

      {showReversed && (
        <details className="panel">
          <summary><strong>🔄 逆位預習</strong> <span className="small muted">（Lv 11 區域正式學習）</span></summary>
          <div className="keywords">
            {card.keywordsRev.map((k) => <span key={k} className="kw rev">{k}</span>)}
          </div>
          <p>{card.reversed}</p>
        </details>
      )}

      <section className="panel">
        <h3>🪞 想一想</h3>
        <p>{card.reflect}</p>
      </section>

      <section className="panel ai">
        <h3>🤖 問 AI 老師</h3>
        <p className="small muted">複製下面的提示詞，貼到 ChatGPT、Claude、Gemini 等 AI，讓它用故事和測驗帶你深入學習這張牌。</p>
        <CopyButton text={lessonPrompt(card)} />
      </section>
    </article>
  )
}
