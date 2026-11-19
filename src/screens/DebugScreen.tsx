import type { GameCtx } from '../App'
import { CHAPTERS } from '../data/world'
import { MAJOR_ARCANA } from '../data/majorArcana'
import { ZONES, zoneEntry } from '../data/overworld'
import { CardStat, levelInfo, xpForLevel } from '../lib/game'
import { SKILL_TIERS, guardianSlots } from '../lib/powers'
import { sfx } from '../lib/sfx'

// 🚪 密門：測試用，可以直接調整等級、技能、牌，並挑選任何敵人來戰鬥
export default function DebugScreen({ ctx }: { ctx: GameCtx }) {
  const { save, setSave, go, back, toast } = ctx
  const level = levelInfo(save.xp).level
  const skills = save.skills ?? []
  const avgBox = MAJOR_ARCANA.length
    ? Math.round(MAJOR_ARCANA.reduce((a, c) => a + (save.cardStats[c.id]?.box ?? 0), 0) / MAJOR_ARCANA.length)
    : 0

  const setLevel = (lv: number) => {
    const target = Math.max(1, Math.min(20, lv))
    // 降級時，把超過等級的技能與守護牌一起移除
    setSave((s) => ({
      ...s,
      xp: xpForLevel(target),
      skills: (s.skills ?? []).filter((id) => SKILL_TIERS.some((t) => t.level <= target && t.options.some((o) => o.id === id))),
      guardians: (s.guardians ?? []).slice(0, guardianSlots(target)),
    }))
    sfx.select()
  }

  const setSkill = (tierLevel: number, id: string | null) => {
    const tier = SKILL_TIERS.find((t) => t.level === tierLevel)!
    setSave((s) => {
      const rest = (s.skills ?? []).filter((x) => !tier.options.some((o) => o.id === x))
      const next = id ? [...rest, id] : rest
      const xp = id && levelInfo(s.xp).level < tierLevel ? xpForLevel(tierLevel) : s.xp
      return { ...s, skills: next, xp }
    })
    sfx.select()
  }

  const setMastery = (box: number) => {
    setSave((s) => {
      const stats: Record<string, CardStat> = { ...s.cardStats }
      for (const c of MAJOR_ARCANA) {
        const o = stats[c.id] ?? { correct: 0, wrong: 0, box: 0, lastSeen: 0 }
        stats[c.id] = { ...o, box, lastSeen: Date.now() }
      }
      return { ...s, cardStats: stats }
    })
    sfx.select()
  }

  const fight = (mode: Parameters<typeof go>[0]) => { sfx.charge(); go(mode) }

  return (
    <div className="stack debug">
      <button className="back" onClick={back}>← 返回</button>
      <h1>🚪 密門</h1>
      <p className="small muted">測試模式：在這裡調整的內容會直接寫進存檔。戰鬥結果（經驗值、通關）也會照常計算。</p>

      <section className="panel stack">
        <h3>⭐ 等級</h3>
        <div className="row">
          <button className="btn" onClick={() => setLevel(level - 1)}>－</button>
          <strong className="grow center debug-lv">Lv {level}</strong>
          <button className="btn" onClick={() => setLevel(level + 1)}>＋</button>
        </div>
        <input type="range" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="等級" />
        <div className="chips">
          {[1, 3, 5, 7, 10, 15, 20].map((lv) => (
            <button key={lv} className={lv === level ? 'chip active' : 'chip'} onClick={() => setLevel(lv)}>Lv {lv}</button>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h3>✨ 技能</h3>
        <p className="small muted">選技能時如果等級不夠，會自動升到該等級。</p>
        {SKILL_TIERS.map((t) => {
          const cur = t.options.find((o) => skills.includes(o.id))?.id ?? null
          return (
            <div key={t.level} className="debug-skill">
              <span className="skill-lv">Lv {t.level}</span>
              <div className="chips">
                <button className={cur === null ? 'chip active' : 'chip'} onClick={() => setSkill(t.level, null)}>無</button>
                {t.options.map((o) => (
                  <button key={o.id} className={cur === o.id ? 'chip active' : 'chip'} onClick={() => setSkill(t.level, o.id)}>{o.emoji} {o.name}</button>
                ))}
              </div>
            </div>
          )
        })}
        <button className="btn ghost small" onClick={() => go({ name: 'profile' })}>🛡️ 到角色頁裝備守護牌</button>
      </section>

      <section className="panel stack">
        <h3>🃏 牌與進度</h3>
        <div className="row">
          <button className="btn grow" onClick={() => { setSave((s) => ({ ...s, collected: MAJOR_ARCANA.map((c) => c.id), basicsDone: true })); toast('已收服全部 22 張大牌') }}>收服全部大牌</button>
          <button className="btn ghost" onClick={() => setSave((s) => ({ ...s, collected: [], guardians: [] }))}>清空</button>
        </div>
        <div className="row">
          <button className="btn grow" onClick={() => { setSave((s) => ({ ...s, clearedChapters: CHAPTERS.map((c) => c.id), basicsDone: true })); toast('所有章節已通關') }}>全部章節通關</button>
          <button className="btn ghost" onClick={() => setSave((s) => ({ ...s, clearedChapters: [] }))}>重置</button>
        </div>
        <label className="label">所有牌的熟練度（影響守護牌強度與出題難度）：{'★'.repeat(avgBox)}{'☆'.repeat(5 - avgBox)}</label>
        <div className="chips">
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <button key={b} className={b === avgBox ? 'chip active' : 'chip'} onClick={() => setMastery(b)}>{b}★</button>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h3>⚔️ 守門人與 Boss</h3>
        <div className="debug-grid">
          {CHAPTERS.map((ch) => (
            <button key={ch.id} className={ch.monster.boss ? 'debug-foe boss' : 'debug-foe'} onClick={() => fight({ name: 'battle', mode: { kind: 'chapter', chapterId: ch.id, from: 'debug' } })}>
              <span className="big">{ch.monster.emoji}</span>
              <strong className="small">{ch.monster.name}</strong>
              <span className="small muted">{ch.title.split('・')[0]}・HP {ch.monster.hp}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h3>🐾 野生怪物</h3>
        {ZONES.map((z, zi) => z.wild.length > 0 && (
          <div key={z.id}>
            <div className="small muted">{z.name}</div>
            <div className="debug-grid">
              {z.wild.map((m, i) => (
                <button key={m.name} className="debug-foe" onClick={() => fight({ name: 'battle', mode: { kind: 'wild', zone: zi, idx: i, from: 'debug' } })}>
                  <span className="big">{m.emoji}</span>
                  <strong className="small">{m.name}</strong>
                  <span className="small muted">HP {m.hp}・攻擊 {m.attack}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn ghost" disabled={save.collected.length < 1} onClick={() => fight({ name: 'battle', mode: { kind: 'training', from: 'debug' } })}>🎯 訓練用稻草人（需要至少收服 1 張牌）</button>
      </section>

      <section className="panel stack">
        <h3>🗺️ 傳送到地圖</h3>
        <div className="chips">
          {ZONES.map((z, zi) => (
            <button key={z.id} className="chip" onClick={() => { setSave((s) => ({ ...s, pos: zoneEntry(zi) })); go({ name: 'map' }) }}>{z.name}</button>
          ))}
        </div>
      </section>
    </div>
  )
}
