// 升級獎勵：技能（每階二選一）＋守護牌（強度＝熟練度）
import { SaveData, levelInfo } from './game'

// ---------- 技能 ----------
export interface Skill {
  id: string
  name: string
  emoji: string
  kind: '主動' | '被動'
  desc: string
}

export const SKILL_TIERS: { level: number; options: [Skill, Skill] }[] = [
  { level: 2, options: [
    { id: 'eye', name: '直覺之眼', emoji: '👁️', kind: '主動', desc: '答題時花 5 MP，刪掉一個錯誤選項' },
    { id: 'focus', name: '冥想', emoji: '🧘', kind: '被動', desc: '每回合自動回復 3 MP' },
  ] },
  { level: 4, options: [
    { id: 'redraw', name: '再抽一次', emoji: '🔄', kind: '被動', desc: '每場戰鬥一次：答錯時可以重新作答' },
    { id: 'shield', name: '皇帝之盾', emoji: '🛡️', kind: '被動', desc: '答錯時受到的傷害 -30%' },
  ] },
  { level: 6, options: [
    { id: 'chain', name: '牌義連鎖', emoji: '🔗', kind: '被動', desc: '連續答對 2 題就會心一擊，會心加成 +15' },
    { id: 'blessing', name: '星光祝福', emoji: '🌟', kind: '被動', desc: '祈禱回復量 +50%，攻擊答對時回復 5 HP' },
  ] },
  { level: 8, options: [
    { id: 'reverse', name: '逆轉', emoji: '🪞', kind: '被動', desc: '敵人施放必殺技的回合，答對就把傷害反彈回去' },
    { id: 'moonstep', name: '月影迷蹤', emoji: '🌙', kind: '被動', desc: '敵人的必殺技有 50% 機率落空' },
  ] },
  { level: 10, options: [
    { id: 'dance', name: '世界之舞', emoji: '🌍', kind: '主動', desc: '花 20 MP，回答一題情境題，答對造成 80 點傷害' },
    { id: 'sunheart', name: '太陽之心', emoji: '☀️', kind: '被動', desc: '戰鬥經驗值 +30%' },
  ] },
]

export const ALL_SKILLS = SKILL_TIERS.flatMap((t) => t.options)
export const skillById = (id: string) => ALL_SKILLS.find((s) => s.id === id)

// 下一個「可以選、還沒選」的技能階
export function pendingSkillTier(save: SaveData) {
  const lv = levelInfo(save.xp).level
  const learned = save.skills ?? []
  return SKILL_TIERS.find((t) => lv >= t.level && !t.options.some((o) => learned.includes(o.id))) ?? null
}

// ---------- 守護牌 ----------
// 每張牌的效果數值是「熟練度 5★ 時的最大值」，實際值 = 最大值 × (熟練度+1)/6
export interface Guardian {
  stat: keyof Stats
  max: number
  text: (v: number) => string
}

