# Shortest Installation Commands

## 🚀 Ultra-Short Install Options

### Option 1: Custom Domain (Shortest Possible)

If you host `install.sh` on your domain:

```bash
curl -fsSL https://decharge.energy/install | bash
```

Or even shorter with a custom domain:
```bash
curl decharge.run | bash
```

**Setup required:**
- Host `install.sh` at your domain (Vercel, Netlify, GitHub Pages, etc.)
- Configure CORS headers
- Optionally rename to just `install` (no .sh extension)

---

### Option 2: NPM Package (Most Convenient)

Publish to npm registry, then users can:

```bash
npm install -g decharge-scout
```

Or run without installing:
```bash
npx decharge-scout
```

**Setup required:**
- Create npm account
- Publish package to npm registry
- Package name must be unique

---

### Option 3: GitHub Short URL

Using GitHub's URL shortener (deprecated but still works):

```bash
curl -fsSL https://git.io/decharge | bash
```

**Setup required:**
- Create shortened URL via git.io API
- Point to raw.githubusercontent.com install.sh

---

### Option 4: Bit.ly / Custom Short URL

```bash
curl -fsSL https://bit.ly/decharge-scout | bash
```

**Setup required:**
- Create short URL with any URL shortener
- Point to GitHub raw install.sh

---

## 📦 Publishing to NPM (Recommended)

Here's how to make `npm install -g decharge-scout` work:

### Step 1: Prepare package.json

Already done! Your package.json is npm-ready.

### Step 2: Create npm account

```bash
npm adduser
# Follow prompts to create account at npmjs.com
```

### Step 3: Publish

```bash
# Test first
npm publish --dry-run

# Actually publish
npm publish
```

### Step 4: Users install with

```bash
npm install -g decharge-scout
```

Or run directly:
```bash
npx decharge-scout
```

### Step 5: Update versions

When you make changes:
```bash
npm version patch  # 1.0.0 -> 1.0.1
npm publish
```

---

## 🌐 Hosting install.sh on Custom Domain

### Option A: GitHub Pages

1. Create `gh-pages` branch
2. Add `install.sh` to root
3. Enable GitHub Pages
4. Access at: `https://username.github.io/repo/install.sh`

Shorten to:
```bash
curl -fsSL https://username.github.io/repo/install | bash
```

### Option B: Vercel/Netlify

1. Create `public/install` file with install.sh contents
2. Deploy to Vercel/Netlify
3. Configure custom domain (optional)

Then use:
```bash
curl -fsSL https://yourproject.vercel.app/install | bash
```

Or with custom domain:
```bash
curl -fsSL https://decharge.run | bash
```

### Option C: Raw GitHub + URL Shortener

Current long URL:
```
https://raw.githubusercontent.com/sentinelcore/agentone/claude/solana-energy-scout-cli-d7vYT/install.sh
```

Shorten with bit.ly, tinyurl, etc:
```bash
curl -fsSL https://bit.ly/dcharge | bash
```

---

## ⚡ Making it Even Shorter

### 1. Remove `-fsSL` flags (risky)

```bash
curl decharge.run | bash
```

**Note:** `-fsSL` is recommended for security (fail silently, follow redirects, show errors)

### 2. Use wget instead

```bash
wget -O- decharge.run | bash
```

### 3. Use bash shorthand

```bash
bash <(curl -sL decharge.run)
```

### 4. Create shell alias

Add to `~/.bashrc` or `~/.zshrc`:
```bash
alias install-decharge='curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash'
```

Then just:
```bash
install-decharge
```

---

## 🎯 Recommended Setup

### For Public Project (Recommended):

1. **Publish to npm**
   ```bash
   npm publish
   ```

2. **Create short URL** for install.sh
   - Use bit.ly: https://bit.ly/decharge
   - Point to GitHub raw URL

3. **Provide both options**:
   ```bash
   # Via npm (recommended)
   npm install -g decharge-scout

   # Via curl (alternative)
   curl -fsSL https://bit.ly/decharge | bash
   ```

### For Private/Demo Project:

1. **Use GitHub raw URL** with your own shortener
2. **Or stick with one-liner clone**:
   ```bash
   git clone -b <branch> <repo> decharge && cd decharge && node setup.js
   ```

---

## 📝 Complete Publishing Guide

### Publish to NPM (Step-by-Step)

```bash
# 1. Login to npm
npm login

# 2. Check package name is available
npm view decharge-scout  # Should return 404 if available

# 3. Publish
npm publish --access public

# 4. Test installation
npm install -g decharge-scout

# 5. Run
decharge-scout
```

### Update package.json for npm

Already perfect! But you may want to add:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/sentinelcore/agentone.git"
  },
  "bugs": {
    "url": "https://github.com/sentinelcore/agentone/issues"
  },
  "homepage": "https://github.com/sentinelcore/agentone#readme"
}
```

---

## 🎊 Final Result

After setup, users can install with:

### Shortest possible (with npm):
```bash
npm i -g decharge-scout
```

### Shortest possible (with curl):
```bash
curl decharge.run | bash
```

### Via npx (no install):
```bash
npx decharge-scout
```

All three commands take **under 30 characters**! 🎉

---

## 🔥 Comparison

| Method | Command Length | Setup Required | Persistence |
|--------|---------------|----------------|-------------|
| npm global | `npm i -g decharge-scout` (24 chars) | Publish to npm | Installed |
| npx | `npx decharge-scout` (20 chars) | Publish to npm | Temporary |
| curl short | `curl bit.ly/dcharge\|bash` (26 chars) | URL shortener | Installed |
| curl custom | `curl decharge.run\|bash` (24 chars) | Custom domain | Installed |
| git clone | 80+ characters | None | Manual |

**Winner:** `npx decharge-scout` at **20 characters** ⚡

---

## 🚀 Next Steps

Choose your preferred method:

1. **For public release**: Publish to npm
   ```bash
   npm publish
   ```

2. **For quick sharing**: Create bit.ly short URL
   ```bash
   # Point to: raw.githubusercontent.com/.../install.sh
   ```

3. **For professional**: Get custom domain
   ```bash
   # Host install.sh at decharge.run
   ```

Want me to help you publish to npm? I can prepare all the files!
