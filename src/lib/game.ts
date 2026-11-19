import { TITLES } from '../data/world'

export interface CardStat {
  correct: number
  wrong: number
  box: number // 間隔重複的熟練度 0～5
  lastSeen: number
}

export interface JournalEntry {
  date: string // YYYY-MM-DD
  cardId: string
  note: string
}

export interface SaveData {
  version: 1
  name: string
  avatar: string
  xp: number
  collected: string[] // 已收服的牌
  clearedChapters: string[]
  basicsDone: boolean
  skipTestPassed: boolean
  cardStats: Record<string, CardStat>
  journal: JournalEntry[] // 每日一抽
  commissionsDone: number
  commissionDates: string[] // 完成委託的日期（限每日次數）
  streak: number
  lastDailyDate: string | null
  battlesWon: number
  pos?: { x: number; y: number } // 在大地圖上的位置
  skills?: string[] // 已學會的技能
  guardians?: string[] // 裝備中的守護牌
  updatedAt: number
}

export const newSave = (name = '', avatar = '🧙'): SaveData => ({
  version: 1,
  name,
  avatar,
  xp: 0,
  collected: [],
  clearedChapters: [],
  basicsDone: false,
  skipTestPassed: false,
  cardStats: {},
  journal: [],
  commissionsDone: 0,
  commissionDates: [],
  streak: 0,
  lastDailyDate: null,
  battlesWon: 0,
  updatedAt: Date.now(),
})

// ---------- 等級 ----------
// 升到下一級所需 XP：40, 60, 80, 100 …
export const xpToNext = (level: number) => 40 + 20 * (level - 1)

// 從 0 XP 升到某個等級需要的總經驗值
export const xpForLevel = (level: number) => Array.from({ length: Math.max(0, level - 1) }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b, 0)

export function levelInfo(xp: number) {
  let level = 1
  let rest = xp
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level++
  }
  return { level, current: rest, needed: xpToNext(level) }
}

export const titleFor = (level: number) =>
  [...TITLES].reverse().find((t) => level >= t.minLevel)?.title ?? TITLES[0].title

export const maxHp = (level: number) => 100 + (level - 1) * 10

// ---------- 經驗值獎勵 ----------
export const XP = {
  lesson: 20,
  basics: 30,
  daily: 15,
  commission: 30,
  training: 15,
  skipTest: 300,
}
export const COMMISSIONS_PER_DAY = 3

// ---------- 日期 ----------
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const yesterday = () => {
  const d = new Date(Date.now() - 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- 間隔重複 ----------
export function recordAnswer(save: SaveData, cardId: string, ok: boolean): SaveData {
  const s = save.cardStats[cardId] ?? { correct: 0, wrong: 0, box: 0, lastSeen: 0 }
  const next: CardStat = {
    correct: s.correct + (ok ? 1 : 0),
    wrong: s.wrong + (ok ? 0 : 1),
    box: ok ? Math.min(5, s.box + 1) : Math.max(0, s.box - 2),
    lastSeen: Date.now(),
  }
  return { ...save, cardStats: { ...save.cardStats, [cardId]: next } }
}

// 熟練度低、越久沒看的牌，越容易被抽到
export function weightFor(save: SaveData, cardId: string) {
  const s = save.cardStats[cardId]
  if (!s) return 4
  const days = (Date.now() - s.lastSeen) / 86400000
  return Math.max(0.5, 6 - s.box + Math.min(days, 5) * 0.5)
}

export function weightedPick<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((a, t) => a + weight(t), 0)
  let r = Math.random() * total
  for (const t of items) {
    r -= weight(t)
    if (r <= 0) return t
  }
  return items[items.length - 1]
}

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- 合併本機與雲端存檔 ----------
const uniq = <T,>(a: T[]) => Array.from(new Set(a))

export function mergeSaves(a: SaveData, b: SaveData): SaveData {
  const [hi, lo] = a.xp >= b.xp ? [a, b] : [b, a]
  const stats: Record<string, CardStat> = { ...lo.cardStats }
  for (const [k, v] of Object.entries(hi.cardStats)) {
    const o = stats[k]
    stats[k] = !o || v.lastSeen >= o.lastSeen ? v : o
  }
  const journalMap = new Map<string, JournalEntry>()
  for (const j of [...lo.journal, ...hi.journal]) journalMap.set(j.date, j)
  return {
    ...hi,
    name: hi.name || lo.name,
    collected: uniq([...hi.collected, ...lo.collected]),
    clearedChapters: uniq([...hi.clearedChapters, ...lo.clearedChapters]),
    basicsDone: hi.basicsDone || lo.basicsDone,
    skipTestPassed: hi.skipTestPassed || lo.skipTestPassed,
    cardStats: stats,
    journal: Array.from(journalMap.values()).sort((x, y) => x.date.localeCompare(y.date)),
    commissionDates: hi.commissionDates.length >= lo.commissionDates.length ? hi.commissionDates : lo.commissionDates,
    commissionsDone: Math.max(hi.commissionsDone, lo.commissionsDone),
    battlesWon: Math.max(hi.battlesWon, lo.battlesWon),
    streak: Math.max(hi.streak, lo.streak),
    updatedAt: Math.max(hi.updatedAt, lo.updatedAt),
  }
}
