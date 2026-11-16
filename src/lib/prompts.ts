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

我自己對這張牌的解讀與今天的感受是：
「${note || '（我還沒寫）'}」

請你：
1. 先肯定我解讀中做得好的地方
2. 補充我可能沒注意到的牌義或象徵
3. 給我今天一個具體、可以做到的小行動建議
4. 給我一句適合今天的鼓勵

回答請控制在 300 字左右，語氣溫暖。`
}

export function readingPrompt(
  npcQuestion: string,
  cards: { position: string; card: TarotCard }[],
  myReading: string,
) {
  const list = cards
    .map((c, i) => `${i + 1}. 【${c.position}】${c.card.nameZh}（${c.card.nameEn}）正位`)
    .join('\n')
  return `${ROLE}

我正在練習塔羅解讀，請你擔任我的老師，批改我的解讀。

■ 求問者的問題：
「${npcQuestion}」

■ 牌陣（三張牌，皆為正位）：
${list}

■ 我的解讀：
「${myReading || '（我還沒寫）'}」

請依照以下格式回饋：
1. 【評分】給我 1～10 分，並用一句話說明理由
2. 【做得好的地方】具體指出 1～3 點
3. 【可以加強的地方】例如：牌義是否正確、有沒有連結到問題、三張牌之間有沒有串成一個故事、有沒有給求問者實際可行的建議
4. 【示範解讀】請示範一段約 200 字、溫柔而具體的完整解讀
5. 【下次練習重點】一句話`
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
