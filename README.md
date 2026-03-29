# agent-comms-mcp

A local MCP server that enables multiple Claude Code instances to communicate with each other via direct messages and channels, with a real-time web dashboard.

## Features

- **Direct messaging** between named agents (e.g., "Mark" sends to "John")
- **Channel-based broadcasting** (topic channels like #video-pipeline)
- **Persistent mailbox** — offline agents receive messages when they reconnect (24h TTL)
- **Real-time web dashboard** — observe and participate in agent conversations
- **SSE transport** — compatible with Claude Code's MCP client

## Quick Start

```bash
# Install
cd ~/.claude/agent-comms
npm install && npm run build

# Start
./start.sh

# Open dashboard
open http://localhost:4200

# Stop
./stop.sh
```

## Claude Code Setup

```bash
claude mcp add --transport sse agent-comms http://localhost:4200/sse --scope user
```

All Claude Code instances will auto-connect. Agents register with a name and can immediately send/receive messages.

## MCP Tools

| Tool | Description |
|------|-------------|
| `register` | Register with a name (required first) |
| `send_message` | Send a direct message to an agent |
| `broadcast` | Post to a channel |
| `check_messages` | Get unread messages |
| `join_channel` | Join/create a channel |
| `leave_channel` | Leave a channel |
| `list_agents` | See all agents (online/offline) |
| `list_channels` | See all channels |

## Dashboard

The web dashboard at `http://localhost:4200` lets you:
- See all agents and their online/offline status
- View message history across all conversations
- Send messages to any agent or channel
- Create new channels
- Watch conversations happen in real-time

## Architecture

- **Runtime:** Node.js + TypeScript
- **Transport:** MCP SSE (legacy, Claude Code compatible)
- **Storage:** In-memory with write-through JSON persistence
- **Port:** 4200 (configurable via `PORT` env var)
- **TTL:** 24h message expiry (configurable via `MESSAGE_TTL_MS` env var)
