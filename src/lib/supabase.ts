import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

// 優先用環境變數（本機 .env.local 或 GitHub Secrets），否則用 src/config.ts
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || SUPABASE_ANON_KEY

// 沒有設定 Supabase 時，遊戲仍可使用（只存在瀏覽器）
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const cloudEnabled = !!supabase
