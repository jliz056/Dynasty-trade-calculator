# 📋 Project Charter — Fantasy Trade Calculator

## 🏈 Project Name
**Fantasy Trade Calculator** — Inspired by Sleeper.app

## 🎯 Objective
Build a modern web application that allows users to evaluate fantasy football trades, scout draft prospects, and view detailed player statistics for both NFL and NCAA players.

## 🧱 Tech Stack
| Layer        | Tech                | Description                              |
|--------------|---------------------|------------------------------------------|
| Frontend     | React + Tailwind    | Clean UI with auto-complete and modals   |
| Backend      | Flask (Python)      | API endpoints for data & calculations    |
| Data Sources | Sleeper, CFB API    | NFL & NCAA data                          |
| Hosting      | Vercel              | Deploy both backend & frontend           |
| Dev Tool     | Cursor              | Development using modular components     |

## 🔑 Core Features
1. **Login Page**
   - Simple email input to access the app
   - Redirects to Trade Calculator upon login

2. **Trade Calculator**
   - Select Team A and Team B players
   - Calculate trade value using a real algorithm
   - Displays per-player value, total value, and visual bar chart
   - Supports league settings:
     - **Scoring format**: PPR, Half-PPR, Standard, TE Premium
     - **League size**: 8, 10, 12, 14 teams
     - **Format**: Redraft, Dynasty, Yearly

3. **Player Stats Viewer**
   - Modal with 4 tabs:
     - Game Log (week-by-week stats)
     - Career Stats (NFL + NCAA)
     - Fantasy History (season performance + trade history)
     - Current Team (roster context)

4. **Draft Interface**
   - Search NCAA rookies (via CollegeFootballData)
   - Add prospects to a draft board

5. **League Overview**
   - Visualize full rosters of Team A and Team B

## 🌐 API Endpoints
### NFL Players (Sleeper)
`GET /api/players/nfl` → returns active NFL players

### NCAA Draftable Players (CollegeFootballData)
`GET /api/players/ncaa` → returns senior college prospects

### Trade Value Calculation
`POST /api/trade/calculate`
```json
{
  "teamA": ["1", "2"],
  "teamB": ["3"],
  "settings": {
    "scoring": "PPR",
    "league_size": 12,
    "format": "Dynasty"
  }
}
```
→ Returns value per player, total team values, and a trade verdict

## 🔐 Environment Variables
- `CFB_API_KEY` → CollegeFootballData.com API key

## 🗂 Folder Structure
```
/api
  ├── players.py           # Sleeper + CFB API data
  ├── trade.py             # Trade calculator route with league settings
/components
  ├── PlayerSelector.jsx
  ├── PlayerModal.jsx
  ├── TradeSettings.jsx    # UI for configuring league settings
/pages
  ├── Home.jsx             # Main app interface post-login
  ├── LoginPage.jsx        # Entry point for the app
app.py                     # Flask app entry
.env                       # Local secrets
requirements.txt           # Python dependencies
PROJECT_CHARTER.md         # This file
```

## ✅ Next Steps
1. Create the project structure in Cursor (files + folders)
2. Add `.env` with the CFB API key
3. Build missing React components (`TradeSettings`, `LoginPage`)
4. Integrate league settings in `/api/trade/calculate`
5. Run backend (`flask run`) and frontend (`npm run dev`)
6. Push to GitHub and deploy on Vercel with env variables

---

Let’s build something fantasy football players will *actually* use 🏆


