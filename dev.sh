#!/bin/bash

# MediSync Development Environment Manager
# Load Docker build configuration to use legacy builder
export $(cat .env.docker | grep -v '^#' | xargs)

case "$1" in
  start)
    echo "🚀 Starting MediSync with live reload..."
    docker compose build
    docker compose watch
    ;;
  
  build)
    echo "🔨 Building Docker images..."
    docker compose build
    ;;
  
  up)
    echo "⬆️  Starting services (background)..."
    docker compose build
    docker compose up -d
    echo "✅ Services started! Access:"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend: http://localhost:3001"
    ;;
  
  down)
    echo "⬇️  Stopping services..."
    docker compose down
    ;;
  
  restart)
    echo "🔄 Restarting services..."
    docker compose restart
    ;;
  
  logs)
    echo "📋 Showing logs..."
    docker compose logs -f
    ;;
  
  logs-backend)
    echo "📋 Showing backend logs..."
    docker compose logs -f backend
    ;;
  
  logs-frontend)
    echo "📋 Showing frontend logs..."
    docker compose logs -f frontend
    ;;
  
  clean)
    echo "🧹 Cleaning up containers and volumes..."
    docker compose down -v
    ;;
  
  *)
    echo "MediSync Development Environment"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start          Start with live reload (recommended for development)"
    echo "  build          Build Docker images"
    echo "  up             Start services in background"
    echo "  down           Stop services"
    echo "  restart        Restart services"
    echo "  logs           Show all logs"
    echo "  logs-backend   Show backend logs only"
    echo "  logs-frontend  Show frontend logs only"
    echo "  clean          Stop and remove all containers and volumes"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh start        # Start development with live reload"
    echo "  ./dev.sh logs         # View logs"
    echo "  ./dev.sh down         # Stop everything"
    ;;
esac
