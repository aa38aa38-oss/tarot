import { useState } from 'react'
import type { GameCtx } from '../App'
import { cardById } from '../data/majorArcana'
import { levelInfo } from '../lib/game'
import {
  GUARDIAN_SLOT_LEVELS, GUARDIANS, SKILL_TIERS, Skill, guardianSlots, guardianText, masteryOf, pendingSkillTier,
} from '../lib/powers'
import { sfx } from '../lib/sfx'

const stars = (box: number) => '★'.repeat(box) + '☆'.repeat(5 - box)

export function SkillsPanel({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, toast } = ctx
  const level = levelInfo(save.xp).level
  const learned = save.skills ?? []
  const pending = pendingSkillTier(save)
  const [confirm, setConfirm] = useState<Skill | null>(null)

  const learn = (s: Skill) => {
    sfx.victory()
    setSave((sv) => ({ ...sv, skills: [...(sv.skills ?? []), s.id] }))
    toast(`✨ 學會了「${s.name}」！`)
    setConfirm(null)
  }

  return (
    <div className="stack">
      {pending && (
        <div className="panel skill-choice">
          <h3>✨ Lv {pending.level} 新技能：二選一</h3>
          <p className="small muted">選了之後就不能更改，想清楚喔！</p>
          <div className="skill-pair">
            {pending.options.map((o) => (
              <button key={o.id} className={confirm?.id === o.id ? 'skill-card active' : 'skill-card'} onClick={() => setConfirm(o)}>
                <span className="skill-emoji">{o.emoji}</span>
                <strong>{o.name}</strong>
                <span className="tag small">{o.kind}</span>
                <span className="small">{o.desc}</span>
              </button>
            ))}
          </div>
          {confirm && <button className="btn primary block" onClick={() => learn(confirm)}>確定學習「{confirm.name}」</button>}
        </div>
      )}
      <ul className="skill-list">
        {SKILL_TIERS.map((t) => {
          const got = t.options.find((o) => learned.includes(o.id))
          return (
            <li key={t.level} className={got ? 'got' : ''}>
              <span className="skill-lv">Lv {t.level}</span>
              {got ? (
                <span><strong>{got.emoji} {got.name}</strong> <span className="small muted">{got.desc}</span></span>
              ) : level >= t.level ? (
                <span className="small" style={{ color: 'var(--gold)' }}>可以選擇新技能！</span>
              ) : (
                <span className="small muted">{t.options.map((o) => o.name).join(' ／ ')}（二選一）</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function GuardiansPanel({ ctx }: { ctx: GameCtx }) {
  const { save, setSave } = ctx
  const level = levelInfo(save.xp).level
  const slots = guardianSlots(level)
  const equipped = (save.guardians ?? []).slice(0, slots)
  const [picking, setPicking] = useState<number | null>(null)

  const equip = (slot: number, cardId: string | null) => {
    sfx.select()
    setSave((s) => {
      const g = [...(s.guardians ?? [])].filter((id) => id !== cardId).slice(0, slots)
      if (cardId) g[slot] = cardId
      else g.splice(slot, 1)
      return { ...s, guardians: g.filter(Boolean) }
    })
    setPicking(null)
  }

  return (
    <div className="stack">
      <p className="small muted">
        把收服的大牌裝在身上，獲得與牌義相關的能力。<strong>守護牌的強度＝你對那張牌的熟練度</strong>（答對會提升、答錯會下降），所以要常常複習喔！
      </p>
      <div className="guardian-slots">
        {GUARDIAN_SLOT_LEVELS.map((lv, i) => {
          const id = equipped[i]
          if (level < lv) return <div key={i} className="g-slot locked">🔒<span className="small">Lv {lv}</span></div>
          return (
            <button key={i} className={picking === i ? 'g-slot active' : 'g-slot'} onClick={() => setPicking(picking === i ? null : i)}>
              {id ? (
                <>
                  <img src={cardById(id).image} alt={cardById(id).nameZh} />
                  <strong className="small">{cardById(id).nameZh}</strong>
                  <span className="stars">{stars(masteryOf(save, id))}</span>
                  <span className="small g-effect">{guardianText(save, id)}</span>
                </>
              ) : (
                <span className="small muted">＋ 點這裡裝備</span>
              )}
            </button>
          )
        })}
      </div>
      {slots === 0 && <p className="small muted center">Lv 3 開放第一個守護牌欄位。</p>}

      {picking !== null && (
        <div className="panel">
          <div className="row">
            <h3 className="grow">選擇守護牌</h3>
            {equipped[picking] && <button className="btn ghost small" onClick={() => equip(picking, null)}>卸下</button>}
          </div>
          <div className="g-pick-list">
            {save.collected.filter((id) => GUARDIANS[id]).map((id) => {
              const c = cardById(id)
              const on = equipped.includes(id)
              return (
                <button key={id} className={on ? 'g-pick on' : 'g-pick'} onClick={() => equip(picking, id)}>
                  <img src={c.image} alt={c.nameZh} />
                  <span className="g-pick-text">
                    <strong>{c.nameZh}</strong> <span className="stars">{stars(masteryOf(save, id))}</span>
                    <span className="small">{guardianText(save, id)}</span>
                    {on && <span className="small muted">（裝備中）</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
