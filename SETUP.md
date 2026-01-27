# JJK Group Drawing Wheel — Setup Guide

## Features
- ✨ **Celebration confetti** when character is finalized
- 🔄 **Real-time sync** across 3 devices (Firebase Realtime DB)
- 🎨 **No character repetition** in a drawing session
- ↩️ **Undo** to restore previous character
- 💾 **Persistent state** with localStorage

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Firebase Setup (Optional but Recommended for 3-Member Group)

If you want **real-time sync** across your 3 devices:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Click **Realtime Database** > Create Database
   - Start in **test mode** (allows reads/writes)
   - Choose **closest region**
4. Click your project > **Settings** > **General** > scroll to **Your apps** > copy the config
5. Open `src/firebase.js` and replace the `firebaseConfig` object with your config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBlxbKdYDl47G1heeJ2jy9kZB-CLS2dQC0",
  authDomain: "realtime-database-2a3e8.firebaseapp.com",
  projectId: "realtime-database-2a3e8",
  storageBucket: "realtime-database-2a3e8.firebasestorage.app",
  messagingSenderId: "199047295044",
  appId: "1:199047295044:web:dd7327cebd4f98ccee4c11",
  measurementId: "G-N6974ETZPX"
};
```

6. All 3 members use the same **session ID** via URL parameter (see next section).

## Using Same Session ID (Shared Sync)

**Important:** All 3 devices must use the **same session ID** to sync in real-time.

### Local Dev (3 Devices on Same Network)

1. Run:
```bash
npm run dev -- --host
```

2. First person opens: `http://192.168.1.100:5173/?session=group-drawing-2026`
   - Replace `192.168.1.100` with your PC's IP (shown in terminal)
   - Session name can be anything: `group-drawing-2026`, `jjk-week1`, etc.

3. **Share that exact URL** with the other 2 members
   - They open the **same link** → same session ID → instantly synced! 🔄

### Production Deploy (Vercel/Firebase Hosting)

Once deployed to `https://example.com`:

1. Person A creates session: `https://example.com/?session=group-2026-jan`
2. Share URL with Persons B & C
3. They open same link → all synced! ✅

**Generate shareable link format:**
- `https://your-domain.com/?session=drawing-week-1`
- `https://your-domain.com/?session=jjk-group`
- Any name works — just use **same name for all 3**

### 3. Run Dev Server
```bash
npm run dev
```

### 4. Mobile Access (3 Devices)
```bash
npm run dev -- --host
```

Then each person opens the network IP shown (e.g., `http://192.168.1.100:5173`) on their phone/device.

## How It Works

### Without Firebase (Local Only)
- **Pro:** No setup needed.
- **Con:** Each device has independent state. Spins don't sync.

### With Firebase (Recommended for Group)
- When **anyone spins**, the character is **removed for all 3 devices instantly**.
- Each spin **triggers confetti** on all devices.
- **No repetition** — character can't be picked again this session.
- **UNDO** restores character on all devices.
- **RESET** clears all devices.

## Character Images

Add images to `public/images/`:
- `gojo.jpg`, `sukuna.jpg`, `toji.jpg`, etc.
- Update the mapping in `src/App.jsx` under `characterImages` object.
- Fallback: `/images/placeholder.svg` if image missing.

## Troubleshooting

### Firebase not syncing?
- Check config in `src/firebase.js` is correct.
- Ensure Realtime Database exists and is in **test mode**.
- Browser console should show sync messages.

### Confetti not showing?
- It's a one-time animation (5 seconds). Modal auto-closes after 5 seconds.
- Click the `×` button to close early and restart confetti on next spin.

## Demo Flow
1. Person A spins → gets **Gojo Satoru** → confetti 🎉 → all 3 phones see it removed
2. Person B spins → can't get Gojo (already eliminated) → random other character
3. Person C spins → another character selected
4. Anyone clicks **UNDO** → restores last character on all phones
5. Click **Reset Wheel** → all characters back, ready for next week

## Files Modified
- `package.json` — added Firebase & confetti
- `src/App.jsx` — sync logic, confetti, session ID
- `src/firebase.js` — Firebase config & operations
- `src/App.css` — modal styles (no changes needed)

Enjoy! 🎨✨
