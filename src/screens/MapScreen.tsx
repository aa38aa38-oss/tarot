import type { GameCtx } from '../App'
import { CHAPTERS, REGIONS } from '../data/world'
import { chapterUnlocked } from '../lib/progress'
import { levelInfo } from '../lib/game'

export default function MapScreen({ ctx }: { ctx: GameCtx }) {
  const { save, go } = ctx
  const cleared = save.clearedChapters.length
  const level = levelInfo(save.xp).level

  return (
    <div className="stack">
      <button className="back" onClick={() => go({ name: 'map' })}>← 返回大地圖</button>
      {REGIONS.map((r) => (
        <section key={r.id} className={r.available ? 'region' : 'region locked'}>
          <div className="region-head">
            <span className="region-emoji">{r.emoji}</span>
            <div>
              <h2>{r.name}</h2>
              <p className="small muted">{r.levelRange}・{r.description}</p>
            </div>
          </div>

          {r.available ? (
            <>
              <div className="progress-line small muted">
                進度 {cleared}/{CHAPTERS.length} 章・已收服 {save.collected.length}/22 張大牌
              </div>
              <ol className="chapter-list">
                {CHAPTERS.map((ch) => {
                  const open = chapterUnlocked(save, ch)
                  const done = save.clearedChapters.includes(ch.id)
                  return (
                    <li key={ch.id}>
                      <button
                        className={`chapter-item ${done ? 'done' : ''} ${open ? '' : 'locked'} ${ch.monster.boss ? 'boss' : ''}`}
                        disabled={!open}
                        onClick={() => go({ name: 'chapter', id: ch.id })}
                      >
                        <span className="chapter-icon">{done ? '✅' : open ? ch.monster.emoji : '🔒'}</span>
                        <span className="chapter-text">
                          <strong>{ch.title}</strong>
                          <span className="small muted">{ch.subtitle}</span>
                        </span>
                        <span className="chapter-xp small">+{ch.xpReward}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <div className="side-quests">
                <button className="quest-card" disabled={save.collected.length < 4} onClick={() => go({ name: 'battle', mode: { kind: 'training' } })}>
                  <span className="quest-emoji">🎯</span>
                  <strong>訓練場</strong>
                  <span className="small muted">{save.collected.length < 4 ? '收服 4 張牌後開放' : '針對你最不熟的牌加強練習'}</span>
                </button>
                {!save.skipTestPassed && level < 5 && (
                  <button className="quest-card" onClick={() => go({ name: 'battle', mode: { kind: 'skip' } })}>
                    <span className="quest-emoji">⚡</span>
                    <strong>跳級測驗</strong>
                    <span className="small muted">有基礎嗎？答對 80% 直接解鎖全部章節</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="small muted">🚧 建設中，敬請期待</p>
          )}
        </section>
      ))}
    </div>
  )
}
