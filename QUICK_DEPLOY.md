# Quick Deploy Guide 🚀

## Choose Your Platform:

### 🌟 GitHub Pages (Free, Easy)

**Step 1:** Create a GitHub repository
- Go to [github.com](https://github.com)
- Click "New repository"
- Name it (e.g., "love-tree-2025")
- Make it public
- Create repository

**Step 2:** Upload your code
```bash
# If you have git installed:
git init
git add .
git commit -m "Deploy Love Tree 2025"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

**Step 3:** Enable GitHub Pages
- Go to your repo → Settings → Pages
- Source: Select "GitHub Actions"
- Save

**Done!** Your site will be at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

---

### ⚡ Vercel (Easiest, No Config Needed)

**Option A - Web Interface:**
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"
6. Done! Get instant URL

**Option B - CLI:**
```bash
npm i -g vercel
vercel
```
Follow the prompts. Done in 30 seconds!

---

### 🌐 Netlify (Also Easy)

**Option A - Drag & Drop:**
1. Run: `npm run build`
2. Go to [netlify.com](https://netlify.com)
3. Drag your `dist` folder
4. Done!

**Option B - Git:**
1. Connect GitHub repo to Netlify
2. Auto-deploys on every push!

---

## Which Should You Choose?

- **GitHub Pages**: Free, good for static sites, uses your GitHub username
- **Vercel**: Fastest setup, better performance, custom domains
- **Netlify**: Similar to Vercel, also great

**Recommendation:** Start with **Vercel** - it's the easiest! 🎯

---

## Need Help?

Check `GITHUB_DEPLOY.md` for detailed GitHub Pages instructions.

