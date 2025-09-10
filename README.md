# ft_transcendence

command to create package lock file w/o istallin npm:
    docker run --rm -v "$(pwd)":/app -w /app node:18-alpine npm install --package-lock-only