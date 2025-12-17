# =============================================================================
# Settings
# =============================================================================

SHELL := /bin/sh
MAKEFLAGS += --no-print-directory

# Try to resolve local IP (fallback to localhost)
LOCAL_IP := $(shell ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $$7; exit}' || echo localhost)

# Compose files (ELK always included)
COMPOSE_FILES = -f docker-compose.yml -f docker-compose.elk.yml -f docker-compose.prometheus.yml

# Docker compose wrapper
DOCKER_COMPOSE = docker compose --ansi never

# Silence most docker output; keep errors
QUIET_REDIRECT = >/dev/null 2>&1

# Port configuration (use: sudo make ports=privileged up)
# privileged: 443/80 (requires sudo), school: 8443/8080 (default)
ifeq ($(ports),privileged)
	HTTPS_PORT = 443
	HTTP_PORT = 80
	PUBLIC_API_URL = https://$(LOCAL_IP)
	PUBLIC_WS_URL = wss://$(LOCAL_IP)/ws
	URL = https://$(LOCAL_IP)
else
	HTTPS_PORT = 8443
	HTTP_PORT = 8080
	PUBLIC_API_URL = https://$(LOCAL_IP):8443
	PUBLIC_WS_URL = wss://$(LOCAL_IP):8443/ws
	URL = https://$(LOCAL_IP):8443
endif

SERVICES = backend frontend database nginx

# =============================================================================
# High-level targets
# =============================================================================

# Setup everything from scratch (includes ELK stack)
all: env certs setup-dirs build up

# Full rebuild
re: clean env certs setup-dirs build up
	@echo "🔄 Full rebuild complete"

# Deep clean and full rebuild
fre: fclean env certs setup-dirs build up
	@echo "🔄 Full rebuild complete"

# =============================================================================
# Setup
# =============================================================================

env:
	@echo "🧩 Generating .env using LOCAL_IP=$(LOCAL_IP)..."
	@if [ -f .env ]; then \
		echo "→ Updating existing .env"; \
		sed -i 's/localhost/$(LOCAL_IP)/g' .env; \
	else \
		echo "→ Creating .env from .env.example"; \
		sed 's/localhost/$(LOCAL_IP)/g' .env.example > .env; \
	fi

certs:
	@echo "🔐 Generating SSL certificates..."
	@chmod +x ./scripts/certs.sh
	@./scripts/certs.sh

setup-dirs:
	@echo "📁 Setting up data directories..."
	@mkdir -p backend_database/database || true
	@mkdir -p live-chat/data || true
	@echo "✅ Data directories created (permissions will be set by containers)"

# =============================================================================
# Build & Run
# =============================================================================

build:
	@echo "🔨 Building all containers..."
	@# Try to be quiet across different docker/compose versions
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) build --pull --quiet 2>/dev/null || \
	 $(DOCKER_COMPOSE) $(COMPOSE_FILES) build --pull --progress=quiet

up:
	@echo "🚀 Starting all services..."
	@echo "📡 HTTPS: $(HTTPS_PORT), HTTP: $(HTTP_PORT) → HTTPS"
	@echo "📊 Including ELK stack"

	@echo "🔧 Starting Elasticsearch and Logstash first..."
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) up -d --quiet-pull elasticsearch logstash $(QUIET_REDIRECT) || true

	@echo "⏳ Waiting for Elasticsearch to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12; do \
		if curl -fsS http://localhost:9200/_cluster/health >/dev/null 2>&1; then \
			echo "✅ Elasticsearch is ready!"; \
			break; \
		fi; \
		if [ $$i -eq 12 ]; then \
			echo "⚠️  Elasticsearch not ready after 60s, proceeding anyway..."; \
		else \
			echo "   Attempt $$i/12: Waiting for Elasticsearch..."; \
			sleep 5; \
		fi; \
	done

	@echo "📋 Setting up Elasticsearch index template..."
	@./elk/create-index-template.sh || echo "⚠️  Template setup had issues, continuing anyway..."

	@echo "⏳ Waiting for Logstash to be ready..."
	@for i in 1 2 3 4 5; do \
		if nc -z localhost 5000 2>/dev/null; then \
			echo "✅ Logstash is ready!"; \
			break; \
		fi; \
		if [ $$i -eq 5 ]; then \
			echo "⚠️  Logstash not ready after 25s, proceeding anyway..."; \
		else \
			echo "   Attempt $$i/5: Waiting for Logstash port 5000..."; \
			sleep 5; \
		fi; \
	done

	@echo "⏳ Waiting 3 seconds for DNS propagation..."
	@sleep 3

	@echo "🚀 Starting application services..."
	@NGINX_HTTPS_PORT=$(HTTPS_PORT) NGINX_HTTP_PORT=$(HTTP_PORT) \
		PUBLIC_API_URL=$(PUBLIC_API_URL) PUBLIC_WS_URL=$(PUBLIC_WS_URL) \
		$(DOCKER_COMPOSE) $(COMPOSE_FILES) up -d --quiet-pull $(QUIET_REDIRECT) || true

	@echo "🔍 Checking if ELK stack needs initial setup..."
	@sleep 2
	@# Quiet check: if Kibana is reachable AND index-pattern exists, we assume configured
	@if curl -fsS http://localhost:5601/api/saved_objects/index-pattern/transcendence-logs >/dev/null 2>&1; then \
		echo "✅ ELK stack already configured"; \
	else \
		echo "⚙️  Running first-time ELK setup..."; \
		$(MAKE) elk-setup; \
	fi

	@echo ""
	@echo "✅ Services started"
	@echo "🌐 App:            		$(URL)"
	@echo "📊 Kibana:         		http://localhost:5601"
	@echo "🔥 Prometheus Targets: 		http://localhost:9090/targets"
	@echo "📈 Grafana Dashboard: 		http://localhost:3001/d/transcendence-overview/"

