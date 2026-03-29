#!/bin/bash
# Stop the Agent Comms MCP server
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [ -f .server.pid ]; then
  PID=$(cat .server.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Server stopped (PID: $PID)"
  else
    echo "Server not running (stale PID)"
  fi
  rm -f .server.pid
else
  echo "No PID file found"
fi
