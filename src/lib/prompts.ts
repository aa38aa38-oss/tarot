// 一鍵複製給 AI 的提示詞
import { TarotCard } from '../data/majorArcana'

const ROLE = '你是一位溫柔、專業又有耐心的塔羅老師，熟悉 1909 年偉特（Rider-Waite-Smith）塔羅的象徵體系。請用繁體中文回答。'

export function lessonPrompt(card: TarotCard) {
  return `${ROLE}

我是塔羅初學者，正在學習大阿爾克那 ${card.roman} 號「${card.nameZh}（${card.nameEn}）」。
目前我知道的正位關鍵字：${card.keywordsUp.join('、')}

請幫我：
1. 用一個生活化的小故事，讓我記住這張牌的核心精神
2. 解說牌面上 3～5 個重要象徵，以及它們的意義
3. 分別舉例這張牌在「感情」「工作」「自我成長」三種問題中，正位可能怎麼解讀
4. 這張牌常被誤解的地方是什麼？
5. 最後出 3 題小測驗考我（先不要給答案，等我回答後再批改）`
}

export function dailyPrompt(card: TarotCard, note: string) {
  return `${ROLE}

今天我做了「每日一抽」，抽到大阿爾克那 ${card.roman} 號「${card.nameZh}（${card.nameEn}）」正位。

${note || '（我還沒選擇今天的感受）'}

請你：
1. 用這張牌，幫我解讀今天可能遇到的課題（結合我選的關鍵字和心情）
2. 補充我可能沒注意到的牌義或象徵
3. 給我今天一個具體、可以做到的小行動建議
4. 給我一句適合今天的鼓勵

回答請控制在 300 字左右，語氣溫暖。`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 舊瀏覽器或非 https 時的備援
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

// 委託（點選式）完成後：請 AI 點評玩家的選擇並示範完整解讀
export function commissionPrompt(npcQuestion: string, slots: { position: string; card: TarotCard }[], picks: string[]) {
  const list = slots.map((s, i) => `${i + 1}. 【${s.position}】${s.card.nameZh}（${s.card.nameEn}）正位`).join('\n')
  return `${ROLE}

我正在練習塔羅解讀，請你擔任我的老師。

■ 求問者的問題：
「${npcQuestion}」

■ 牌陣（三張牌，皆為正位）：
${list}

■ 我在練習中做的選擇：
${picks.map((p) => `・${p}`).join('\n')}

請你：
1. 【點評】我的選擇哪些很到位、哪些可以更好？
2. 【示範解讀】把三張牌串成一個完整的故事，約 200 字，語氣溫柔、具體，並回應求問者的問題
3. 【牌與牌的關係】這三張牌放在一起，有什麼值得注意的呼應或對比？
4. 【給我的一個練習重點】一句話`
}