dev:
	@echo "🔧 Starting services in development mode..."
	@echo "📡 HTTPS: $(HTTPS_PORT), HTTP: $(HTTP_PORT) → HTTPS"
	@echo "📊 Including ELK stack"
	@NGINX_HTTPS_PORT=$(HTTPS_PORT) NGINX_HTTP_PORT=$(HTTP_PORT) \
		PUBLIC_API_URL=$(PUBLIC_API_URL) PUBLIC_WS_URL=$(PUBLIC_WS_URL) \
		$(DOCKER_COMPOSE) $(COMPOSE_FILES) up

down:
	@echo "🛑 Stopping all services..."
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) down
	@echo "✅ Services stopped"

stop:
	@echo "⏸️  Stopping containers..."
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) stop
	@echo "✅ Containers stopped"

restart: down up
	@echo "🔄 Services restarted"

# =============================================================================
# Cleaning
# =============================================================================

clean:
	@echo "🧹 Cleaning up containers and networks..."
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) down --rmi local $(QUIET_REDIRECT) || true
	@docker system prune -f $(QUIET_REDIRECT) || true
	@echo "✅ Cleanup complete"

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
	@$(MAKE) db-reset
	@echo "🧹 Deep cleaning - removing images and volumes..."
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) down -v --rmi all $(QUIET_REDIRECT) || true
	@docker volume rm transcendence_elasticsearch-data $(QUIET_REDIRECT) || true
	@docker system prune -af $(QUIET_REDIRECT) || true
	@echo "✅ Deep cleanup complete"

# =============================================================================
# Database operations
# =============================================================================

db-reset:
	@echo "🗄️  Resetting database..."
	@# Start containers to ensure proper permissions for deletion
	@$(DOCKER_COMPOSE) up -d database live-chat $(QUIET_REDIRECT) || true
	@sleep 2
	@# Remove database files via docker exec (container has proper permissions)
	@if $(DOCKER_COMPOSE) ps database | grep -q "Up"; then \
		echo "Removing backend database..."; \
		$(DOCKER_COMPOSE) exec -T databank rm -f /app/data/database.db || echo "❌ Could not remove backend database"; \
	else \
		echo "⚠️  Backend container not running"; \
	fi
	@if $(DOCKER_COMPOSE) ps live-chat | grep -q "Up"; then \
		echo "Removing live-chat database..."; \
		$(DOCKER_COMPOSE) exec -T live-chat rm -f /app/data/database.db || echo "❌ Could not remove live-chat database"; \
	else \
		echo "⚠️  Live-chat container not running"; \
	fi
	@# Stop containers to close file handles, then clean up .nfs* files
	@$(DOCKER_COMPOSE) stop database live-chat $(QUIET_REDIRECT) || true
	@sleep 1
	@echo "Cleaning up .nfs* artifacts..."
	@find backend_database/database -name '.nfs*' -type f -delete 2>/dev/null || true
	@find live-chat/data -name '.nfs*' -type f -delete 2>/dev/null || true
	@echo "✅ Database reset complete"

# =============================================================================
# Utilities
# =============================================================================

status:
	@echo "📊 Service Status:"
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) ps

stats:
	@echo "📈 Resource Usage:"
	@docker stats --no-stream

