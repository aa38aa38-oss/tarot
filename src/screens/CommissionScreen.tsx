import { useMemo, useState } from 'react'
import type { GameCtx } from '../App'
import { COMMISSIONS } from '../data/world'
import { cardById } from '../data/majorArcana'
import { PHRASES } from '../data/readingPhrases'
import { COMMISSIONS_PER_DAY, levelInfo, shuffle, today } from '../lib/game'
import {
  COMMISSION_TYPES, CommissionType, Slot, distractors, makeAdvice, makeApprentices, makeSlots, makeSpot, starsFor,
} from '../lib/reading'
import { commissionPrompt } from '../lib/prompts'
import { deriveStats } from '../lib/powers'
import { CopyButton } from '../components/CardDetail'
import { sfx } from '../lib/sfx'

interface Job { idx: number; type: CommissionType; slots: Slot[] }
// 每個步驟回報：答對幾題、共幾題、玩家選了什麼（給 AI 提示詞用）
type Report = (right: number, total: number, picks: string[]) => void

export default function CommissionScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, gainXp, toast } = ctx
  const level = levelInfo(save.xp).level
  const [job, setJob] = useState<Job | null>(null)
  const [step, setStep] = useState<'main' | 'advice' | 'done'>('main')
  const [score, setScore] = useState({ right: 0, total: 0 })
  const [picks, setPicks] = useState<string[]>([])
  const doneToday = save.commissionDates.filter((d) => d === today()).length
  const remaining = COMMISSIONS_PER_DAY - doneToday
  const unlocked = COMMISSION_TYPES.filter((t) => level >= t.level)

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

  const accept = (type: CommissionType | 'random') => {
    sfx.select()
    const t = type === 'random' ? unlocked[Math.floor(Math.random() * unlocked.length)].type : type
    const idx = Math.floor(Math.random() * COMMISSIONS.length)
    const cards = shuffle(save.collected).slice(0, 3).map(cardById)
    setJob({ idx, type: t, slots: makeSlots(COMMISSIONS[idx].spread, cards) })
    setStep('main')
    setScore({ right: 0, total: 0 })
    setPicks([])
  }

  const report: Report = (right, total, p) => {
    setScore((s) => ({ right: s.right + right, total: s.total + total }))
    setPicks((x) => [...x, ...p])
  }

  const finish = (right: number, total: number) => {
    const stars = starsFor(right, total)
    setSave((s) => ({ ...s, commissionsDone: s.commissionsDone + 1, commissionDates: [...s.commissionDates.slice(-50), today()] }))
    if (remaining > 0) gainXp(Math.round(stars * 10 * (1 + deriveStats(save).studyXpPct / 100)), `委託完成 ${'⭐'.repeat(stars)}`)
    else toast('今天的委託獎勵已領完，但練習永遠有價值！')
    stars === 3 ? sfx.victory() : sfx.correct()
    setStep('done')
  }

  // ---------- 委託看板 ----------
  if (!job) {
    return (
      <div className="stack">
        <h1>📜 委託看板</h1>
        <p className="muted small">村民帶著煩惱來找你。抽出三張牌（從你已收服的牌中），用點選的方式完成解讀。等級越高，能接的委託越進階。</p>
        <div className="panel row small">
          <span>今日剩餘獎勵：<strong>{Math.max(0, remaining)}</strong> / {COMMISSIONS_PER_DAY}</span>
          <span className="grow" />
          <span className="muted">已完成 {save.commissionsDone} 件</span>
        </div>
        <button className="btn primary block" onClick={() => accept('random')}>🎲 接一個隨機委託</button>
        <div className="ctype-grid">
          {COMMISSION_TYPES.map((t) => {
            const open = level >= t.level
            return (
              <button key={t.type} className={open ? 'ctype' : 'ctype locked'} disabled={!open} onClick={() => accept(t.type)}>
                <span className="ctype-emoji">{open ? t.emoji : '🔒'}</span>
                <strong>{t.name}</strong>
                <span className="small muted">{open ? t.desc : `Lv ${t.level} 解鎖`}</span>
              </button>
            )
          })}
        </div>
        <p className="small muted center">每個委託最後都會問：「你最想對求問者說哪一句建議？」</p>
      </div>
    )
  }

  const c = COMMISSIONS[job.idx]
  const typeInfo = COMMISSION_TYPES.find((t) => t.type === job.type)!

  return (
    <div className="stack">
      <div className="row">
        <button className="back" onClick={() => setJob(null)}>← 委託看板</button>
        <span className="grow" />
        <span className="tag">{typeInfo.emoji} {typeInfo.name}</span>
      </div>
      <div className="panel npc">
        <span className="big">{c.emoji}</span>
        <div>
          <strong>{c.npc}</strong>
          <p>「{c.question}」</p>
        </div>
      </div>

      <div className="spread">
        {job.slots.map((s) => (
          <div key={s.card.id} className="spread-slot">
            <span className="small muted">{s.position}</span>
            <img src={s.card.image} alt={s.card.nameZh} />
            <strong className="small">{s.card.nameZh}</strong>
          </div>
        ))}
      </div>

      {step === 'main' && (
        <>
          {job.type === 'match' && <MatchStep slots={job.slots} onDone={(r, t, p) => { report(r, t, p); setStep('advice') }} />}
          {job.type === 'cloze' && <ClozeStep slots={job.slots} onDone={(r, t, p) => { report(r, t, p); setStep('advice') }} />}
          {job.type === 'pick' && <PickStep slots={job.slots} onDone={(r, t, p) => { report(r, t, p); setStep('advice') }} />}
          {job.type === 'spot' && <SpotStep slots={job.slots} onDone={(r, t, p) => { report(r, t, p); setStep('advice') }} />}
        </>
      )}
      {step === 'advice' && (
        <AdviceStep slots={job.slots} npc={c.npc} onDone={(r, t, p) => { report(r, t, p); finish(score.right + r, score.total + t) }} />
      )}
      {step === 'done' && (
        <ResultPanel
          stars={starsFor(score.right, score.total)} right={score.right} total={score.total} npc={c.npc} emoji={c.emoji} rewarded={remaining > 0}
          prompt={commissionPrompt(c.question, job.slots, picks)}
          onNext={() => accept('random')} onBoard={() => setJob(null)}
        />
      )}
    </div>
  )
}

