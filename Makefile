SERVICES = backend frontend databank nginx
URL = https://localhost:8443

# Setup everything from scratch
all: certs build up

# Generate SSL certificates
certs:
	@echo "🔐 Generating SSL certificates..."
	@chmod +x ./scripts/certs.sh
	@./scripts/certs.sh

# Build all containers
build:
	@echo "🔨 Building all containers..."
	@docker compose build

# Start all services (detached)
up:
	@echo "🚀 Starting all services..."
	@docker compose up -d
	@echo "✅ Services started. Access the app at $(URL)"

# Start services with logs visible
dev:
	@echo "🔧 Starting services in development mode..."
	@docker compose up

# Stop and remove containers
down:
	@echo "🛑 Stopping all services..."
	@docker compose down
	@echo "✅ Services stopped"

# Stop containers without removing them
stop:
	@echo "⏸️  Stopping containers..."
	@docker compose stop
	@echo "✅ Containers stopped"

# Restart all services
restart: down up
	@echo "🔄 Services restarted"

# Full rebuild
re: fclean all
	@echo "🔄 Full rebuild complete"

# Clean up containers and networks
clean:
	@echo "🧹 Cleaning up containers and networks..."
	@docker compose down -v
	@docker system prune -f
	@echo "✅ Cleanup complete"

# Deep clean - remove everything including images
fclean: clean
	@echo "🧹 Deep cleaning - removing images..."
	@docker compose down -v --rmi all
	@docker system prune -af
	@echo "✅ Deep cleanup complete"

# Database operations
db-reset:
	@echo "🗄️  Resetting database..."
	@docker compose exec databank rm -rf /app/data/database.db || true
	@docker compose restart databank
	@echo "✅ Database reset"

# Check service status
status:
	@echo "📊 Service Status:"
	@docker compose ps

# View resource usage
stats:
	@echo "📈 Resource Usage:"
	@docker stats --no-stream

# Show logs - usage: make logs [service]
# Valid services: backend, frontend, databank, nginx
logs:
	@SERVICE="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -z "$$SERVICE" ]; then \
		echo "📋 Showing logs for all services..."; \
		docker compose logs -f; \
	elif echo "$(SERVICES)" | grep -wq "$$SERVICE"; then \
		echo "📋 Showing logs for $$SERVICE..."; \
		docker compose logs -f "$$SERVICE"; \
	else \
		echo "❌ Invalid service. Available services: $(SERVICES)"; \
		echo "Usage: make logs <service>"; \
		exit 1; \
	fi

# Open shell in container - usage: make shell [service]
# Valid services: backend, frontend, databank, nginx
shell:
	@SERVICE="$(filter-out $@,$(MAKECMDGOALS))"; \
	if echo "$(SERVICES)" | grep -wq "$$SERVICE"; then \
		echo "🐚 Opening shell in $$SERVICE container..."; \
		docker compose exec "$$SERVICE" sh; \
	else \
		echo "❌ Invalid service. Available services: $(SERVICES)"; \
		echo "Usage: make shell [service]"; \
		exit 1; \
	fi

help:
	@echo "Available Commands"
	@echo ""
	@echo "Setup & Build:"
	@echo "  make           - Generate certificates and build all containers"
	@echo "  make certs     - Generate SSL certificates"
	@echo "  make build     - Build all Docker containers"
	@echo ""
	@echo "Running:"
	@echo "  make up        - Start all services (detached)"
	@echo "  make dev       - Start all services with logs visible"
	@echo "  make down      - Stop and remove all containers"
	@echo "  make stop      - Stop containers without removing them"
	@echo "  make restart   - Stop and start all services"
	@echo ""
	@echo "Development:"
	@echo "  make logs <service>   - Show logs (all services or specific: ${SERVICES})"
	@echo "  make shell [service]  - Open shell (${SERVICES})"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean     - Remove containers, networks, and volumes"
	@echo "  make fclean    - Deep clean: remove everything including images"
	@echo "  make re        - Full rebuild (clean + all)"

${SERVICES}:
	@:

.DEFAULT:
	@make help

.PHONY: all certs build up dev down stop restart logs shell clean fclean re db-reset status stats help ${SERVICES}
