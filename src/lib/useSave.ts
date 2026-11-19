import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { SaveData, mergeSaves } from './game'
import { supabase } from './supabase'

const KEY = 'tarot-quest-save-v1'

function loadLocal(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SaveData) : null
  } catch {
    return null
  }
}
function saveLocal(s: SaveData | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* 無痕模式等情況，忽略 */
  }
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error'

export function useSave() {
  const [save, setSaveState] = useState<SaveData | null>(loadLocal)
  const [user, setUser] = useState<User | null>(null)
  const [sync, setSync] = useState<SyncStatus>('offline')
  const [syncError, setSyncError] = useState<string | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save
  const timer = useRef<number>()

  const push = useCallback(async (s: SaveData, uid: string) => {
    if (!supabase) return
    setSync('syncing')
    const { error } = await supabase
      .from('player_saves')
      .upsert({ user_id: uid, data: s, updated_at: new Date().toISOString() })
    setSync(error ? 'error' : 'synced')
    setSyncError(error ? `上傳失敗：${error.code ?? ''} ${error.message}` : null)
  }, [])

  // 登入後：抓雲端存檔並與本機合併
  const pull = useCallback(
    async (u: User) => {
      if (!supabase) return
      setSync('syncing')
      const { data, error } = await supabase.from('player_saves').select('data').eq('user_id', u.id).maybeSingle()
      if (error) {
        setSync('error')
        setSyncError(`讀取失敗：${error.code ?? ''} ${error.message}`)
        return
      }
      const remote = (data?.data as SaveData | undefined) ?? null
      const local = saveRef.current
      const merged = remote && local ? mergeSaves(local, remote) : remote ?? local
      if (merged) {
        setSaveState(merged)
        saveLocal(merged)
        await push(merged, u.id)
      } else setSync('synced')
    },
    [push],
  )

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) pull(u)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (event === 'SIGNED_IN' && u) pull(u)
      if (event === 'SIGNED_OUT') setSync('offline')
    })
    return () => sub.subscription.unsubscribe()
  }, [pull])

  const setSave = useCallback(
    (updater: (s: SaveData) => SaveData) => {
      setSaveState((prev) => {
        if (!prev) return prev
        const next = { ...updater(prev), updatedAt: Date.now() }
        saveLocal(next)
        return next
      })
    },
    [],
  )

  // 變更後 1.5 秒自動上傳
  useEffect(() => {
    if (!save || !user) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => push(save, user.id), 1500)
    return () => window.clearTimeout(timer.current)
  }, [save, user, push])

  const createSave = (s: SaveData) => {
    saveLocal(s)
    setSaveState(s)
  }

  const resetSave = async () => {
    saveLocal(null)
    setSaveState(null)
    if (supabase && user) await supabase.from('player_saves').delete().eq('user_id', user.id)
  }

  // 手動重試：重新讀取雲端存檔並合併、上傳
  const retrySync = useCallback(() => { if (user) pull(user) }, [user, pull])

  return { save, setSave, createSave, resetSave, user, sync, syncError, retrySync }
}
