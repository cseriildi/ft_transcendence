*This project has been created as part of the 42 curriculum by dcicsak, dzhakhan, icseri, sopperma, tkafanov.*

# FT_TRANSCENDENCE

A full-stack web application featuring a real-time multiplayer Pong game with user authentication, live chat, AI opponents, tournaments, and comprehensive DevOps infrastructure.

## Description

**Transcendence** is a modern web application that brings the classic Pong game to the browser with a complete suite of social and competitive features:

### Key Features
- **Real-time Multiplayer Pong**: Play against friends locally or remotely with WebSocket-powered synchronization
- **AI Opponent**: Challenge an intelligent AI that adapts to provide competitive gameplay
- **Tournament System**: Organize and participate in bracket-style tournaments
- **Live Chat**: Real-time messaging between users with friend integration
- **User Profiles**: Customizable profiles with avatars, statistics, and match history
- **Friends System**: Add friends, see online status, and invite to games
- **Two-Factor Authentication**: Enhanced account security with TOTP-based 2FA
- **Multi-language Support**: Available in English, German, Hungarian, and Russian
- **Comprehensive Monitoring**: Full observability with ELK stack and Prometheus/Grafana

---

## Instructions

### Prerequisites

- **Docker** and **Docker Compose** (v2.0+)
- **Make** (GNU Make)
- **OpenSSL** (for certificate generation)
- A modern web browser (Chrome, Firefox, Safari, or Edge)

> **Note**: This project was developed on machines without sudo access or npm installed. All dependencies run inside Docker containers, making it portable across different environments.

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ft_transcendence
   ```

2. **Start the application**
   ```bash
   make all
   ```
   This command will:
   - Generate environment variables from `.env.example`
   - Create SSL certificates for HTTPS
   - Build all Docker containers
   - Start the complete stack (application + monitoring)

3. **Access the application**
   - **Main Application**: `https://localhost:8443` (or your machine's IP)
   - **Kibana** (logs): `http://localhost:5601`
   - **Grafana** (metrics): `http://localhost:3003`
   - **Prometheus**: `http://localhost:9090`

### Environment Configuration

