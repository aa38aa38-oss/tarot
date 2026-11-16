# 🔮 塔羅之旅 Tarot Quest

邊玩邊學的塔羅牌學習平台。像 RPG 一樣升級：學牌義、打怪答題、收集圖鑑、每日一抽、幫 NPC 解讀牌陣，再一鍵複製提示詞請 AI 老師批改。

## 目前內容（MVP：新手村 Lv 1–10）

| 功能 | 說明 |
|---|---|
| 🗺️ 冒險地圖 | 序章（塔羅基礎）＋ 六章（22 張大阿爾克那）＋ 終章 Boss |
| 📖 課程 | 每張牌：正位牌義、牌面象徵、愚者之旅、記憶訣竅、逆位預習、反思問題 |
| ⚔️ 戰鬥 | 8 種題型（看圖認牌、關鍵字、象徵、情境題、編號、星象…），答對攻擊、答錯扣血、連擊暴擊 |
| 🎯 訓練場 | 間隔重複：越不熟的牌越常出現 |
| ⚡ 跳級測驗 | 有基礎的玩家答對 12/15 即可解鎖全部章節 |
| 📖 圖鑑 | 收服的牌會亮起，並顯示 1～5 星熟練度 |
| 🌅 每日一抽 | 寫心得、累積連續天數、塔羅日記 |
| 📜 委託 | NPC 帶著問題來，三張牌陣解讀練習 |
| 🤖 AI 提示詞 | 課程、每日一抽、委託都能一鍵複製提示詞，貼到 ChatGPT / Claude / Gemini |
| ☁️ 雲端存檔 | Supabase 登入（Google 或 Email 連結），跨裝置同步；未登入時存在瀏覽器 |

之後的區域（逆位、小阿爾克那、牌陣、大師殿堂）已在地圖上預留。

## 本機開發

```bash
npm install
npm run dev
```

## 設定雲端存檔（Supabase，免費方案即可）

1. 到 <https://supabase.com> 建立新專案。
2. 打開 **SQL Editor**，貼上 [`supabase/schema.sql`](supabase/schema.sql) 並執行。
3. **Authentication → URL Configuration**：把網站網址（例如 `https://<帳號>.github.io/tarot/`）加入 *Site URL* 與 *Redirect URLs*；本機開發再加上 `http://localhost:5173`。
4. （選用）**Authentication → Providers → Google**：啟用 Google 登入。Email 登入連結預設就能用。
5. **Settings → API**：複製 *Project URL* 和 *anon public key*。
   - 本機：複製 `.env.example` 為 `.env.local` 並填入。
   - GitHub Pages：到 repo **Settings → Secrets and variables → Actions** 新增 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。

anon key 本來就會出現在前端，資料安全由資料表的 Row Level Security 保護（每個人只能讀寫自己的存檔）。

## 部署到 GitHub Pages

1. repo **Settings → Pages → Source** 選 **GitHub Actions**。
2. 推送到 `main` 分支，`.github/workflows/deploy.yml` 會自動建置並發布。

## 專案結構

```
src/
  data/majorArcana.ts   22 張大牌的教材內容
  data/world.ts         區域、章節、怪物、入門課、委託 NPC、稱號
  lib/game.ts           存檔格式、等級／經驗值、間隔重複、存檔合併
  lib/questions.ts      出題引擎
  lib/prompts.ts        AI 提示詞
  lib/useSave.ts        本機＋雲端存檔同步
  screens/              各個畫面
public/cards/           78 張牌面圖（已備好小阿爾克那，供之後擴充）
```

## 圖像來源

牌面為 1909 年 Rider-Waite-Smith 塔羅，Pamela Colman Smith 繪製，屬公有領域（不是 1971 年 U.S. Games 的重新上色版）。掃描檔為 Holly Voley 掃描版（Wikimedia Commons），取自 [Taro's Tarot](https://tarostarot.com/tarot-card-data)。