export const GUARDIANS: Record<string, Guardian> = {
  m00: { stat: 'firstTurnGuard', max: 100, text: (v) => `第一回合受到的傷害 -${v}%` },
  m01: { stat: 'mpBonus', max: 15, text: (v) => `MP 上限 +${v}` },
  m02: { stat: 'arcanaDiscount', max: 5, text: (v) => `秘術消耗的 MP -${v}` },
  m03: { stat: 'prayPct', max: 60, text: (v) => `祈禱回復量 +${v}%` },
  m04: { stat: 'guardPct', max: 20, text: (v) => `受到的傷害 -${v}%` },
  m05: { stat: 'studyXpPct', max: 30, text: (v) => `訓練與委託的經驗值 +${v}%` },
  m06: { stat: 'prayMp', max: 10, text: (v) => `祈禱時也回復 ${v} MP` },
  m07: { stat: 'atkPct', max: 25, text: (v) => `攻擊傷害 +${v}%` },
  m08: { stat: 'hpPct', max: 25, text: (v) => `HP 上限 +${v}%` },
  m09: { stat: 'hints', max: 2, text: (v) => `每場戰鬥 ${v} 次免費提示（刪掉一個錯誤選項）` },
  m10: { stat: 'luckyPct', max: 25, text: (v) => `攻擊時有 ${v}% 機率造成雙倍傷害` },
  m11: { stat: 'justicePct', max: 30, text: (v) => `答對時，敵人的反擊再 -${v}%` },
  m12: { stat: 'dodgePct', max: 30, text: (v) => `答錯時有 ${v}% 機率躲過攻擊` },
  m13: { stat: 'executePct', max: 20, text: (v) => `敵人 HP 低於 ${v}% 時，答對直接擊倒` },
  m14: { stat: 'regenMp', max: 4, text: (v) => `每回合回復 ${v} MP` },
  m15: { stat: 'devilPct', max: 40, text: (v) => `攻擊傷害 +${v}%，但受到的傷害 +10%` },
  m16: { stat: 'arcanaPct', max: 40, text: (v) => `秘術傷害 +${v}%` },
  m17: { stat: 'regenHp', max: 6, text: (v) => `每回合回復 ${v} HP` },
  m18: { stat: 'specialGuardPct', max: 40, text: (v) => `敵人必殺技的傷害 -${v}%` },
  m19: { stat: 'xpPct', max: 30, text: (v) => `戰鬥經驗值 +${v}%` },
  m20: { stat: 'revivePct', max: 40, text: (v) => `倒下時以 ${v}% HP 復活一次` },
  m21: { stat: 'allPct', max: 10, text: (v) => `攻擊、HP、MP 全部 +${v}%` },
}

export const guardianSlots = (level: number) => (level >= 15 ? 3 : level >= 7 ? 2 : level >= 3 ? 1 : 0)
export const GUARDIAN_SLOT_LEVELS = [3, 7, 15]

export const masteryOf = (save: SaveData, cardId: string) => save.cardStats[cardId]?.box ?? 0
export const guardianValue = (cardId: string, box: number) => Math.max(1, Math.round(GUARDIANS[cardId].max * (box + 1) / 6))
export const guardianText = (save: SaveData, cardId: string) => GUARDIANS[cardId].text(guardianValue(cardId, masteryOf(save, cardId)))

// ---------- 戰鬥時的綜合能力 ----------
export interface Stats {
  firstTurnGuard: number; mpBonus: number; arcanaDiscount: number; prayPct: number; guardPct: number; studyXpPct: number
  prayMp: number; atkPct: number; hpPct: number; hints: number; luckyPct: number; justicePct: number; dodgePct: number
  executePct: number; regenMp: number; devilPct: number; arcanaPct: number; regenHp: number; specialGuardPct: number
  xpPct: number; revivePct: number; allPct: number
}

const ZERO: Stats = {
  firstTurnGuard: 0, mpBonus: 0, arcanaDiscount: 0, prayPct: 0, guardPct: 0, studyXpPct: 0, prayMp: 0, atkPct: 0, hpPct: 0,
  hints: 0, luckyPct: 0, justicePct: 0, dodgePct: 0, executePct: 0, regenMp: 0, devilPct: 0, arcanaPct: 0, regenHp: 0,
  specialGuardPct: 0, xpPct: 0, revivePct: 0, allPct: 0,
}

export function deriveStats(save: SaveData): Stats {
  const s = { ...ZERO }
  const slots = guardianSlots(levelInfo(save.xp).level)
  for (const id of (save.guardians ?? []).slice(0, slots)) {
    const g = GUARDIANS[id]
    if (g) s[g.stat] += guardianValue(id, masteryOf(save, id))
  }
  return s
}

export const hasSkill = (save: SaveData, id: string) => (save.skills ?? []).includes(id)

// ---------- 等級壓制：比區域推薦等級高 3 級，經驗值就減半 ----------
export const ZONE_LEVEL = [1, 2, 3, 5, 6, 8, 9, 10]
export function suppressedXp(xp: number, playerLevel: number, zoneLevel: number) {
  const over = Math.floor((playerLevel - zoneLevel) / 3)
  return over > 0 ? Math.max(1, Math.round(xp / 2 ** over)) : xp
}