The application uses environment variables defined in `.env`. Key configurations:

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_HOST` | Public hostname for the application | `localhost` |
| `PUBLIC_PORT` | Public HTTPS port | `8443` |
| `NODE_ENV` | Environment mode | `production` |
| `JWT_ACCESS_TTL` | Access token lifetime | `15m` |
| `JWT_REFRESH_TTL` | Refresh token lifetime | `7d` |

### Common Commands

```bash
make all        # Full setup from scratch
make up         # Start all services
make down       # Stop all services
make re         # Rebuild and restart
make logs       # View container logs
make fclean     # Full cleanup (removes volumes)
make help       # Show all available commands
```

### Running with Privileged Ports

To run on standard HTTPS port 443 (requires sudo):
```bash
sudo make ports=privileged up
```

### Development Modes

#### 1. Production Mode (Docker Compose)
```bash
make            # 42 PCs (ports 8443/8080)
make ports=privileged up  # VMs/Private Machines (ports 443/80)
```

#### 2. Dev Container Mode
1. Open a service folder in VS Code (e.g., `backend_database/`)
2. Click "Reopen in Container" when prompted
3. Run `npm run dev` inside the container

#### 3. Local Dev Mode
```bash
cd backend_database  # or live-chat, backend_gamelogic
npm install
npm run dev
```

---

## Resources

### Documentation & Tutorials

#### Backend
- [Fastify Documentation](https://www.fastify.io/docs/latest/) - High-performance Node.js web framework
- [WebSocket Protocol (RFC 6455)](https://datatracker.ietf.org/doc/html/rfc6455) - Real-time communication standard
- [JWT Introduction](https://jwt.io/introduction) - JSON Web Token authentication

#### Frontend
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) - TypeScript language guide
- [Canvas API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) - Game rendering

#### DevOps
- [Docker Compose Documentation](https://docs.docker.com/compose/) - Container orchestration
- [ELK Stack Guide](https://www.elastic.co/guide/index.html) - Centralized logging (Elasticsearch, Logstash, Kibana)
- [Prometheus Documentation](https://prometheus.io/docs/) - Metrics collection
- [Grafana Documentation](https://grafana.com/docs/) - Metrics visualization

#### Database
- [SQLite Documentation](https://www.sqlite.org/docs.html) - Embedded database engine
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) - Synchronous SQLite bindings for Node.js

### AI Usage

AI tools (GitHub Copilot, Claude) were used throughout the project for:
- **Code assistance**: Autocomplete, refactoring suggestions, and boilerplate generation
- **Documentation**: Help with README structure and technical writing
- **Debugging**: Analyzing error messages and suggesting fixes
- **Architecture decisions**: Discussing trade-offs for technical choices
- **Test generation**: Creating test cases and edge case scenarios

All AI-generated code was reviewed, understood, and adapted by team members. The core logic, architecture decisions, and problem-solving remained human-driven.

---

## Team Information

| Member | Login | Role(s) | Responsibilities |
|--------|-------|---------|-----------------|
| **Daniel** | dcicsak | Product Owner, Developer) | Defined product vision and priorities. Led DevOps infrastructure (Docker, ELK, Prometheus, Grafana). Implemented CI/CD pipeline and multi-language support. |
| **Silas** | sopperma | Project Manager, Developer | Coordinated team workflow and sprint planning. Architected the database backend, authentication system, and API routes. Contributed to game physics and frontend foundations. |
| **Tim** | tkafanov | Developer | Developed the majority of the frontend application including UI/UX, game visualization, user interfaces, and client-side game logic. |
| **Ildi** | icseri | Technical Lead, Developer | Implemented the complete game logic backend, WebSocket communication for remote play, and the tournament system. |
| **Dimash** | dzhakhan | Developer | Built the live chat service, AI opponent system, and contributed to foundational database backend work. |

---

## Project Management

### Work Organization
- **Task Distribution**: Features were divided by expertise and interest, with clear ownership per module
- **Meetings**: Regular status update meetings for roadmap decisions and blockers
- **Code Review**: All changes went through pull request reviews before merging

### Tools Used
- **GitHub**: Version control, pull requests, code review, and CI/CD workflows
- **JIRA**: Initial planning and task distribution
- **WhatsApp**: Quick communication and coordination
- **In-person meetings**: Campus collaboration for complex discussions

### Communication
Primary channels were GitHub pull requests for technical discussions, WhatsApp for quick coordination, and in-person meetings on campus for architecture decisions and pair programming sessions.

---

## Technical Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type-safe JavaScript for better maintainability |
| **HTML5 Canvas** | Game rendering and visualization |
| **Tailwind CSS** | Utility-first styling framework |
| **i18next** | Internationalization (4 languages) |
| **Nginx** | Static file serving and SPA routing |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Fastify** | High-performance web framework |
| **TypeScript** | Type safety across the stack |
| **WebSocket (ws)** | Real-time game and chat communication |
| **JWT** | Stateless authentication with refresh tokens |
| **bcrypt** | Secure password hashing |
| **speakeasy** | TOTP-based two-factor authentication |

### Database
| Technology | Purpose |
|------------|---------|
| **SQLite** | Lightweight, file-based relational database |

**Why SQLite?**
- Zero configuration and no separate database server required
- Perfect for the scale of this application
- Easy backup (single file)
- ACID compliant with good performance
- Simplified Docker deployment

### DevOps & Monitoring
| Technology | Purpose |
|------------|---------|
| **Docker & Docker Compose** | Containerization and orchestration |
| **Nginx** | Reverse proxy with SSL termination |
| **Elasticsearch** | Log storage and indexing |
| **Logstash** | Log collection and transformation |
| **Kibana** | Log visualization and querying |
| **Prometheus** | Metrics collection and alerting |
| **Grafana** | Metrics dashboards and visualization |
| **GitHub Actions** | CI/CD pipeline |

### Architecture Justification

**Microservices Architecture**: The backend is split into three independent services:
1. **Database Service** (`backend_database`): User management, authentication, matches, friends
2. **Game Logic Service** (`backend_gamelogic`): Real-time game engine, WebSocket handling
3. **Live Chat Service** (`live-chat`): Real-time messaging, presence

This separation allows:
- Independent scaling and deployment
- Clear separation of concerns
- Fault isolation
- Technology flexibility per service

---

## Database Schema

### Visual Representation

```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │  refresh_tokens │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ jti (PK)        │
│ username        │  │    │ user_id (FK)    │──┐
│ email           │  │    │ token_hash      │  │
│ password_hash   │  │    │ revoked         │  │
│ twofa_secret    │  │    │ expires_at      │  │
│ twofa_enabled   │  │    └─────────────────┘  │
│ created_at      │  │                         │
│ last_seen       │  │    ┌─────────────────┐  │
└─────────────────┘  │    │    avatars      │  │
         │           │    ├─────────────────┤  │
         │           └────│ user_id (FK)    │──┘
         │                │ file_path       │
         │                │ file_url        │
         │                │ mime_type       │
         │                └─────────────────┘
         │
         │           ┌─────────────────┐
         │           │    matches      │
         │           ├─────────────────┤
         ├───────────│ winner_id (FK)  │
         ├───────────│ loser_id (FK)   │
         │           │ winner_score    │
         │           │ loser_score     │
         │           │ played_at       │
         │           └─────────────────┘
         │
         │           ┌─────────────────┐
         │           │    friends      │
         │           ├─────────────────┤
         ├───────────│ user1_id (FK)   │
         ├───────────│ user2_id (FK)   │
         ├───────────│ inviter_id (FK) │
         │           │ status          │
         │           └─────────────────┘
         │                    │
         │           ┌────────┴────────┐
         │           │ friend_game_    │
         │           │ invitations     │
         │           ├─────────────────┤
         └───────────│ inviter_id (FK) │
                     │ invitee_id (FK) │
                     │ friends_id (FK) │
                     │ status          │
                     └─────────────────┘
