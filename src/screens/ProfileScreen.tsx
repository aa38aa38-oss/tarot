import { useState } from 'react'
import type { GameCtx } from '../App'
import type { useSave } from '../lib/useSave'
import { TITLES } from '../data/world'
import { levelInfo, maxHp, titleFor } from '../lib/game'
import AuthPanel from '../components/AuthPanel'
import { GuardiansPanel, SkillsPanel } from '../components/PowersPanel'

export default function ProfileScreen({ ctx, store }: { ctx: GameCtx; store: ReturnType<typeof useSave> }) {
  const { save } = ctx
  const lv = levelInfo(save.xp)
  const mastered = Object.values(save.cardStats).filter((s) => s.box >= 4).length

  const [confirming, setConfirming] = useState(false)

  return (
    <div className="stack">
      <button className="back" onClick={ctx.back}>← 返回</button>
      <div className="profile-head">
        <span className="avatar huge">{save.avatar}</span>
        <h1>{save.name}</h1>
        <p className="muted">Lv {lv.level}・{titleFor(lv.level)}</p>
      </div>

      <div className="stats">
        <div className="stat"><strong>{save.xp}</strong><span>總經驗值</span></div>
        <div className="stat"><strong>{maxHp(lv.level)}</strong><span>生命值</span></div>
        <div className="stat"><strong>{save.collected.length}</strong><span>已收服</span></div>
        <div className="stat"><strong>{mastered}</strong><span>精通（4★+）</span></div>
        <div className="stat"><strong>{save.battlesWon}</strong><span>戰鬥勝利</span></div>
        <div className="stat"><strong>{save.commissionsDone}</strong><span>完成委託</span></div>
        <div className="stat"><strong>{save.streak}</strong><span>連續抽牌</span></div>
        <div className="stat"><strong>{save.journal.length}</strong><span>日記篇數</span></div>
      </div>

      <h3>✨ 技能</h3>
      <SkillsPanel ctx={ctx} />

      <h3>🛡️ 守護牌</h3>
      <GuardiansPanel ctx={ctx} />

      <h3>🏅 稱號之路</h3>
      <ul className="titles">
        {TITLES.map((t) => (
          <li key={t.title} className={lv.level >= t.minLevel ? 'got' : ''}>
            <span>Lv {t.minLevel}</span> {lv.level >= t.minLevel ? t.title : '？？？'}
          </li>
        ))}
      </ul>

      <h3>☁️ 雲端存檔</h3>
      <AuthPanel user={store.user} />

      <h3>⚙️ 設定</h3>
      {confirming ? (
        <div className="panel">
          <p>確定要刪除所有進度、重新開始嗎？雲端存檔也會一起刪除，這個動作無法復原。</p>
          <div className="row">
            <button className="btn danger" onClick={() => store.resetSave()}>確定刪除</button>
            <button className="btn ghost" onClick={() => setConfirming(false)}>取消</button>
          </div>
        </div>
      ) : (
        <button className="btn danger" onClick={() => setConfirming(true)}>重新開始遊戲</button>
      )}

      <p className="small muted credit">
        牌面圖像：1909 年 Rider-Waite-Smith 塔羅，Pamela Colman Smith 繪製，屬公有領域。
        掃描檔來源：Holly Voley 掃描（經 Wikimedia Commons），透過 Taro's Tarot（tarostarot.com）取得。
      </p>
    </div>
  )
}
