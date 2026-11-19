import type { Question } from '../lib/questions'

// 題目＋選項，戰鬥與測驗共用
export default function QuestionCard({ q, picked, onAnswer, compact, hidden = [], reveal = true }: { q: Question; picked: number | null; onAnswer: (i: number) => void; compact?: boolean; hidden?: number[]; reveal?: boolean }) {
  const answered = picked !== null
  const isImageOptions = q.options.some((o) => o.image)
  return (
    <>
      <div className={compact ? 'question compact' : 'question panel'}>
        {q.image && (
          <div className="q-image hide-name">
            <img src={q.image} alt="題目牌面" />
          </div>
        )}
        <p className="pre q-text">{q.prompt}</p>
      </div>
      <div className={isImageOptions ? 'options images' : compact ? 'options two' : 'options'}>
        {q.options.map((o, i) => {
          let cls = 'option'
          if (answered && reveal && i === q.answer) cls += ' correct'
          else if (answered && i === picked) cls += ' wrong'
          if (hidden.includes(i) && !(answered && i === q.answer)) cls += ' eliminated'
          return (
            <button key={i} className={cls} onClick={() => onAnswer(i)} disabled={answered || hidden.includes(i)}>
              {o.image ? <span className="hide-name"><img src={o.image} alt={`選項 ${i + 1}`} /></span> : o.label}
              {o.image && answered && <span className="small opt-caption">{o.label}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}
