#!/bin/bash
# Start the Agent Comms MCP server
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Check if already running
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 http://localhost:4200/api/state | grep -q "200"; then
  echo "Agent Comms server already running at http://localhost:4200"
  exit 0
fi

# Build if needed
if [ ! -d "dist" ] || [ "src/server.ts" -nt "dist/server.js" ]; then
  echo "Building..."
  npm run build
fi

# Start
echo "Starting Agent Comms server..."
node dist/server.js &
echo $! > .server.pid
echo "Server started (PID: $(cat .server.pid))"
echo "Dashboard: http://localhost:4200"
