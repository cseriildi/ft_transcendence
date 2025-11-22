
LOCAL_IP := $(shell ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $$7; exit}' || echo localhost)

# Port configuration (use: sudo make ports=privileged up)
# privileged: 443/80 (requires sudo), school: 8443/8080 (default)
ifeq ($(ports),privileged)
	HTTPS_PORT = 443
	HTTP_PORT = 80
	# For standard ports, don't include port in URL
	PUBLIC_API_URL = https://$(LOCAL_IP)
	PUBLIC_WS_URL = wss://$(LOCAL_IP)/ws
	URL = https://$(LOCAL_IP)
else
	HTTPS_PORT = 8443
	HTTP_PORT = 8080
	# For non-standard ports, include port in URL
	PUBLIC_API_URL = https://$(LOCAL_IP):8443
	PUBLIC_WS_URL = wss://$(LOCAL_IP):8443/ws
	URL = https://$(LOCAL_IP):8443
endif

SERVICES = backend frontend databank nginx

# Setup everything from scratch
all: env certs setup-dirs build up

# Setup environment file
env:
# Replace localhost with actual local IP in .env
	sed 's/localhost/$(LOCAL_IP)/g' .env.example > .env || true

# Generate SSL certificates
certs:
	@echo "🔐 Generating SSL certificates..."
	@chmod +x ./scripts/certs.sh
	@./scripts/certs.sh

# Setup data directories with proper permissions
setup-dirs:
	@echo "📁 Setting up data directories..."
	@mkdir -p backend_database/database || true
	@mkdir -p live-chat/data || true
	@echo "✅ Data directories created (permissions will be set by containers)"

# Build all containers
build:
	@echo "🔨 Building all containers..."
	@docker compose build

# Start all services (detached)
up:
	@echo "🚀 Starting all services..."
	@echo "📡 HTTPS: $(HTTPS_PORT), HTTP: $(HTTP_PORT) → HTTPS"
	@NGINX_HTTPS_PORT=$(HTTPS_PORT) NGINX_HTTP_PORT=$(HTTP_PORT) \
		PUBLIC_API_URL=$(PUBLIC_API_URL) PUBLIC_WS_URL=$(PUBLIC_WS_URL) \
		docker compose up -d
	@echo "✅ Services started. Access the app at $(URL)"

# Start services with logs visible
dev:
	@echo "🔧 Starting services in development mode..."
	@echo "📡 HTTPS: $(HTTPS_PORT), HTTP: $(HTTP_PORT) → HTTPS"
	@NGINX_HTTPS_PORT=$(HTTPS_PORT) NGINX_HTTP_PORT=$(HTTP_PORT) \
		PUBLIC_API_URL=$(PUBLIC_API_URL) PUBLIC_WS_URL=$(PUBLIC_WS_URL) \
		docker compose up

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
re: clean env certs setup-dirs build up
	@echo "🔄 Full rebuild complete"

# Deep clean and full rebuild
fre: fclean env certs setup-dirs build up
	@echo "🔄 Full rebuild complete"

# Clean up containers and networks
clean:
	@echo "🧹 Cleaning up containers and networks"
	@docker compose down --rmi local
	@docker system prune -f
	@echo "✅ Cleanup complete"

# Deep clean - remove everything including images
fclean:
	@echo "⚠️  WARNING: This will DELETE EVERYTHING including:"
	@echo "   - All containers and images"
	@echo "   - All volumes (database data)"
	@echo "   - All unused Docker resources"
	@echo ""
	@printf "Are you sure you want to continue? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		[Yy]*) echo "Proceeding with deep clean..." ;; \
		*) echo "❌ fclean cancelled"; exit 1 ;; \
	esac
	@$(MAKE) clean
	@$(MAKE) db-reset
	@echo "🧹 Deep cleaning - removing images and volumes..."
	@docker compose down -v --rmi all
	@docker system prune -af
	@echo "✅ Deep cleanup complete"

# Database operations
db-reset:
	@echo "🗄️  Resetting database..."
	@# Stop containers first to prevent .nfs* file creation (NFS issue when deleting open files)
	@echo "Stopping database containers..."
	@docker compose stop databank live-chat 2>/dev/null || true
	@sleep 1
	@# Remove database files
	@echo "Removing backend database..."
	@rm -f backend_database/database/database.db 2>/dev/null || true
	@echo "Removing live-chat database..."
	@rm -f live-chat/data/database.db 2>/dev/null || true
	@# Clean up any .nfs* files
	@echo "Cleaning up .nfs* artifacts..."
	@find backend_database/database -name '.nfs*' -type f -delete 2>/dev/null || true
	@find live-chat/data -name '.nfs*' -type f -delete 2>/dev/null || true
	@echo "✅ Database reset complete"

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
	@echo "  make                  - Setup .env, generate certificates, setup dirs, and build all containers"
	@echo "  make env              - Create .env file from .env.example (if not exists)"
	@echo "  make certs            - Generate SSL certificates"
	@echo "  make setup-dirs       - Create data directories with proper permissions"
	@echo "  make build            - Build all Docker containers"
	@echo ""
	@echo "Running:"
	@echo "  make up               - Start all services (detached)"
	@echo "  make dev              - Start all services with logs visible"
	@echo "  make down             - Stop and remove all containers"
	@echo "  make stop             - Stop containers without removing them"
	@echo "  make restart          - Stop and start all services"
	@echo ""
	@echo "Port Configuration:"
	@echo "  make ports=privileged up    - Use ports 443/80 (requires sudo)"
	@echo "  make up                     - Use ports 8443/8080 (default, no sudo)"
	@echo ""
	@echo "Development:"
	@echo "  make logs <service>   - Show logs (all services or specific: ${SERVICES})"
	@echo "  make shell [service]  - Open shell (${SERVICES})"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            - Remove containers, networks, and volumes"
	@echo "  make fclean           - Deep clean: remove everything including images"
	@echo "  make re               - Full rebuild (clean + all)"
	@echo "  make db-reset         - Reset the database"
	@echo "  make status           - Show status of all services"
	@echo "  make stats            - Show resource usage of all containers"
	@echo "  make fre			   - Deep clean and full rebuild (fclean + all)"

${SERVICES}:
	@:

.DEFAULT:
	@make help

.PHONY: all env certs build up dev down stop restart logs shell clean fclean fre re db-reset status stats help ${SERVICES}
