#!/usr/bin/env bash
# Launch FastAPI backend + Next.js frontend in one terminal.
# Ctrl+C (or EXIT) cleanly stops both servers.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Stopping servers..."

  for pid in "${FRONTEND_PID}" "${BACKEND_PID}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      # Terminate children first (uvicorn --reload worker, next child, etc.).
      pkill -TERM -P "${pid}" 2>/dev/null || true
      kill -TERM "${pid}" 2>/dev/null || true
    fi
  done

  sleep 0.5

  for pid in "${FRONTEND_PID}" "${BACKEND_PID}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      pkill -KILL -P "${pid}" 2>/dev/null || true
      kill -KILL "${pid}" 2>/dev/null || true
    fi
  done

  wait 2>/dev/null || true
  echo "Stopped."
}

trap cleanup EXIT INT TERM

if [[ -f "${ROOT}/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT}/.venv/bin/activate"
elif [[ -f "${ROOT}/backend/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT}/backend/.venv/bin/activate"
fi

echo "Starting backend  → http://127.0.0.1:8000"
(
  cd "${ROOT}/backend"
  exec uvicorn main:app --reload --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

echo "Starting frontend → http://127.0.0.1:3000"
(
  cd "${ROOT}/frontend"
  exec npm run dev -- -p 3000
) &
FRONTEND_PID=$!

echo ""
echo "Both servers are running in this terminal. Press Ctrl+C to stop."
echo ""

# Keep the script alive until either child exits (macOS bash 3.2 compatible).
while kill -0 "${BACKEND_PID}" 2>/dev/null && kill -0 "${FRONTEND_PID}" 2>/dev/null; do
  sleep 1
done