```

### Tables Description

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts and authentication | `id`, `username`, `email`, `password_hash`, `twofa_enabled` |
| `refresh_tokens` | JWT refresh token management | `jti`, `user_id`, `token_hash`, `expires_at`, `revoked` |
| `avatars` | User profile pictures | `user_id`, `file_path`, `file_url`, `mime_type` |
| `matches` | Game history and results | `winner_id`, `loser_id`, `winner_score`, `loser_score` |
| `friends` | Friend relationships | `user1_id`, `user2_id`, `status` (pending/accepted/declined) |
| `friend_game_invitations` | Game invite system | `inviter_id`, `invitee_id`, `status` |

### Live Chat Database (Separate SQLite)

| Table | Purpose |
|-------|---------|
| `blocks` | User blocking relationships |

---

## Features List

| Feature | Description | Contributors |
|---------|-------------|--------------|
| **User Registration/Login** | Secure account creation with email/password | Silas, Tim |
| **JWT Authentication** | Access/refresh token system with rotation | Silas |
| **Two-Factor Authentication** | TOTP-based 2FA with QR code setup | Silas, Tim |
| **User Profiles** | View/edit profile, upload avatar | Silas, Tim |
| **Friends System** | Send/accept friend requests, view online status | Silas, Dimash, Tim |
| **Live Chat** | Real-time messaging between users | Dimash |
| **Pong Game (Local)** | Two players on same device | Everyone |
| **Pong Game (Remote)** | Real-time multiplayer over network | Ildi |
| **AI Opponent** | Single-player mode with intelligent AI | Dimash |
| **Tournament System** | Bracket-based competitive tournaments | Ildi |
| **Match History** | View past games and statistics | Silas, Tim |
| **Leaderboard** | Ranking system based on wins | Silas, Tim |
| **Multi-language UI** | English, German, Hungarian, Russian | Daniel, Tim |
| **ELK Logging** | Centralized log management | Daniel |
| **Prometheus Metrics** | Application performance monitoring | Daniel |
| **Grafana Dashboards** | Visual metrics and alerting | Daniel |

---

## Modules

### Implemented Modules Summary

#### Web Modules

| Module | Type | Description | Contributors |
|--------|------|-------------|--------------|
| **Backend Framework (Fastify)** | Minor | High-performance Node.js framework with schema validation, plugin architecture, and excellent TypeScript support | Silas |
| **WebSockets** | Major | Real-time bidirectional communication for game state sync, chat messages, and presence updates with graceful reconnection handling | Silas, Dimash, Tim, Ildi |
| **User Interaction (Chat, Profile, Friends)** | Major | Complete social system with real-time chat, customizable profiles with avatars, and friend management with online status | Silas, Dimash, Tim |

#### Accessibility & Internationalization

| Module | Type | Description | Contributors |
|--------|------|-------------|--------------|
| **Multiple Languages** | Minor | i18next-based internationalization supporting English, German, Hungarian, and Russian with dynamic language switching | Daniel, Tim |
| **Additional Browsers** | Minor | Cross-browser compatibility ensured through standard web APIs, modern CSS (flexbox/grid), and ECMAScript-compliant JavaScript. Tested on Chrome, Firefox, Safari, and Edge with consistent behavior | Everyone |

#### User Management

| Module | Type | Description | Contributors |
|--------|------|-------------|--------------|
| **Standard User Management** | Major | Complete user lifecycle: registration, login, profile editing, avatar upload with defaults, friends with online status, and profile pages | Silas, Tim |
| **Game Statistics & History** | Minor | Win/loss tracking, match history with dates/scores/opponents, and leaderboard integration | Silas, Tim |
| **Two-Factor Authentication** | Minor | TOTP-based 2FA using speakeasy with QR code generation, backup considerations, and secure verification flow | Silas, Tim |

#### Artificial Intelligence

| Module | Type | Description | Contributors |
|--------|------|-------------|--------------|
| **AI Opponent** | Major | Intelligent Pong AI that tracks ball trajectory, predicts intersections, and adds human-like imperfection for fair gameplay | Dimash |

#### Gaming & User Experience

| Module | Type | Description | Contributors |
|--------|------|-------------|--------------|
| **Web-based Game** | Major | Real-time Pong with HTML5 Canvas rendering, smooth physics, clear win/loss conditions, and responsive controls | Everyone |
| **Remote Players** | Major | WebSocket-powered multiplayer with client-side prediction, server reconciliation, latency handling, and reconnection logic | Ildi |
| **Tournament System** | Minor | Bracket-based tournaments with matchmaking, progression tracking, and winner determination | Ildi |

#### DevOps

| Module | Type | Description | Contributors |
|--------|------|-------------|--------------|
| **ELK Stack** | Major | Elasticsearch for log indexing, Logstash for collection/transformation, Kibana for visualization. Includes log retention policies and secure access | Daniel |
| **Prometheus & Grafana** | Major | Prometheus scrapes metrics from all services, custom Grafana dashboards visualize performance, with alerting rules configured | Daniel |
| **Microservices Architecture** | Major | Three loosely-coupled services (database, game logic, live chat) communicating via REST APIs with clear interfaces and single responsibilities | Everyone |

#### Custom Modules (Modules of Choice)

| Module | Type | Justification | Contributors |
|--------|------|---------------|--------------|
| **JWT Authentication** | Minor | Implemented secure JWT with short-lived access tokens (15m), long-lived refresh tokens (7d), automatic token rotation, secure HttpOnly cookies, and proper revocation. Adds stateless authentication without session storage overhead | Silas, Tim |
| **TypeScript Full-Stack** | Minor | TypeScript used across all services (frontend + 3 backend services). Provides compile-time type checking, better IDE support, self-documenting code, and catches errors before runtime. Significant learning curve but prevents entire classes of bugs | Everyone |
| **Test-Driven Development** | Minor | Comprehensive test suites using Vitest across all services. Unit tests for utilities, integration tests for API endpoints, and test coverage for critical paths. Tests run in CI pipeline before merge | Everyone |
| **CI/CD Pipeline** | Minor | GitHub Actions workflow with: secrets scanning, unit tests, integration tests, security analysis, code quality checks. All checks must pass before merge. Automated quality gates prevent regressions | Daniel |

### Points Calculation

| Category | Modules | Points |
|----------|---------|--------|
| **Major Modules (2 pts each)** | WebSockets, User Interaction, Standard User Management, AI Opponent, Web-based Game, Remote Players, ELK Stack, Prometheus & Grafana, Microservices | 9 × 2 = **18** |
| **Minor Modules (1 pt each)** | Backend Framework, Multiple Languages, Additional Browsers, Game Statistics, 2FA, Tournament System | 6 × 1 = **6** |
| **Custom Minor Modules (1 pt each)** | JWT Authentication, TypeScript Full-Stack, Test-Driven Development, CI/CD Pipeline | 4 × 1 = **4** |
| **Total** | **19 modules** | **28 points** |

---

## Individual Contributions

### Silas (sopperma) - Project Manager & Tech Lead

**Primary Contributions:**
- **Database Backend**: Complete implementation of the database service including all REST API routes, middleware, and database schema design
- **Authentication System**: JWT-based authentication with access/refresh tokens, token rotation, secure cookie handling
- **2FA Implementation**: TOTP-based two-factor authentication with QR code generation
- **User Management**: Registration, login, profile management, avatar upload system
- **Friends System**: Friend requests, acceptance/decline, online status tracking
- **Match System**: Game result storage, statistics calculation, leaderboard
- **Game Foundations**: Initial game physics and frontend visualization groundwork
- **Rate Limiting**: Protection against brute force and abuse

**Challenges Overcome:**
- Designing a clean API architecture that scales across services
- Implementing secure token rotation without race conditions
- File upload handling with proper cleanup on failures

---

### Tim (tkafanov) - Developer

**Primary Contributions:**
- **Frontend Application**: Majority of the user interface implementation (excluding game)
- **User Interface**: Login/registration forms, profile pages, settings
- **Friends UI**: Friend list, requests, online indicators
- **Match History UI**: Display of past games and statistics
- **Responsive Design**: Mobile and desktop layouts
- **Client-side Validation**: Form validation and user feedback

**Challenges Overcome:**
- Managing complex UI state across multiple views
- Ensuring consistent experience across screen sizes

---

### Ildi (icseri) - Developer

**Primary Contributions:**
- **Game Logic Backend**: Complete Pong game engine implementation
- **Game Frontend**: Pong game visualization, Canvas rendering, and controls on the client side
- **WebSocket Server**: Real-time communication infrastructure for games
- **Remote Multiplayer**: Client-side prediction, server reconciliation, latency handling
- **Tournament System**: Bracket generation, match progression, winner tracking
- **Reconnection Logic**: Graceful handling of dropped connections mid-game

**Challenges Overcome:**
- Creating smooth game animations with Canvas API
- Synchronizing game state across network with varying latency
- Implementing fair gameplay with client-side prediction
- Managing tournament state across multiple concurrent matches

---

### Dimash (dzhakhan) - Developer

**Primary Contributions:**
- **Live Chat Service**: Complete real-time messaging implementation
- **AI Opponent**: Intelligent Pong AI with human-like behavior
- **Chat Features**: Real-time delivery, user blocking
- **Database Foundations**: Early contributions to database backend structure

**Challenges Overcome:**
- Creating an AI that's challenging but beatable
- Real-time message synchronization across multiple clients

---

### Daniel (dcicsak) - Product Owner & Tech Lead

**Primary Contributions:**
- **Docker Infrastructure**: Complete containerization of all services
- **ELK Stack**: Elasticsearch, Logstash, Kibana setup for centralized logging
- **Prometheus & Grafana**: Metrics collection and visualization dashboards
- **CI/CD Pipeline**: GitHub Actions workflows for automated testing and quality checks
- **Multi-language Support**: i18next integration with 4 language translations
- **SSL/TLS**: Certificate generation and HTTPS configuration
- **Nginx Configuration**: Reverse proxy setup with proper routing
- **Frontend Contributions**: Assisted with frontend development and language integration

**Challenges Overcome:**
- Configuring ELK stack for container log ingestion
- Creating meaningful Grafana dashboards for monitoring
- Setting up CI/CD without direct server access

---

## Challenges Faced

### Subject Changes Mid-Development
The project requirements changed during development, requiring adaptation of existing implementations and re-prioritization of features.

### Development Environment Constraints
Development occurred on school machines without:
- **sudo access**: Could not install system packages
- **npm installed**: No local Node.js environment

**Solution**: Leveraged Docker for all development and testing. All dependencies run inside containers, making the project portable and reproducible.

### WebSocket Authentication
Implementing secure WebSocket connections with JWT authentication required careful handling of the handshake process and token validation.

### Cross-Service Communication
Coordinating between three microservices (database, game logic, live chat) while maintaining security and consistency.

### Real-time Game Synchronization
Ensuring smooth gameplay over networks with varying latency required implementing client-side prediction and server reconciliation.

---

## Known Limitations

- SQLite may not scale for very high concurrent user loads
- No OAuth/social login (email/password only)
- Chat does not support file/image sharing

---

## License

This project was created for educational purposes as part of the 42 curriculum.
