// 世界地圖：等級區域、章節、怪物
export interface Monster {
  name: string
  emoji: string
  hp: number
  attack: number
  boss?: boolean
  intro: string
}

export interface Chapter {
  id: string
  title: string
  subtitle: string
  cardIds: string[] // 本章要學的牌（序章為空）
  quizPool: 'basics' | 'chapter' | 'all-major'
  monster: Monster
  xpReward: number
}

export interface Region {
  id: string
  name: string
  emoji: string
  levelRange: string
  description: string
  available: boolean
}

export const REGIONS: Region[] = [
  { id: 'r1', name: '新手村・愚者之旅', emoji: '🌱', levelRange: 'Lv 1–10', description: '認識塔羅結構與 22 張大阿爾克那（正位）', available: true },
  { id: 'r2', name: '逆影之森', emoji: '🔮', levelRange: 'Lv 11–20', description: '大牌逆位、四元素', available: false },
  { id: 'r3', name: '四元素大陸', emoji: '⚔️', levelRange: 'Lv 21–35', description: '56 張小阿爾克那：權杖、聖杯、寶劍、錢幣', available: false },
  { id: 'r4', name: '占星塔', emoji: '🌙', levelRange: 'Lv 36–50', description: '牌陣：三張牌、凱爾特十字', available: false },
  { id: 'r5', name: '大師殿堂', emoji: '☀️', levelRange: 'Lv 51+', description: '牌組組合、整體敘事、直覺解讀', available: false },
]

export const CHAPTERS: Chapter[] = [
  {
    id: 'c0', title: '序章・塔羅是什麼', subtitle: '78 張牌的地圖', cardIds: [], quizPool: 'basics', xpReward: 40,
    monster: { name: '迷路的小精靈', emoji: '🧚', hp: 60, attack: 10, intro: '「我迷路了……你能回答我幾個關於塔羅的問題嗎？」' },
  },
  {
    id: 'c1', title: '第一章・啟程', subtitle: '愚者、魔術師、女祭司、皇后', cardIds: ['m00', 'm01', 'm02', 'm03'], quizPool: 'chapter', xpReward: 60,
    monster: { name: '懸崖邊的影子', emoji: '👤', hp: 100, attack: 15, intro: '一團影子擋住了愚者的去路：「想往前走？先證明你認得這些面孔！」' },
  },
  {
    id: 'c2', title: '第二章・秩序', subtitle: '皇帝、教皇、戀人、戰車', cardIds: ['m04', 'm05', 'm06', 'm07'], quizPool: 'chapter', xpReward: 70,
    monster: { name: '鐵面守門人', emoji: '🗿', hp: 100, attack: 18, intro: '石像守門人緩緩睜眼：「規則就是規則。答對了才能通過。」' },
  },
  {
    id: 'c3', title: '第三章・內在', subtitle: '力量、隱士、命運之輪、正義', cardIds: ['m08', 'm09', 'm10', 'm11'], quizPool: 'chapter', xpReward: 80,
    monster: { name: '咆哮的野獅', emoji: '🦁', hp: 120, attack: 20, intro: '一頭野獅攔路怒吼。用你的知識，溫柔地馴服牠吧。' },
  },
  {
    id: 'c4', title: '第四章・轉化', subtitle: '吊人、死神、節制、惡魔', cardIds: ['m12', 'm13', 'm14', 'm15'], quizPool: 'chapter', xpReward: 90,
    monster: { name: '鎖鏈魔', emoji: '😈', hp: 120, attack: 22, intro: '鎖鏈魔晃動著鐵鏈：「被我綁住的人，都以為自己逃不掉……」' },
  },
  {
    id: 'c5', title: '第五章・夜空', subtitle: '高塔、星星、月亮', cardIds: ['m16', 'm17', 'm18'], quizPool: 'chapter', xpReward: 90,
    monster: { name: '月下幻狼', emoji: '🐺', hp: 120, attack: 24, intro: '月光下，幻狼的身影忽隱忽現。別被幻象騙了！' },
  },
  {
    id: 'c6', title: '第六章・圓滿', subtitle: '太陽、審判、世界', cardIds: ['m19', 'm20', 'm21'], quizPool: 'chapter', xpReward: 100,
    monster: { name: '號角守護者', emoji: '📯', hp: 120, attack: 25, intro: '天使的號角響起：「回顧你的旅程，證明你已準備好迎接圓滿。」' },
  },
  {
    id: 'boss', title: '終章・大阿爾克那試煉', subtitle: '22 張大牌總複習', cardIds: [], quizPool: 'all-major', xpReward: 200,
    monster: { name: '世界之蛇・烏洛波洛斯', emoji: '🐉', hp: 240, attack: 25, boss: true, intro: '吞食自己尾巴的巨蛇從地底升起：「起點即是終點……你真的走完這趟旅程了嗎？」' },
  },
]