logs:
	@SERVICE="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -z "$$SERVICE" ]; then \
		echo "📋 Showing logs for all services..."; \
		$(DOCKER_COMPOSE) logs -f; \
	elif echo "$(SERVICES)" | grep -wq "$$SERVICE"; then \
		echo "📋 Showing logs for $$SERVICE..."; \
		$(DOCKER_COMPOSE) logs -f "$$SERVICE"; \
	else \
		echo "❌ Invalid service. Available services: $(SERVICES)"; \
		echo "Usage: make logs <service>"; \
		exit 1; \
	fi

shell:
	@SERVICE="$(filter-out $@,$(MAKECMDGOALS))"; \
	if echo "$(SERVICES)" | grep -wq "$$SERVICE"; then \
		echo "🐚 Opening shell in $$SERVICE container..."; \
		$(DOCKER_COMPOSE) $(COMPOSE_FILES) exec "$$SERVICE" sh; \
	else \
		echo "❌ Invalid service. Available services: $(SERVICES)"; \
		echo "Usage: make shell [service]"; \
		exit 1; \
	fi

# =============================================================================
# ELK Stack Commands
# =============================================================================

elk-up:
	@$(MAKE) up

elk-down:
	@$(MAKE) down

elk-setup:
	@echo "⚙️  Configuring Elasticsearch..."
	@if ! $(DOCKER_COMPOSE) $(COMPOSE_FILES) ps elasticsearch | grep -q "Up"; then \
		echo "❌ Elasticsearch is not running. Start it with: make elk-up"; \
		exit 1; \
	fi
	@chmod +x ./elk/setup-elasticsearch.sh
	@./elk/setup-elasticsearch.sh

elk-logs:
	@echo "📋 Showing Logstash logs..."
	@$(DOCKER_COMPOSE) $(COMPOSE_FILES) logs -f logstash

elk-clean:
	@echo "⚠️  WARNING: This will delete all stored logs in Elasticsearch"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		[Yy]*) \
			echo "🧹 Removing Elasticsearch data..."; \
			$(DOCKER_COMPOSE) $(COMPOSE_FILES) down -v; \
			docker volume rm transcendence_elasticsearch-data 2>/dev/null || true; \
			echo "✅ ELK data cleaned"; \
			;; \
		*) echo "❌ Cancelled"; exit 1 ;; \
	esac

# =============================================================================
# Help
# =============================================================================

help:
	@echo "Available Commands"
	@echo ""
	@echo "Setup & Build:"
	@echo "  make                  - Setup .env, certs, dirs, build and start (includes ELK stack)"
	@echo "  make env              - Create .env file from .env.example (if not exists)"
	@echo "  make certs            - Generate SSL certificates"
	@echo "  make setup-dirs       - Create data directories with proper permissions"
	@echo "  make build            - Build all Docker containers (includes ELK)"
	@echo ""
	@echo "Running:"
	@echo "  make up               - Start all services + ELK stack (detached)"
	@echo "  make dev              - Start all services + ELK with logs visible"
	@echo "  make down             - Stop and remove all containers (includes ELK)"
	@echo "  make stop             - Stop containers without removing them"
	@echo "  make restart          - Stop and start all services (includes ELK)"
	@echo ""
	@echo "Port Configuration:"
	@echo "  make ports=privileged up    - Use ports 443/80 (requires sudo)"
	@echo "  make up                     - Use ports 8443/8080 (default, no sudo)"
	@echo ""
	@echo "Development:"
	@echo "  make logs <service>   - Show logs (all services or specific: $(SERVICES))"
	@echo "  make shell [service]  - Open shell ($(SERVICES))"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            - Remove containers, networks, and prune docker"
	@echo "  make fclean           - Deep clean: remove everything including images"
	@echo "  make re               - Full rebuild (clean + all)"
	@echo "  make db-reset         - Reset the database"
	@echo "  make status           - Show status of all services"
	@echo "  make stats            - Show resource usage of all containers"
	@echo "  make fre              - Deep clean and full rebuild (fclean + all)"
	@echo ""
	@echo "ELK Stack (Log Management - Always Enabled):"
	@echo "  make elk-up           - Shortcut for 'make up'"
	@echo "  make elk-down         - Shortcut for 'make down'"
	@echo "  make elk-setup        - Configure Elasticsearch indices and ILM policies (run once)"
	@echo "  make elk-logs         - View Logstash logs"
	@echo "  make elk-clean        - Remove ELK data volumes (keeps configurations)"
	@echo ""
	@echo "💡 Tip: ELK stack is always included for comprehensive log management"

# Allow "make backend" etc. without errors (common pattern)
$(SERVICES):
	@:

.DEFAULT:
	@$(MAKE) help

.PHONY: all env certs setup-dirs build up dev down stop restart re fre clean fclean \
	db-reset status stats logs shell help elk-up elk-down elk-setup elk-logs elk-clean $(SERVICES)
