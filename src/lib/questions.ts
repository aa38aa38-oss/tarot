import { MAJOR_ARCANA, TarotCard, cardById } from '../data/majorArcana'
import { BASICS_QUIZ } from '../data/world'
import { SaveData, shuffle, weightFor, weightedPick } from './game'

export interface Option {
  label: string
  image?: string
}

export interface Question {
  type: string
  prompt: string
  image?: string
  options: Option[]
  answer: number
  cardId?: string
  explain: string
}

const pickDistractors = (card: TarotCard, n: number, pool: TarotCard[]) => {
  // 干擾選項優先從同一池中挑，不夠再從全部大牌補
  const others = shuffle(pool.filter((c) => c.id !== card.id))
  const extra = shuffle(MAJOR_ARCANA.filter((c) => c.id !== card.id && !others.includes(c)))
  return [...others, ...extra].slice(0, n)
}

const build = (card: TarotCard, pool: TarotCard[], toOption: (c: TarotCard) => Option) => {
  const opts = shuffle([card, ...pickDistractors(card, 3, pool)])
  return { options: opts.map(toOption), answer: opts.indexOf(card) }
}

const nameOpt = (c: TarotCard): Option => ({ label: `${c.nameZh}（${c.roman}）` })
const nameOnly = (c: TarotCard): Option => ({ label: c.nameZh })

type Gen = (card: TarotCard, pool: TarotCard[]) => Question

const GENERATORS: Gen[] = [
  // 看圖選牌名（遮住底下的英文名稱）
  (card, pool) => ({
    type: 'image', prompt: '這張牌是？', image: card.image, cardId: card.id,
    ...build(card, pool, nameOnly),
    explain: `這是 ${card.roman} 號「${card.nameZh}」（${card.nameEn}）。`,
  }),
  // 看牌名選圖
  (card, pool) => ({
    type: 'pick-image', prompt: `哪一張是「${card.nameZh}」？`, cardId: card.id,
    ...build(card, pool, (c) => ({ label: c.nameZh, image: c.image })),
    explain: `${card.nameZh}：${card.symbols[0].name}——${card.symbols[0].meaning}`,
  }),
  // 關鍵字選牌
  (card, pool) => ({
    type: 'keywords', prompt: `哪張牌的正位關鍵字是：\n「${shuffle(card.keywordsUp).slice(0, 3).join('、')}」`, cardId: card.id,
    ...build(card, pool, nameOpt),
    explain: `${card.nameZh}：${card.keywordsUp.join('、')}`,
  }),
  // 牌選關鍵字
  (card, pool) => ({
    type: 'card-keywords', prompt: `「${card.nameZh}」正位的意思最接近？`, image: card.image, cardId: card.id,
    ...build(card, pool, (c) => ({ label: c.keywordsUp.slice(0, 3).join('、') })),
    explain: card.upright,
  }),
  // 編號
  (card, pool) => ({
    type: 'number', prompt: `大阿爾克那 ${card.roman} 號（${card.number}）是哪張牌？`, cardId: card.id,
    ...build(card, pool, nameOnly),
    explain: card.mnemonic,
  }),
  // 象徵
  (card, pool) => {
    const sym = card.symbols[Math.floor(Math.random() * card.symbols.length)]
    return {
      type: 'symbol', prompt: `牌面上有「${sym.name}」，象徵：${sym.meaning}\n這是哪張牌？`, cardId: card.id,
      ...build(card, pool, nameOpt),
      explain: `${card.nameZh}的象徵：${card.symbols.map((s) => s.name).join('、')}`,
    }
  },
  // 情境題
  (card, pool) => ({
    type: 'scenario', prompt: `情境：${card.scenario}\n\n哪張牌最能代表這個情境？`, cardId: card.id,
    ...build(card, pool, nameOpt),
    explain: `${card.nameZh}——${card.keywordsUp.slice(0, 3).join('、')}。`,
  }),
  // 星象
  (card, pool) => ({
    type: 'astro', prompt: `哪張牌對應「${card.astro}」？`, cardId: card.id,
    ...build(card, pool, nameOnly),
    explain: `${card.nameZh} 對應 ${card.astro}。`,
  }),
]

// 不同題型的出現權重：越前面越基礎
const TYPE_WEIGHTS = [4, 2, 4, 3, 2, 3, 3, 1]

// 秘術用較難的題型：牌義、象徵、情境
export const HARD_TYPES = [3, 5, 6]

export function makeCardQuestion(save: SaveData, pool: TarotCard[], avoid?: string, types?: number[]): Question {
  const candidates = pool.length > 1 && avoid ? pool.filter((c) => c.id !== avoid) : pool
  const card = weightedPick(candidates, (c) => weightFor(save, c.id))
  const idx = weightedPick(types ?? GENERATORS.map((_, i) => i), (i) => TYPE_WEIGHTS[i])
  return GENERATORS[idx](card, pool)
}

export function makeBasicsQuestion(usedIdx: Set<number>): Question {
  const remain = BASICS_QUIZ.map((_, i) => i).filter((i) => !usedIdx.has(i))
  const i = remain.length ? remain[Math.floor(Math.random() * remain.length)] : Math.floor(Math.random() * BASICS_QUIZ.length)
  usedIdx.add(i)
  const b = BASICS_QUIZ[i]
  const order = shuffle(b.options.map((_, k) => k))
  return {
    type: 'basics', prompt: b.q,
    options: order.map((k) => ({ label: b.options[k] })),
    answer: order.indexOf(b.answer),
    explain: b.explain,
  }
}

export const poolFromIds = (ids: string[]) => ids.map(cardById)
