# MediSync Docker Development Setup

This Docker Compose setup provides a fully containerized development environment with **live reload** for both frontend and backend.

## 🚀 Quick Start

### Option 1: Using the dev script (Recommended)

```bash
# Start development with live reload
./dev.sh start

# View logs
./dev.sh logs

# Stop services
./dev.sh down
```

### Option 2: Using Docker Compose directly

```bash
# Start with live reload (watches for file changes)
docker compose watch

# Or start in background
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## 📦 Services

- **Frontend**: http://localhost:5173 (Vite dev server with HMR)
- **Backend**: http://localhost:3001 (Express + Socket.IO)

## ✨ Features

### Live Reload / Hot Module Replacement

- **Frontend**: Vite automatically reloads when you edit `.jsx`, `.js`, `.css` files
- **Backend**: Nodemon restarts server when you edit `.js` files
- **Package changes**: Containers rebuild automatically when `package.json` changes

### Volume Mounts

Your local code is mounted into containers, so changes sync instantly:

- `./Kiosk/Frontend` → `/app` (frontend container)
- `./Kiosk/Backend` → `/app` (backend container)

### Persistent Data

- SQLite database persists in a Docker volume (`backend-db`)

## 📝 Available Commands

```bash
./dev.sh start          # Start with live reload (recommended)
./dev.sh build          # Build Docker images
./dev.sh up             # Start services in background
./dev.sh down           # Stop services
./dev.sh restart        # Restart services
./dev.sh logs           # Show all logs
./dev.sh logs-backend   # Show backend logs only
./dev.sh logs-frontend  # Show frontend logs only
./dev.sh clean          # Stop and remove all containers/volumes
```

## 🔧 Manual Docker Compose Commands

```bash
# Build images
docker compose build

# Start with watch mode (live reload)
docker compose watch

# Start in detached mode
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Restart a specific service
docker compose restart backend

# Execute commands in a container
docker compose exec backend npm install <package>
docker compose exec frontend npm run build
```

## 🛠️ Troubleshooting

### Docker Build Timeout / BuildKit Issues

If you encounter errors like:

```
failed to solve: connection error: desc = "transport: Error while dialing:
dial unix:///var/run/docker/containerd/containerd.sock: timeout"
```

This is a BuildKit connectivity issue in Docker-in-Docker (DinD) environments. The setup automatically uses the legacy Docker builder.

**For manual docker compose commands**, ensure the environment variables are set:

```bash
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=1
docker compose build
```

Or use the dev script which handles this automatically:

```bash
./dev.sh build  # Automatically uses legacy builder
./dev.sh up     # Builds and starts services
./dev.sh start   # Builds and starts with live reload
```

### Port already in use

If ports 3001 or 5173 are already in use, stop the local dev servers:

```bash
# Stop any running processes on these ports
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Changes not reflecting

```bash
# Restart the watch process
docker compose down
docker compose watch
```

### Need to reinstall dependencies

```bash
# Backend
docker compose exec backend npm install

# Frontend
docker compose exec frontend npm install

# Or rebuild the images
docker compose build --no-cache
```

### Database issues

```bash
# Remove the database volume and restart
docker compose down -v
docker compose up -d
```

## 📁 Project Structure

```
MediSync/
├── docker-compose.yml          # Main compose configuration
├── .env.docker                 # Docker build settings (legacy builder)
├── dev.sh                      # Development helper script
└── Kiosk/
    ├── Backend/
    │   ├── Dockerfile         # Backend container config
    │   ├── .dockerignore      # Files to exclude from image
    │   ├── nodemon.json       # Auto-reload configuration
    │   └── ...
    └── Frontend/
        ├── Dockerfile         # Frontend container config
        ├── .dockerignore      # Files to exclude from image
        ├── vite.config.js     # Vite with Docker HMR settings
        └── ...
```

## 🔒 Environment Variables

Create `.env` file in `Kiosk/Backend/` if needed:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
KIOSK_ID=kiosk-001
CLINIC_ID=clinic-001
```

## 🌐 Network

Both services run in a shared Docker network (`medisync-network`) and can communicate:

- Frontend can reach backend at `http://backend:3001`
- Backend can reach frontend at `http://frontend:5173`

## 💡 Development Workflow

1. **Start the environment**:

   ```bash
   ./dev.sh start
   ```

2. **Make changes** to your code - they'll sync automatically!

3. **View logs** in another terminal:

   ```bash
   ./dev.sh logs
   ```

4. **Stop when done**:
   ```bash
   ./dev.sh down
   ```

## 🎯 Production Deployment

For production, you'd want to:

1. Build optimized images (remove dev dependencies)
2. Use environment-specific configs
3. Add nginx for serving frontend static files
4. Use production-grade database
5. Add health checks and restart policies

This setup is optimized for development with live reload! 🚀