// 序章：塔羅基礎課程（以投影片方式呈現）
export const BASICS_SLIDES: { title: string; body: string; emoji: string }[] = [
  { emoji: '🃏', title: '塔羅牌是什麼？', body: '塔羅牌是一套 78 張的牌卡，最早出現在 15 世紀的義大利，原本是貴族的紙牌遊戲，後來才被用於占卜與自我探索。\n\n今天，塔羅更常被當作「看見自己」的鏡子：牌面上的圖像幫助我們整理思緒、照見內心。' },
  { emoji: '🎨', title: '偉特塔羅（Rider-Waite-Smith）', body: '這個平台使用的是 1909 年出版的偉特塔羅，由 A. E. 偉特（Waite）設計、女畫家潘蜜拉・科爾曼・史密斯（Pamela Colman Smith）繪製。\n\n它是全世界最普及的塔羅牌，大部分的現代牌組都以它為基礎。學會它，就能看懂大多數塔羅牌。' },
  { emoji: '🗺️', title: '78 張牌的結構', body: '塔羅分成兩大部分：\n\n🌟 大阿爾克那（Major Arcana）：22 張，編號 0～21，代表人生的重大課題與轉折。\n\n🌿 小阿爾克那（Minor Arcana）：56 張，分成四個花色，代表日常生活的細節。' },
  { emoji: '🔥', title: '小阿爾克那的四花色', body: '🪄 權杖（Wands）= 火：熱情、行動、事業\n🏆 聖杯（Cups）= 水：情感、關係、直覺\n⚔️ 寶劍（Swords）= 風：思考、溝通、衝突\n🪙 錢幣（Pentacles）= 土：金錢、身體、現實\n\n每個花色有 1～10 的數字牌，加上侍者、騎士、皇后、國王四張宮廷牌，共 14 張。' },
  { emoji: '🔄', title: '正位與逆位', body: '抽到的牌如果是正的，叫「正位」；上下顛倒，叫「逆位」。\n\n逆位通常代表這張牌的能量受阻、不足、過度，或轉向內在。不過，逆位不等於「壞」！\n\n在新手村，我們先專心學好正位。' },
  { emoji: '🚶', title: '愚者之旅', body: '22 張大牌可以串成一個故事：0 號「愚者」從零出發，一路遇見魔術師、女祭司、皇后……經歷考驗與轉變，最後抵達 21 號「世界」。\n\n用故事來記，會比死背容易很多！接下來，你就是那位愚者。' },
  { emoji: '🎮', title: '怎麼玩？', body: '📖 學習：每章先學 3～4 張牌，學完就會「收服」該牌，加入圖鑑。\n⚔️ 戰鬥：回答問題來攻擊怪物，答錯會被反擊。\n🌅 每日一抽：每天抽一張牌寫心得。\n📜 委託：幫 NPC 解讀牌陣，再一鍵複製提示詞給 AI 批改。\n\n每一項都能拿到經驗值，升級吧！' },
]

