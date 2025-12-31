# Deployment Guide

## Mobile-Optimized & Ready to Deploy! 📱✨

Your app is now mobile-friendly and ready to deploy to the web!

## Quick Deploy Options

### Option 1: Deploy to Vercel (Recommended - Easiest)

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   Follow the prompts. Your app will be live in seconds!

   Or use the web interface:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your repository
   - Vercel will auto-detect Vite and deploy!

### Option 2: Deploy to Netlify

1. **Install Netlify CLI** (if not installed):
   ```bash
   npm i -g netlify-cli
   ```

2. **Build your app**:
   ```bash
   npm run build
   ```

3. **Deploy**:
   ```bash
   netlify deploy --prod --dir=dist
   ```

   Or use the web interface:
   - Go to [netlify.com](https://netlify.com)
   - Sign up/login
   - Drag and drop your `dist` folder
   - Done!

### Option 3: Deploy to GitHub Pages

1. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json scripts**:
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Enable GitHub Pages** in your repo settings:
   - Settings → Pages
   - Source: `gh-pages` branch
   - Save

## Mobile Features Added ✨

✅ **Touch Support**: Tap photos to zoom in/out
✅ **Responsive UI**: All buttons and text scale for mobile
✅ **Mobile Viewport**: Optimized for phone screens
✅ **Touch Gestures**: Works with hand gestures on mobile
✅ **No Scrolling**: Prevents accidental scrolling
✅ **Full Screen**: Optimized for mobile browsers

## Build for Production

```bash
npm run build
```

This creates a `dist` folder with all optimized files ready to deploy!

## Test Locally

```bash
npm run dev
```

Then open on your phone:
- Find your computer's IP address (e.g., `192.168.1.100`)
- On your phone, go to: `http://YOUR_IP:5173`

## Tips for Mobile

- Works best in Chrome/Safari mobile browsers
- Enable gestures for full experience
- Tap photos to zoom in
- Use two hands for zoom gestures
- Works in portrait and landscape mode

## Need Help?

- Check console for any errors
- Make sure all photos are in `/public/photos/`
- Test on actual device for best results

Happy Deploying! 🚀💕