// ---------- 牌位配對 ----------
function MatchStep({ slots, onDone }: { slots: Slot[]; onDone: Report }) {
  const phrases = useMemo(() => {
    // 兩句干擾：取兩張沒被抽到的牌，分別用第一、第三個牌位的句子
    const d = distractors(slots, slots[0].posType, 2)
    return shuffle([...slots.map((s) => s.phrase), d[0].text, PHRASES[d[1].card.id][slots[2].posType]])
  }, [slots])
  const [active, setActive] = useState(0)
  const [assign, setAssign] = useState<(string | null)[]>(slots.map(() => null))
  const [checked, setChecked] = useState(false)

  const pickPhrase = (p: string) => {
    if (checked) return
    sfx.select()
    const next = assign.map((a) => (a === p ? null : a))
    next[active] = p
    setAssign(next)
    const empty = next.findIndex((a) => a === null)
    if (empty >= 0) setActive(empty)
  }

  const right = assign.filter((a, i) => a === slots[i].phrase).length
  return (
    <div className="panel">
      <h3>🔗 把每張牌連到正確的意思</h3>
      <p className="small muted">先點上面的牌位，再點下面的句子。有 2 句是混淆用的。</p>
      <div className="match-slots">
        {slots.map((s, i) => (
          <button key={i} className={`match-slot ${active === i && !checked ? 'active' : ''} ${checked ? (assign[i] === s.phrase ? 'correct' : 'wrong') : ''}`} onClick={() => !checked && setActive(i)}>
            <span className="small muted">{s.position}・{s.card.nameZh}</span>
            <span className="match-text">{assign[i] ?? '（點選下方句子）'}</span>
            {checked && assign[i] !== s.phrase && <span className="small fix">✔ 正解：{s.phrase}</span>}
          </button>
        ))}
      </div>
      {!checked && (
        <div className="phrase-list">
          {phrases.map((p) => (
            <button key={p} className={assign.includes(p) ? 'phrase used' : 'phrase'} onClick={() => pickPhrase(p)}>{p}</button>
          ))}
        </div>
      )}
      {!checked ? (
        <button className="btn primary block" disabled={assign.some((a) => a === null)} onClick={() => { setChecked(true); right === slots.length ? sfx.correct() : sfx.wrong() }}>確認配對</button>
      ) : (
        <button className="btn primary block" onClick={() => onDone(right, slots.length, slots.map((s, i) => `${s.position}的${s.card.nameZh}：${assign[i]}`))}>
          答對 {right}/{slots.length}，下一步 →
        </button>
      )}
    </div>
  )
}

