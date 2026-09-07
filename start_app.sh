#!/bin/bash
# 🚀 AI Subtitle Generator — 1-Click Desktop Launcher

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Spawn new terminal window if not already in one
if [ ! -t 0 ] && [ -z "$LAUNCHED_IN_TER" ]; then
    export LAUNCHED_IN_TER=1
    if command -v gnome-terminal &> /dev/null; then
        exec gnome-terminal -- bash "$0" "$@"
    elif command -v xfce4-terminal &> /dev/null; then
        exec xfce4-terminal --command="bash $0 $@"
    elif command -v konsole &> /dev/null; then
        exec konsole -e bash "$0" "$@"
    elif command -v xterm &> /dev/null; then
        exec xterm -e bash "$0" "$@"
    fi
fi

echo "======================================================"
echo "🎬  AI Subtitle & SRT Generator — Starting..."
echo "======================================================"

# ── Check Node.js ────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Download from https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

# ── Install packages if missing ──────────────────────────────
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first run only)..."
    npm install
fi

# ── Database setup ───────────────────────────────────────────
echo "⚙️  Setting up local database..."
npm run db:setup > /dev/null 2>&1

# ── Check Redis ───────────────────────────────────────────────
if command -v redis-cli &> /dev/null; then
    if ! redis-cli ping &> /dev/null; then
        echo "🔄 Starting Redis..."
        if command -v redis-server &> /dev/null; then
            redis-server --daemonize yes --loglevel warning > /dev/null 2>&1
            sleep 1
        else
            echo "⚠️  Redis not found. Install Redis for subtitle processing to work."
        fi
    else
        echo "✅ Redis is running."
    fi
fi

# ── Start AI worker in background ────────────────────────────
echo "🤖 Starting AI transcription worker..."
npm run worker > /tmp/subtitle-worker.log 2>&1 &
WORKER_PID=$!
echo "   Worker PID: $WORKER_PID"

# ── Open browser ──────────────────────────────────────────────
echo "🚀 Starting web server at http://localhost:3000 ..."
echo "💡 Keep this window open while using the app."
echo "======================================================"

if command -v xdg-open &> /dev/null; then
    (sleep 3 && xdg-open "http://localhost:3000") &
elif command -v open &> /dev/null; then
    (sleep 3 && open "http://localhost:3000") &
fi

# ── Cleanup worker on exit ────────────────────────────────────
trap "echo '🛑 Shutting down...'; kill $WORKER_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# ── Start Next.js (foreground) ────────────────────────────────
npm run dev
