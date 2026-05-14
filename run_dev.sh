#!/bin/bash

# YC Company Scraper - Development Runner
# This script runs both the backend (FastAPI) and frontend (Vite/React) concurrently

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 Starting YC Company Scraper Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python is installed (try python3, then python)
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "${YELLOW}⚠️  Python is not installed. Please install Python 3.8+ first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "${YELLOW}⚠️  Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

# Change to script directory
cd "$SCRIPT_DIR"

# Create and activate Python virtual environment if not present
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "${BLUE}📦 Creating Python virtual environment...${NC}"
    $PYTHON_CMD -m venv "$SCRIPT_DIR/venv"
    echo "${GREEN}✅ Virtual environment created${NC}"
else
    echo "${BLUE}📦 Using existing virtual environment${NC}"
fi

source "$SCRIPT_DIR/venv/bin/activate" || { echo "${YELLOW}⚠️  Failed to activate venv${NC}"; exit 1; }

echo "${BLUE}📦 Installing backend dependencies...${NC}"
pip install -r "$SCRIPT_DIR/backend/requirements.txt" -q

# Install frontend dependencies if needed
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "${BLUE}📦 Installing frontend dependencies...${NC}"
    cd "$SCRIPT_DIR/frontend" && npm install
    cd "$SCRIPT_DIR"
fi

echo ""
echo "${GREEN}✅ Dependencies installed!${NC}"
echo ""
echo "${BLUE}🔧 Starting services...${NC}"
echo "${BLUE}   Backend will run on: http://localhost:8000${NC}"
echo "${BLUE}   Frontend will run on: http://localhost:5173${NC}"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "${YELLOW}🛑 Stopping services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    deactivate 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Start backend (with hot reload)
echo "${GREEN}[Backend]${NC} Starting FastAPI server (uvicorn --reload)..."
cd "$SCRIPT_DIR/backend" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "${GREEN}[Frontend]${NC} Starting Vite dev server..."
cd "$SCRIPT_DIR/frontend" && npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait
