# Deploy to GitHub Pages 🚀

Your app is ready to deploy to GitHub Pages! Here are the steps:

## Option 1: Automatic Deployment (Recommended) ✨

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Love Tree 2025"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your GitHub repository
   - Click **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - Save

3. **That's it!** 
   - Every time you push to `main`, it will automatically deploy
   - Your site will be at: `https://YOUR_USERNAME.github.io/christmas-tree-main/`

## Option 2: Manual Deployment 📦

1. **Install gh-pages** (if not already installed):
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Deploy:**
   ```bash
   npm run deploy
   ```

3. **Enable GitHub Pages:**
   - Go to your GitHub repository
   - Click **Settings** → **Pages**
   - Under **Source**, select **gh-pages** branch
   - Save

## Option 3: Deploy to Vercel (Alternative) 🌐

If you prefer Vercel (easier, no base path needed):

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Or use web interface:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click "New Project"
   - Import your repository
   - Deploy!

## Update Base Path (If needed)

If your repository name is different, update `vite.config.ts`:
```typescript
base: '/YOUR_REPO_NAME/',
```

## Your Live URL

After deployment, your app will be available at:
- **GitHub Pages**: `https://YOUR_USERNAME.github.io/christmas-tree-main/`
- **Vercel**: `https://YOUR_PROJECT.vercel.app`

## Troubleshooting

- **404 errors?** Make sure the base path in `vite.config.ts` matches your repo name
- **Build fails?** Check that all dependencies are installed: `npm install`
- **Photos not loading?** Make sure `/public/photos/` folder is included in the build

Happy Deploying! 💕🎆

