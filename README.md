# MediSync

Smart Medical Kiosk System with automated vital signs monitoring and medicine dispensing.

## 🐳 Quick Start with Docker (Recommended)

The easiest way to develop is using Docker with live reload:

```bash
# Start development environment with live reload
./dev.sh start
```

**Access:**

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

All your code changes will sync automatically! See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed documentation.

## 📦 Manual Setup (Alternative)

If you prefer running without Docker:

### Backend

```bash
cd Kiosk/Backend
npm install
npm start
```

### Frontend

```bash
cd Kiosk/Frontend
npm install
npm run dev
```
