import { useCallback, useState } from 'react'
import { useSave } from './lib/useSave'
import { SaveData, levelInfo, maxHp, titleFor } from './lib/game'
import { cloudEnabled } from './lib/supabase'
import Onboarding from './screens/Onboarding'
import MapScreen from './screens/MapScreen'
import ChapterScreen from './screens/ChapterScreen'
import LessonScreen from './screens/LessonScreen'
import BasicsScreen from './screens/BasicsScreen'
import BattleScreen, { BattleMode } from './screens/BattleScreen'
import CodexScreen from './screens/CodexScreen'
import DailyScreen from './screens/DailyScreen'
import CommissionScreen from './screens/CommissionScreen'
import ProfileScreen from './screens/ProfileScreen'
import SkipTestScreen from './screens/SkipTestScreen'
import WorldScreen from './screens/WorldScreen'
import { GUARDIAN_SLOT_LEVELS, SKILL_TIERS, guardianSlots, pendingSkillTier } from './lib/powers'

export type Screen =
  | { name: 'map' }
  | { name: 'journey' }
  | { name: 'chapter'; id: string }
  | { name: 'lesson'; cardId: string; chapterId?: string; from?: 'world' }
  | { name: 'basics' }
  | { name: 'battle'; mode: BattleMode }
  | { name: 'codex' }
  | { name: 'daily' }
  | { name: 'commission' }
  | { name: 'profile' }

export interface GameCtx {
  save: SaveData
  setSave: (u: (s: SaveData) => SaveData) => void
  gainXp: (amount: number, reason: string) => void
  go: (s: Screen) => void
  toast: (msg: string) => void
}

const TABS: { screen: Screen['name']; icon: string; label: string }[] = [
  { screen: 'map', icon: '🗺️', label: '冒險' },
  { screen: 'codex', icon: '📖', label: '圖鑑' },
  { screen: 'daily', icon: '🌅', label: '每日一抽' },
  { screen: 'commission', icon: '📜', label: '委託' },
  { screen: 'profile', icon: '🧙', label: '角色' },
]

export default function App() {
  const store = useSave()
  const { save, setSave } = store
  const [screen, setScreen] = useState<Screen>({ name: 'map' })
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [navKey, setNavKey] = useState(0)

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  const gainXp = useCallback(
    (amount: number, reason: string) => {
      setSave((s) => {
        const before = levelInfo(s.xp).level
        const after = levelInfo(s.xp + amount).level
        if (after > before) setTimeout(() => setLevelUp(after), 400)
        return { ...s, xp: s.xp + amount }
      })
      toast(`✨ +${amount} XP　${reason}`)
    },
    [setSave, toast],
  )

  const go = useCallback((s: Screen) => {
    setScreen(s)
    setNavKey((k) => k + 1)
    window.scrollTo(0, 0)
  }, [])

  if (!save) {
    return <Onboarding onCreate={store.createSave} user={store.user} />
  }

  const ctx: GameCtx = { save, setSave, gainXp, go, toast }
  const lv = levelInfo(save.xp)
  const inBattle = screen.name === 'battle'
  // 有技能可選，或守護牌欄位空著 → 角色分頁亮紅點
  const needsAttention = !!pendingSkillTier(save) || (save.guardians ?? []).length < Math.min(guardianSlots(lv.level), save.collected.length)
  const fullBattle = screen.name === 'battle' && screen.mode.kind !== 'skip'

  return (
    <div className="app">
      {!fullBattle && (
      <header className="topbar">
        <button className="avatar-btn" onClick={() => go({ name: 'profile' })} aria-label="角色">
          <span className="avatar">{save.avatar}</span>
        </button>
        <div className="topbar-info">
          <div className="topbar-name">
            <strong>{save.name}</strong>
            <span className="muted small">{titleFor(lv.level)}</span>
          </div>
          <div className="xpbar" title={`${lv.current} / ${lv.needed} XP`}>
            <div className="xpbar-fill" style={{ width: `${(lv.current / lv.needed) * 100}%` }} />
            <span className="xpbar-text">Lv {lv.level}　{lv.current}/{lv.needed} XP</span>
          </div>
        </div>
        <div className="topbar-side small muted" title="雲端存檔狀態">
          {!cloudEnabled ? '💾' : store.user ? (store.sync === 'error' ? '⚠️' : store.sync === 'syncing' ? '⏳' : '☁️') : '💾'}
          <div>❤️ {maxHp(lv.level)}</div>
        </div>
      </header>
      )}

      <main className={screen.name === 'map' ? 'main world-main' : inBattle ? 'main battle-main' : 'main'}>
        {screen.name === 'map' && <WorldScreen key={navKey} ctx={ctx} />}
        {screen.name === 'journey' && <MapScreen ctx={ctx} />}
        {screen.name === 'chapter' && <ChapterScreen ctx={ctx} chapterId={screen.id} />}
        {screen.name === 'lesson' && <LessonScreen ctx={ctx} cardId={screen.cardId} chapterId={screen.chapterId} from={screen.from} />}
        {screen.name === 'basics' && <BasicsScreen ctx={ctx} />}
        {screen.name === 'battle' && screen.mode.kind === 'skip' && <SkipTestScreen key={navKey} ctx={ctx} />}
        {fullBattle && screen.name === 'battle' && <BattleScreen key={navKey} ctx={ctx} mode={screen.mode} />}
        {screen.name === 'codex' && <CodexScreen ctx={ctx} />}
        {screen.name === 'daily' && <DailyScreen ctx={ctx} />}
        {screen.name === 'commission' && <CommissionScreen ctx={ctx} />}
        {screen.name === 'profile' && <ProfileScreen ctx={ctx} store={store} />}
      </main>

      {!inBattle && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.screen}
              className={screen.name === t.screen || (t.screen === 'map' && ['chapter', 'lesson', 'basics', 'journey'].includes(screen.name)) ? 'tab active' : 'tab'}
              onClick={() => go({ name: t.screen } as Screen)}
            >
              <span className="tab-icon">{t.icon}{t.screen === 'profile' && needsAttention && <span className="tab-dot" />}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>

      {levelUp && (
        <div className="overlay" onClick={() => setLevelUp(null)}>
          <div className="levelup">
            <div className="levelup-glow">⭐</div>
            <h2>升級了！</h2>
            <p className="levelup-lv">Lv {levelUp}</p>
            <p>稱號：{titleFor(levelUp)}</p>
            <p className="muted small">生命值上限提升為 {maxHp(levelUp)}</p>
            {SKILL_TIERS.some((t) => t.level === levelUp) && <p className="small">✨ 可以學習新技能了！到「角色」頁二選一。</p>}
            {GUARDIAN_SLOT_LEVELS.includes(levelUp) && <p className="small">🛡️ 開放了新的守護牌欄位！</p>}
            {levelUp === 11 && <p className="small">🎉 你已完成新手村！下一個區域「逆影之森」即將開放。</p>}
            <div className="row">
              <button className="btn ghost grow">太好了！</button>
              {(SKILL_TIERS.some((t) => t.level === levelUp) || GUARDIAN_SLOT_LEVELS.includes(levelUp)) && (
                <button className="btn primary grow" onClick={() => go({ name: 'profile' })}>前往角色頁</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
