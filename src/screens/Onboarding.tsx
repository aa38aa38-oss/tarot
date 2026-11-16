import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { SaveData, newSave } from '../lib/game'
import AuthPanel from '../components/AuthPanel'
import { cloudEnabled } from '../lib/supabase'

const AVATARS = ['🧙', '🧙‍♀️', '🧝', '🧝‍♀️', '🦊', '🐱', '🦉', '🐉', '🌙', '⭐']

export default function Onboarding({ onCreate, user }: { onCreate: (s: SaveData) => void; user: User | null }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])

  return (
    <div className="onboarding">
      <div className="hero">
        <img src="cards/00-TheFool.webp" alt="愚者" className="hero-card" />
        <h1>塔羅之旅</h1>
        <p className="muted">Tarot Quest・邊玩邊學的塔羅冒險</p>
      </div>

      <div className="panel">
        <p>每一位占卜師，都是從 <strong>0 號愚者</strong> 開始的。</p>
        <p className="muted small">學習牌義、打倒怪物、收集 78 張牌、升級成為塔羅大師。</p>

        <label className="label">你的名字</label>
        <input value={name} maxLength={12} placeholder="見習占卜師" onChange={(e) => setName(e.target.value)} />

        <label className="label">選擇頭像</label>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button key={a} className={a === avatar ? 'avatar-pick active' : 'avatar-pick'} onClick={() => setAvatar(a)}>{a}</button>
          ))}
        </div>

        <button className="btn primary block" onClick={() => onCreate(newSave(name.trim() || '見習占卜師', avatar))}>
          踏上旅程 →
        </button>
        <p className="small muted center">已經有塔羅基礎？進入遊戲後可以在地圖上挑戰「跳級測驗」。</p>
      </div>

      {cloudEnabled && (
        <>
          <p className="center small muted">已經在別的裝置玩過了嗎？登入就能讀取雲端存檔。</p>
          <AuthPanel user={user} compact />
        </>
      )}
      <p className="center small muted credit">牌面圖像：1909 年偉特塔羅（Pamela Colman Smith 繪，公有領域）</p>
    </div>
  )
}
