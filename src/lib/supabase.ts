import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 沒有設定 Supabase 時，遊戲仍可使用（只存在瀏覽器）
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const cloudEnabled = !!supabase
