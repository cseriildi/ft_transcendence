# ft_transcendence

## Quick guide to running Transcendence

### 🚀 Running Modes

This project supports **three development modes**:

#### 1. **Production Mode (Docker Compose)** - All services together

**42 PCs (ports 8443/8080):**

```bash
make
```

**Privileged ports for VMs/Private Machines (ports 443/80):**

```bash
make ports=privileged up
```

This will automatically:

- Generate SSL certificates
- Build all containers
- Start all services (NGINX, frontend, backend_database, backend_gamelogic, live-chat)

**Access:**

- **42 PCs**: https://localhost:8443
- **Production**: https://localhost (port 443)

#### 2. **Dev Container Mode** - Single service in VS Code

1. Open a service folder in VS Code (e.g., `backend_database/` or `live-chat/`)
2. Click "Reopen in Container" when prompted
3. Run `npm run dev` inside the container

**Environment:** Automatically loads `.env.development` with localhost defaults

#### 3. **Local Dev Mode** - Single service on your machine

```bash
cd backend_database  # or live-chat, backend_gamelogic
npm install
npm run dev
```

**Environment:**

- Uses `.env.development` defaults (localhost URLs, local DB paths)
- Override with `.env.local` if needed (gitignored)

---

### 📊 ELK Stack - Log Management (Optional)

Want centralized log management with powerful search and visualization?

```bash
# Start application with ELK stack (any of these work)
make elk=true       # Full setup with ELK
make elk=true up    # Start with ELK
make elk-up         # Shortcut

# Configure Elasticsearch (first time only)
make elk-setup

# Access Kibana for log visualization
open http://localhost:5601
```

**Features:**
- Real-time log aggregation from all services
- Full-text search and filtering
- Pre-configured dashboards
- 90-day log retention
- Distributed tracing with request IDs

**💡 Pro Tip:** Add `elk=true` to any make command to include ELK stack:
- `make elk=true dev` - Development mode with ELK
- `make elk=true restart` - Restart with ELK

See the complete guide: **[elk/README.md](elk/README.md)**

---

### 📋 Environment Files

- **`.env`** - Created from `.env.example`, used by Docker Compose (production mode)
- **`.env.development`** - Tracked in git, defaults for local/devcontainer modes
- **`.env.local`** - Optional, gitignored, for personal overrides

### Other useful commands:

```bash
make help
```