// ---------- 克漏字 ----------
function ClozeStep({ slots, onDone }: { slots: Slot[]; onDone: Report }) {
  const opts = useMemo(() => slots.map((s) => shuffle([s.phrase, ...distractors(slots, s.posType, 2).map((d) => d.text)])), [slots])
  const [chosen, setChosen] = useState<(string | null)[]>(slots.map(() => null))
  const [checked, setChecked] = useState(false)
  const right = chosen.filter((c, i) => c === slots[i].phrase).length
  return (
    <div className="panel">
      <h3>🧩 完成這段解讀</h3>
      <div className="cloze">
        {slots.map((s, i) => (
          <div key={i} className="cloze-line">
            <p>「{s.position}」的<strong>【{s.card.nameZh}】</strong>告訴我們：<span className={`blank ${checked ? (chosen[i] === s.phrase ? 'correct' : 'wrong') : ''}`}>{chosen[i] ?? '＿＿＿＿'}</span></p>
            {!checked && (
              <div className="chips">
                {opts[i].map((o) => (
                  <button key={o} className={chosen[i] === o ? 'chip active' : 'chip'} onClick={() => { sfx.select(); setChosen(chosen.map((c, k) => (k === i ? o : c))) }}>{o}</button>
                ))}
              </div>
            )}
            {checked && chosen[i] !== s.phrase && <p className="small fix">✔ 正解：{s.phrase}</p>}
          </div>
        ))}
      </div>
      {!checked ? (
        <button className="btn primary block" disabled={chosen.some((c) => c === null)} onClick={() => { setChecked(true); right === slots.length ? sfx.correct() : sfx.wrong() }}>確認</button>
      ) : (
        <button className="btn primary block" onClick={() => onDone(right, slots.length, slots.map((s, i) => `${s.position}的${s.card.nameZh}：${chosen[i]}`))}>答對 {right}/{slots.length}，下一步 →</button>
      )}
    </div>
  )
}

// ---------- 三位學徒 ----------
function PickStep({ slots, onDone }: { slots: Slot[]; onDone: Report }) {
  const apps = useMemo(() => makeApprentices(slots), [slots])
  const [picked, setPicked] = useState<number | null>(null)
  const ok = picked !== null && apps[picked].good
  return (
    <div className="panel">
      <h3>🧑‍🎓 三位學徒的解讀，哪一段最好？</h3>
      <div className="apprentices">
        {apps.map((a, i) => (
          <button key={i} className={`apprentice ${picked !== null ? (a.good ? 'correct' : i === picked ? 'wrong' : '') : ''}`} disabled={picked !== null}
            onClick={() => { setPicked(i); apps[i].good ? sfx.correct() : sfx.wrong() }}>
            <strong>{a.emoji} {a.name}</strong>
            <span className="small">{a.text}</span>
            {picked !== null && <span className="small why">{a.good ? '⭕ ' : '❌ '}{a.why}</span>}
          </button>
        ))}
      </div>
      {picked !== null && (
        <button className="btn primary block" onClick={() => onDone(ok ? 2 : 0, 2, [`我選了這段解讀：${apps[picked].text}`])}>{ok ? '答對了！' : '再接再厲！'}下一步 →</button>
      )}
    </div>
  )
}

