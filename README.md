# Dynasty Trade Calculator

A modern web application for calculating and evaluating trades in dynasty fantasy football leagues. Player and draft pick values come from the free [FantasyCalc API](https://api.fantasycalc.com), which derives values from thousands of real dynasty trades and updates daily.

## Features

- **Live trade values** — players and rookie draft picks, powered by FantasyCalc (free, no API key required)
- **Trade evaluation** — fairness verdict, value gap, and suggestions to even out lopsided trades
- **League settings** — 1QB or Superflex, TE Premium (+0.5 / +1.0), Standard / 0.5 PPR / Full PPR, 8–16 teams
- **Player rankings** — tabbed rankings (Overall / QB / RB / WR / TE / Picks) with 30-day value trends
- **Devy rankings** — crowdsourced devy (college player) values from KeepTradeCut, with college, projected draft year, and trends
- **College stats** — click any devy player to see their measurables and latest season stats from CollegeFootballData (optional free API key)
- **Rookie draft** — rookie big board for the current class, plus a mock draft simulator (linear or snake, sim picks, value-ranked results)
- **Sleeper league sync** — enter your Sleeper username to import your leagues, auto-detect league settings, see power rankings, and get personalized trade recommendations that improve your starting lineup
- **Trade history** — sign in with Firebase to save trades to the cloud
- Modern, responsive dark UI built with Material-UI

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

No environment variables or API keys are needed for the core app — FantasyCalc and Sleeper (player headshots) are free public APIs, and the Firebase web config is bundled.

### Optional: college stats on the Devy tab

1. Register for a free API key at [collegefootballdata.com/key](https://collegefootballdata.com/key) (sent by email)
2. Copy `.env.example` to `.env` and paste your key:

```bash
VITE_CFB_API_KEY=your_key_here
```

3. Restart the dev server

## Deploying to Vercel

The app deploys as a static Vite site plus two serverless functions:

- `api/devy.ts` — scrapes KeepTradeCut server-side and caches it for an hour, so visitors never hit KTC directly
- `api/college.ts` — proxies CollegeFootballData so your API key stays out of the client bundle

Setup:

1. Import the repo in Vercel (framework preset: Vite)
2. Add the environment variable `CFB_API_KEY` (your CollegeFootballData key) in the Vercel project settings
3. In the [Firebase console](https://console.firebase.google.com) → Firestore → Rules, paste the contents of `firestore.rules` so users can only access their own saved trades

## Technologies Used

- React 18 + TypeScript
- Material-UI (MUI)
- Vite
- Firebase (Auth + Firestore for saved trades)
- FantasyCalc API (player values) and Sleeper CDN (player headshots)
- KeepTradeCut devy rankings (fetched through a dev-server proxy / Vercel rewrite, since KTC has no public API)

## Contributing

Feel free to submit issues and enhancement requests!
