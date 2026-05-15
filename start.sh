#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
  echo "ERROR: Virtual environment .venv not found. Run 'python3 -m venv .venv' and install backend dependencies first."
  exit 1
fi

if [ ! -f ".env" ] && [ ! -f "backend/.env" ]; then
  echo "WARNING: no .env or backend/.env file found. Make sure your database and secrets are configured."
fi

LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

echo "Cleaning up existing processes on ports 8000 and 3000..."
# Kill processes on port 8000 (backend)
BACKEND_PIDS=$(ss -ltnp 2>/dev/null | grep ":8000" | grep -o "pid=[0-9]*" | cut -d'=' -f2 | tr '\n' ' ' || true)
if [ ! -z "$BACKEND_PIDS" ]; then
  echo "Killing backend processes: $BACKEND_PIDS"
  kill $BACKEND_PIDS 2>/dev/null || sudo kill $BACKEND_PIDS 2>/dev/null || true
  sleep 2
fi

# Kill processes on port 3000 (frontend)
FRONTEND_PIDS=$(ss -ltnp 2>/dev/null | grep ":3000" | grep -o "pid=[0-9]*" | cut -d'=' -f2 | tr '\n' ' ' || true)
if [ ! -z "$FRONTEND_PIDS" ]; then
  echo "Killing frontend processes: $FRONTEND_PIDS"
  kill $FRONTEND_PIDS 2>/dev/null || sudo kill $FRONTEND_PIDS 2>/dev/null || true
  sleep 2
fi

echo "Starting backend..."
source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR"
PYTHONPATH="$ROOT_DIR" python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"
sleep 3

echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
npm run dev -- --hostname 127.0.0.1 --port 3000 > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

trap 'echo "Stopping servers..."; kill "$BACKEND_PID" "$FRONTEND_PID"; exit 0' INT TERM

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Logs: $LOG_DIR/backend.log, $LOG_DIR/frontend.log"
echo "Waiting for servers. Press Ctrl+C to stop."

wait "$BACKEND_PID" "$FRONTEND_PID"
