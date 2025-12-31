# Push to GitHub - Step by Step Guide 🚀

## Step 1: Install Git (if not installed)

Download Git from: https://git-scm.com/download/win
Install it, then restart your terminal.

## Step 2: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon → **"New repository"**
3. Name it (e.g., "love-tree-2025" or "christmas-tree-main")
4. Make it **Public** (required for free GitHub Pages)
5. **DON'T** initialize with README, .gitignore, or license
6. Click **"Create repository"**

## Step 3: Push Your Code

Open PowerShell or Command Prompt in your project folder and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Love Tree 2025"

# Rename branch to main
git branch -M main

# Add your GitHub repository (replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **"GitHub Actions"**
4. Save

Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## Alternative: Use GitHub Desktop

If you prefer a GUI:
1. Download [GitHub Desktop](https://desktop.github.com/)
2. Sign in with your GitHub account
3. File → Add Local Repository
4. Select your project folder
5. Click "Publish repository"
6. Done!

## Troubleshooting

**"git is not recognized"**
- Install Git from https://git-scm.com/download/win
- Restart your terminal

**"Authentication failed"**
- Use a Personal Access Token instead of password
- Go to GitHub → Settings → Developer settings → Personal access tokens
- Generate new token with "repo" permissions
- Use token as password when pushing

**Need help?** Check the error message and let me know!

