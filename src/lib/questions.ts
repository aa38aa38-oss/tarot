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

// 意思相近、容易搞混的牌（高等級時當干擾選項）
const SIMILAR: string[][] = [
  ['m02', 'm18', 'm09', 'm17'], // 女祭司、月亮、隱士、星星：直覺／內在
  ['m04', 'm05', 'm11'], // 皇帝、教皇、正義：規則／權威
  ['m03', 'm19', 'm17'], // 皇后、太陽、星星：豐盛／希望
  ['m07', 'm08', 'm01'], // 戰車、力量、魔術師：意志／力量
  ['m13', 'm16', 'm20', 'm10'], // 死神、高塔、審判、命運之輪：轉變
  ['m06', 'm15', 'm14'], // 戀人、惡魔、節制：關係／慾望／平衡
  ['m00', 'm21', 'm12'], // 愚者、世界、吊人：起點／終點／換角度
]
let similarMode = false

const pickDistractors = (card: TarotCard, n: number, pool: TarotCard[]) => {
  if (similarMode) {
    const group = SIMILAR.filter((g) => g.includes(card.id)).flat().filter((id) => id !== card.id)
    const near = shuffle(MAJOR_ARCANA.filter((c) => group.includes(c.id)))
    const rest = shuffle(MAJOR_ARCANA.filter((c) => c.id !== card.id && !group.includes(c.id)))
    return [...near.slice(0, 2), ...rest].slice(0, n)
  }
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

// 題目難度：★1 認牌　★2 牌義　★3 象徵／星象　★4 情境應用
const TYPE_TIER = [1, 1, 2, 2, 1, 3, 4, 3]
export const typesOfTier = (min: number, max: number) => TYPE_TIER.map((t, i) => (t >= min && t <= max ? i : -1)).filter((i) => i >= 0)

// 秘術用較難的題型：象徵、星象、情境
export const HARD_TYPES = typesOfTier(3, 4)
export const SCENARIO_TYPES = typesOfTier(4, 4)

export interface QOpts {
  types?: number[] // 指定題型；沒指定就依「這張牌的熟練度」決定難度
  similar?: boolean // 用意思相近的牌當干擾選項
}

// 熟練度 0–1★ → ★1–2 題；2–3★ → ★2–3 題；4–5★ → ★3–4 題
const tierRangeForBox = (box: number): [number, number] => (box <= 1 ? [1, 2] : box <= 3 ? [2, 3] : [3, 4])

export function makeCardQuestion(save: SaveData, pool: TarotCard[], avoid?: string, opts: QOpts = {}): Question {
  const candidates = pool.length > 1 && avoid ? pool.filter((c) => c.id !== avoid) : pool
  const card = weightedPick(candidates, (c) => weightFor(save, c.id))
  const types = opts.types ?? typesOfTier(...tierRangeForBox(save.cardStats[card.id]?.box ?? 0))
  const idx = weightedPick(types, (i) => TYPE_WEIGHTS[i])
  similarMode = !!opts.similar
  try {
    return GENERATORS[idx](card, pool)
  } finally {
    similarMode = false
  }
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