// ---------- 找錯 ----------
function SpotStep({ slots, onDone }: { slots: Slot[]; onDone: Report }) {
  const spot = useMemo(() => makeSpot(slots), [slots])
  const [tapped, setTapped] = useState<number | null>(null)
  const [fix, setFix] = useState<number | null>(null)
  const foundRight = tapped === spot.wrongIdx
  return (
    <div className="panel">
      <h3>🔍 這段解讀有一句說錯了，是哪一句？</h3>
      <div className="spot-lines">
        {slots.map((s, i) => (
          <button key={i} disabled={tapped !== null}
            className={`spot-line ${tapped !== null && i === spot.wrongIdx ? 'wrong' : ''} ${tapped === i && i !== spot.wrongIdx ? 'miss' : ''}`}
            onClick={() => { setTapped(i); i === spot.wrongIdx ? sfx.correct() : sfx.wrong() }}>
            「{s.position}」的{s.card.nameZh}：{spot.shown[i]}。
          </button>
        ))}
      </div>
      {tapped !== null && (
        <>
          <p className="small">{foundRight ? '⭕ 找到了！' : '❌ 不是這句。'}說錯的是「{slots[spot.wrongIdx].position}」——那句其實是「{spot.wrongFrom.nameZh}」的意思。應該改成哪一句？</p>
          <div className="chips">
            {spot.options.map((o, i) => (
              <button key={o} disabled={fix !== null} className={`chip ${fix !== null && i === spot.answer ? 'correct' : ''} ${fix === i && i !== spot.answer ? 'wrong' : ''}`}
                onClick={() => { setFix(i); i === spot.answer ? sfx.correct() : sfx.wrong() }}>{o}</button>
            ))}
          </div>
        </>
      )}
      {fix !== null && (
        <button className="btn primary block" onClick={() => onDone((foundRight ? 1 : 0) + (fix === spot.answer ? 1 : 0), 2, slots.map((s) => `${s.position}的${s.card.nameZh}：${s.phrase}`))}>下一步 →</button>
      )}
    </div>
  )
}

// ---------- 建議 ----------
function AdviceStep({ slots, npc, onDone }: { slots: Slot[]; npc: string; onDone: Report }) {
  const adv = useMemo(() => makeAdvice(slots), [slots])
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="panel">
      <h3>💬 最後，你最想對{npc}說哪一句？</h3>
      <div className="phrase-list">
        {adv.options.map((o, i) => (
          <button key={o.text} disabled={picked !== null}
            className={`phrase ${picked !== null && i === adv.answer ? 'correct' : ''} ${picked === i && i !== adv.answer ? 'wrong' : ''}`}
            onClick={() => { setPicked(i); i === adv.answer ? sfx.correct() : sfx.wrong() }}>
            「{o.text}」
            {picked !== null && <span className="small why">{o.why}</span>}
          </button>
        ))}
      </div>
      {picked !== null && (
        <button className="btn primary block" onClick={() => onDone(picked === adv.answer ? 1 : 0, 1, [`我給的建議：${adv.options[picked].text}`])}>交付委託 →</button>
      )}
    </div>
  )
}

function ResultPanel(p: { stars: number; right: number; total: number; npc: string; emoji: string; rewarded: boolean; prompt: string; onNext: () => void; onBoard: () => void }) {
  const reaction = p.stars === 3 ? '「太準了！我知道接下來該怎麼做了，謝謝你！」' : p.stars === 2 ? '「嗯……有幾個地方讓我想通了，謝謝你。」' : '「好像有點聽不太懂……不過還是謝謝你。」'
  return (
    <div className="panel center result-panel">
      <div className="big">{p.emoji}</div>
      <div className="stars-big">{'⭐'.repeat(p.stars)}{'☆'.repeat(3 - p.stars)}</div>
      <p><strong>{p.npc}：</strong>{reaction}</p>
      <p className="small muted">答對 {p.right}/{p.total}{p.rewarded ? `・獲得 ${p.stars * 10} XP` : '・今日獎勵已領完'}</p>
      <div className="panel ai">
        <p className="small muted">想看完整的示範解讀？複製提示詞（已包含問題、牌陣和你的選擇）貼到 AI。</p>
        <CopyButton text={p.prompt} />
      </div>
      <div className="row">
        <button className="btn ghost" onClick={p.onBoard}>委託看板</button>
        <button className="btn primary grow" onClick={p.onNext}>下一個委託 →</button>
      </div>
    </div>
  )
}
