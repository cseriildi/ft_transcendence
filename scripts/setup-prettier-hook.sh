#!/bin/bash

# Setup Prettier pre-commit hook
# Run this once to enable automatic formatting before commits

set -e

HOOK_DIR=".git/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

# Create hooks directory if it doesn't exist
mkdir -p "$HOOK_DIR"

# Create the pre-commit hook
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash

# Check if npx is available (comes with Node.js)
if ! command -v npx &> /dev/null; then
  echo "❌ npx not found. Please install Node.js"
  exit 1
fi

# Format staged files with Prettier before commit
echo "🎨 Running Prettier on staged files..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | tr '\n' ' ')

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No files to format"
  exit 0
fi

# Use npx to run prettier (it respects .prettierignore)
npx prettier --write $STAGED_FILES

# Re-stage the formatted files
git add $STAGED_FILES

echo "✅ Formatting complete!"
EOF

# Make the hook executable
chmod +x "$HOOK_FILE"

echo "✅ Pre-commit hook installed successfully!"
echo "📝 From now on, Prettier will automatically format your code before each commit."
echo ""
echo "To uninstall, run: rm .git/hooks/pre-commit"
