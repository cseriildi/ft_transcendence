# Formatting Setup

## Quick Start

No installation needed! Just run this once:

```bash
bash scripts/setup-prettier-hook.sh
```

That's it! You're ready to go.

## How It Works

The pre-commit hook will:
- ✅ Automatically format all staged files with Prettier before each commit
- ✅ Re-stage the formatted files automatically
- ✅ Prevent commits with unformatted code
- ✅ Download Prettier on first run using `npx` (no installation needed!)
- ✅ Cache Prettier locally for faster subsequent commits

**First commit**: ~10 seconds (npx downloads Prettier)
**Subsequent commits**: instant (Prettier is cached)

## What Happens

1. You stage changes: `git add .`
2. You commit: `git commit -m "message"`
3. Hook automatically runs `prettier --write` on your staged files
4. Formatted files are re-staged
5. Commit proceeds with properly formatted code

## Manual Formatting Anytime

```bash
# Format all files
npx prettier --write .

# Check formatting without changing files
npx prettier --check .
```

## Remove the Hook

If you want to disable the hook:

```bash
rm .git/hooks/pre-commit
```

## GitHub Actions

The repository also has a GitHub Action that checks formatting on every pull request. If your code isn't formatted, the PR check will fail. Just run the formatting commands above to fix it.
