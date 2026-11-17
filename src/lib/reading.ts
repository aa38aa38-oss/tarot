// 委託解讀的題目產生器（不需打字）
import { MAJOR_ARCANA, TarotCard } from '../data/majorArcana'
import { BAD_ADVICE, PHRASES, POSITION_TYPE, PosType } from '../data/readingPhrases'
import { shuffle } from './game'

export type CommissionType = 'match' | 'cloze' | 'pick' | 'spot'

export const COMMISSION_TYPES: { type: CommissionType; name: string; emoji: string; level: number; desc: string }[] = [
  { type: 'match', name: '牌位配對', emoji: '🔗', level: 1, desc: '把每張牌連到它在這個位置的意思' },
  { type: 'cloze', name: '克漏字解讀', emoji: '🧩', level: 4, desc: '在一段解讀裡填入正確的牌義' },
  { type: 'pick', name: '三位學徒', emoji: '🧑‍🎓', level: 6, desc: '三位學徒各寫一段解讀，選出最好的' },
  { type: 'spot', name: '解讀找錯', emoji: '🔍', level: 8, desc: '找出解讀中說錯的地方並改正' },
]

export interface Slot {
  position: string
  posType: PosType
  card: TarotCard
  phrase: string // 正確解讀
}

export const makeSlots = (spread: string[], cards: TarotCard[]): Slot[] =>
  cards.map((card, i) => {
    const posType = POSITION_TYPE[spread[i]] ?? 'present'
    return { position: spread[i], posType, card, phrase: PHRASES[card.id][posType] }
  })

// 從「沒被抽到的牌」裡拿同一牌位類型的句子當干擾選項
export function distractors(slots: Slot[], posType: PosType, n: number): { text: string; card: TarotCard }[] {
  const used = new Set(slots.map((s) => s.card.id))
  return shuffle(MAJOR_ARCANA.filter((c) => !used.has(c.id)))
    .slice(0, n)
    .map((c) => ({ text: PHRASES[c.id][posType], card: c }))
}

export const sentence = (s: Slot, phrase = s.phrase) => `「${s.position}」的${s.card.nameZh}：${phrase}。`

// ---------- 三位學徒 ----------
export interface Apprentice {
  name: string
  emoji: string
  text: string
  good: boolean
  why: string
}

export function makeApprentices(slots: Slot[]): Apprentice[] {
  const wrongIdx = Math.floor(Math.random() * slots.length)
  const wrong = distractors(slots, slots[wrongIdx].posType, 1)[0]
  const adviceSlot = slots.find((s) => s.posType === 'advice') ?? slots[slots.length - 1]
  const tail = `整體來說，我建議你：${PHRASES[adviceSlot.card.id].advice}。`
  const good = slots.map((s) => sentence(s)).join('') + tail
  const mistaken = slots.map((s, i) => (i === wrongIdx ? sentence(s, wrong.text) : sentence(s))).join('') + tail
  const listy = slots.map((s) => `${s.card.nameZh}代表${s.card.keywordsUp.slice(0, 2).join('和')}。`).join('')
  const names = shuffle([['小麥', '🧑‍🌾'], ['阿杏', '👩‍🎓'], ['小樹', '🧒']])
  return shuffle([
    { text: good, good: true, why: '每張牌都依照牌位正確解讀，也連回了問題，最後給出具體建議。' },
    { text: mistaken, good: false, why: `「${slots[wrongIdx].position}」的${slots[wrongIdx].card.nameZh}被說錯了，那句其實比較像「${wrong.card.nameZh}」的意思。` },
    { text: listy, good: false, why: '只是把關鍵字列出來，沒有考慮牌位，也沒有回答問題、沒有給建議。' },
  ]).map((a, i) => ({ ...a, name: names[i][0], emoji: names[i][1] }))
}

// ---------- 找錯 ----------
export function makeSpot(slots: Slot[]) {
  const wrongIdx = Math.floor(Math.random() * slots.length)
  const wrong = distractors(slots, slots[wrongIdx].posType, 3)
  const options = shuffle([slots[wrongIdx].phrase, wrong[1].text, wrong[2].text])
  return {
    wrongIdx,
    shown: slots.map((s, i) => (i === wrongIdx ? wrong[0].text : s.phrase)),
    wrongFrom: wrong[0].card,
    options,
    answer: options.indexOf(slots[wrongIdx].phrase),
  }
}

// ---------- 最後一題：給求問者的建議 ----------
export function makeAdvice(slots: Slot[]) {
  const adviceSlot = slots.find((s) => s.posType === 'advice') ?? slots[slots.length - 1]
  const good = PHRASES[adviceSlot.card.id].advice
  const other = distractors(slots, 'advice', 1)[0]
  const bad = BAD_ADVICE[Math.floor(Math.random() * BAD_ADVICE.length)]
  const options = shuffle([
    { text: good, why: `來自牌陣中的「${adviceSlot.card.nameZh}」，溫柔又具體。` },
    { text: bad, why: '好的占卜不恐嚇、不打包票，也不把決定權交給牌。' },
    { text: other.text, why: `這是「${other.card.nameZh}」的建議，但它不在這次的牌陣裡。` },
  ])
  return { options, answer: options.findIndex((o) => o.text === good) }
}

export const starsFor = (right: number, total: number) => (right === total ? 3 : right / total >= 0.6 ? 2 : 1)
