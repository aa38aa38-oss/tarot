import { CHAPTERS, Chapter } from '../data/world'
import { SaveData } from './game'

export function chapterUnlocked(save: SaveData, ch: Chapter): boolean {
  if (ch.id === 'c0') return true
  if (save.skipTestPassed) return true
  if (ch.id === 'boss') return CHAPTERS.filter((c) => c.id !== 'boss').every((c) => save.clearedChapters.includes(c.id))
  const idx = CHAPTERS.findIndex((c) => c.id === ch.id)
  return save.clearedChapters.includes(CHAPTERS[idx - 1].id)
}

// 本章的牌都學完才能挑戰怪物
export function battleReady(save: SaveData, ch: Chapter): boolean {
  if (ch.id === 'c0') return save.basicsDone
  return ch.cardIds.every((id) => save.collected.includes(id))
}
