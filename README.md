# 🏆 World Cup 2026 Predictor — Setup Guide

## Step 1: Set up Firebase (free, ~5 minutes)

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"** → name it `wc2026-predictor` → click through
3. In the left sidebar, click **"Firestore Database"** → **"Create database"**
   - Choose **"Start in test mode"** → select any location → Done
4. In the left sidebar, click **"Project settings"** (gear icon)
5. Scroll down to **"Your apps"** → click the **</>** (Web) icon
6. Register the app (any name) → you'll get a config object like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "wc2026-predictor.firebaseapp.com",
  projectId: "wc2026-predictor",
  ...
};
```

7. **Copy those values** into `src/firebase.js` (replace the placeholder values)

---

## Step 2: Deploy to Vercel (free, ~3 minutes)

1. Go to **https://vercel.com** → sign up with Google (free)
2. Click **"Add New Project"**
3. Choose **"Import from Git"** OR drag & drop this folder
   - If drag & drop: zip this entire folder and upload it
4. Vercel auto-detects Vite → just click **"Deploy"**
5. You get a URL like `wc2026-predictor.vercel.app`

**Send that URL to your group — no account needed to use it!**

---

## Scoring Rules
- ⭐ **5 pts** — Exact score
- 🤝 **3 pts** — Correct draw (guessed draw, result was draw, not exact)  
- ✓ **2 pts** — Correct result (right winner)

### Pre-Tournament Bonuses
- 🏆 **10 pts** — Tournament Winner
- ⚽ **12 pts** — Top Scorer
- 🎯 **15 pts** — Top Assists

## Admin Access
Triple-click the 🏆 trophy in the header to unlock the admin panel.
