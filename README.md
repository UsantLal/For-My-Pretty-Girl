# Christmas Tree (local development)

Quick instructions to run this project locally on Windows.

Prerequisites
- Install Node.js LTS from https://nodejs.org/ (Windows installer).

One-click (recommended for non-technical users)
- Double-click `start-dev.bat` in the project folder. It will:
  - run `npm install` if needed
  - open a new terminal running the dev server
  - open your browser at http://localhost:5173

Manual (PowerShell)
```powershell
cd "d:\CIBM - USANT 2024\For You Kaka\22-to-25"
npm install
npm start
```

Alternative commands
- Run the dev server without opening browser: `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

Stopping the server
- Close the terminal window running the dev server, or press `Ctrl+C` in that terminal.

Troubleshooting
- If `npm` is not found, ensure Node.js was installed and restart your terminal.
- If the port is already in use, change Vite port in `vite.config.ts` or stop the other process.

Questions or want me to update this README with screenshots? Reply and I'll help.
# 🎆 FROM 22 TO 25 & STILL COUNTING 🎆

A beautiful 3D interactive Love Tree with memories, built with React, Three.js, and AI gesture recognition.

## ✨ Features

- 🌌 **Galaxy & Love Theme** - Beautiful cosmic design with pink and purple colors
- 📸 **300+ Photo Memories** - Display all your photos in a 3D tree
- 🤖 **AI Gesture Control** - Control with hand gestures (Open Palm, Fist, etc.)
- 📱 **Mobile Optimized** - Works perfectly on phones and tablets
- 🎯 **Touch Support** - Tap photos to zoom in/out
- ✨ **Interactive 3D** - Rotate, zoom, and explore your memories

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📱 Mobile Features

- Touch to zoom photos
- Responsive UI that adapts to screen size
- Gesture controls work on mobile
- Optimized for portrait and landscape

## 🎮 Gesture Controls

- 🖐 **Open Palm** → Disperse stars
- ✊ **Fist** → Assemble galaxy
- 👋 **Hand Left/Right** → Rotate universe
- 🤏 **Hands Closer** → Zoom in
- 🤏 **Hands Farther** → Zoom out
- 👆 **Tap Photo** → View memory

## 📦 Deploy

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### GitHub Pages
```bash
npm run deploy
```

See `QUICK_DEPLOY.md` for detailed instructions.

## 💕 Made with Love

This project was created as a special gift for memories and love.

---

**Happy New Year! 🎉💕**

## 🎵 Add background music

Place an MP3 file named `music.mp3` in the project's `public` folder (path: `public/music.mp3`). The app will try to autoplay it on load. If autoplay is blocked or `public/music.mp3` is missing, the player will automatically try a fallback hosted sample. The player runs without visible controls (autoplay only). If autoplay is blocked by the browser, you may need to interact with the page (click/tap) to enable audio.

Notes:
- Use an MP3 you have the rights to. Large files will increase load time.
- Browsers may block autoplay until the user interacts with the page.
 - If you want a sample MP3, you can download one into `public/music.mp3`.
   Example PowerShell command to run from the project folder:

```powershell
cd "d:\CIBM - USANT 2024\For You Kaka\22-to-25"
(New-Object System.Net.WebClient).DownloadFile('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3','public\\music.mp3')
```
