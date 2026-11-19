import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from '../lib/supabase'
import { GOOGLE_LOGIN } from '../config'

export default function AuthPanel({ user, compact, syncError, onRetry }: { user: User | null; compact?: boolean; syncError?: string | null; onRetry?: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  if (!cloudEnabled || !supabase) {
    return (
      <div className="panel small muted">
        💾 目前存檔只保存在這個瀏覽器。站長設定好 Supabase 之後，就能登入使用雲端存檔、跨裝置同步。
      </div>
    )
  }
  if (user) {
    return (
      <div className="panel">
        <p>☁️ 已登入：<strong>{user.email}</strong></p>
        <p className="small muted">進度會自動同步到雲端，換手機或電腦登入同一個帳號就能接續遊玩。</p>
        {syncError && (
          <div className="sync-error small">
            <p>⚠️ 雲端同步失敗（進度仍保存在這台裝置上）</p>
            <code>{syncError}</code>
            {onRetry && <button className="btn small" onClick={onRetry}>🔄 重試同步</button>}
          </div>
        )}
        <button className="btn ghost" onClick={() => supabase!.auth.signOut()}>登出</button>
      </div>
    )
  }

  const redirect = window.location.origin + window.location.pathname

  const sendLink = async () => {
    setErr('')
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="panel">
      {!compact && <p>☁️ <strong>登入以使用雲端存檔</strong></p>}
      <p className="small muted">登入後，進度會存到雲端，換裝置也不會不見。</p>
      {GOOGLE_LOGIN && (
        <>
          <button className="btn" onClick={() => supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } })}>
            使用 Google 登入
          </button>
          <div className="or small muted">或用 Email 登入連結</div>
        </>
      )}
      {!GOOGLE_LOGIN && <p className="small muted">輸入 Email，我們會寄一封登入連結給你（不需要密碼）。請用「同一個瀏覽器」打開信裡的連結。</p>}
      {sent ? (
        <p className="small">📧 登入連結已寄到 <strong>{email}</strong>，請到信箱點擊連結。</p>
      ) : (
        <div className="row">
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" disabled={!email.includes('@')} onClick={sendLink}>寄送</button>
        </div>
      )}
      {err && <p className="small error">{err}</p>}
    </div>
  )
}