export const BASICS_QUIZ: { q: string; options: string[]; answer: number; explain: string }[] = [
  { q: '一副完整的塔羅牌共有幾張？', options: ['52 張', '78 張', '22 張', '64 張'], answer: 1, explain: '22 張大阿爾克那 + 56 張小阿爾克那 = 78 張。' },
  { q: '大阿爾克那有幾張？', options: ['22 張', '56 張', '12 張', '10 張'], answer: 0, explain: '大阿爾克那編號 0～21，共 22 張。' },
  { q: '小阿爾克那有幾張？', options: ['22 張', '40 張', '56 張', '78 張'], answer: 2, explain: '四個花色 × 14 張 = 56 張。' },
  { q: '大阿爾克那的第一張（0 號）是哪張牌？', options: ['魔術師', '世界', '愚者', '皇帝'], answer: 2, explain: '0 號愚者是旅程的起點。' },
  { q: '大阿爾克那的最後一張（21 號）是？', options: ['審判', '世界', '太陽', '星星'], answer: 1, explain: '21 號世界代表旅程的圓滿。' },
  { q: '「聖杯」對應哪個元素？', options: ['火', '水', '風', '土'], answer: 1, explain: '聖杯 = 水，代表情感與關係。' },
  { q: '「權杖」對應哪個元素？', options: ['火', '水', '風', '土'], answer: 0, explain: '權杖 = 火，代表熱情與行動。' },
  { q: '「寶劍」對應哪個元素？', options: ['火', '水', '風', '土'], answer: 2, explain: '寶劍 = 風，代表思考與溝通。' },
  { q: '「錢幣」對應哪個元素？', options: ['火', '水', '風', '土'], answer: 3, explain: '錢幣 = 土，代表金錢與現實。' },
  { q: '牌面上下顛倒稱為？', options: ['反轉', '逆位', '倒牌', '負位'], answer: 1, explain: '上下顛倒叫逆位，正的叫正位。' },
  { q: '偉特塔羅是哪一年出版的？', options: ['1609 年', '1809 年', '1909 年', '1999 年'], answer: 2, explain: '1909 年由 Rider 出版社出版。' },
  { q: '偉特塔羅的畫家是誰？', options: ['A. E. 偉特', '潘蜜拉・科爾曼・史密斯', '達文西', '阿萊斯特・克勞利'], answer: 1, explain: '偉特負責設計，潘蜜拉・科爾曼・史密斯負責繪製。' },
  { q: '每個花色有幾張宮廷牌？', options: ['2 張', '3 張', '4 張', '5 張'], answer: 2, explain: '侍者、騎士、皇后、國王，共 4 張。' },
  { q: '以下何者「不是」小阿爾克那的花色？', options: ['權杖', '聖杯', '星星', '錢幣'], answer: 2, explain: '星星是大阿爾克那 17 號，不是花色。' },
]

// 委託：NPC 的問題
export const COMMISSIONS: { npc: string; emoji: string; question: string; spread: string[] }[] = [
  { npc: '麵包店的阿梅', emoji: '👩‍🍳', question: '我想把麵包店擴大經營，現在是好時機嗎？', spread: ['現況', '挑戰', '建議'] },
  { npc: '旅人小林', emoji: '🧳', question: '我該不該辭職去國外生活一年？', spread: ['過去', '現在', '未來'] },
  { npc: '學生小雨', emoji: '🎒', question: '我和好朋友吵架了，該怎麼修復關係？', spread: ['現況', '阻礙', '建議'] },
  { npc: '鐵匠老王', emoji: '🔨', question: '我覺得最近做什麼都提不起勁，怎麼了？', spread: ['原因', '現在', '出路'] },
  { npc: '詩人阿月', emoji: '🪶', question: '我暗戀一個人很久了，該不該告白？', spread: ['我的心', '對方', '建議'] },
  { npc: '村長爺爺', emoji: '👴', question: '退休後的生活，我該怎麼安排？', spread: ['過去', '現在', '未來'] },
  { npc: '新手商人小潔', emoji: '💼', question: '我想創業但很害怕失敗，該怎麼面對？', spread: ['恐懼', '資源', '建議'] },
  { npc: '畫家小藍', emoji: '🎨', question: '我卡在創作瓶頸很久了，怎麼突破？', spread: ['現況', '阻礙', '突破口'] },
]

// 依等級的稱號
export const TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: '迷途的愚者' },
  { minLevel: 3, title: '見習占卜師' },
  { minLevel: 5, title: '牌靈的朋友' },
  { minLevel: 7, title: '大阿爾克那探索者' },
  { minLevel: 10, title: '愚者之旅完成者' },
  { minLevel: 15, title: '逆影行者' },
]
