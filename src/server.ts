import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { v4 as uuidv4 } from "uuid";
import { Store } from "./store.js";
import { registerTools, setConnectionId } from "./tools.js";
import { getDashboardHTML } from "./dashboard.js";
import type { DashboardSSEClient } from "./types.js";

const PORT = Number(process.env.PORT) || 4200;
const store = new Store();

const app = express();
app.use(express.json());

// --- Track SSE sessions ---
const sessions: Record<string, SSEServerTransport> = {};

// --- MCP SSE Endpoint ---
// Claude Code connects here with type: "sse"
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const connectionId = transport.sessionId;
  sessions[connectionId] = transport;

  const server = new McpServer({
    name: "agent-comms",
    version: "1.0.0",
  });

  setConnectionId(server, connectionId);
  registerTools(server, store);

  res.on("close", () => {
    store.setAgentOffline(connectionId);
    delete sessions[connectionId];
  });

  await server.connect(transport);
});

// MCP message endpoint (tool calls from Claude Code)
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sessions[sessionId];
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// --- Dashboard ---
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(getDashboardHTML());
});

app.get("/api/state", (_req, res) => {
  res.json(store.getFullState());
});

app.post("/api/send", (req, res) => {
  try {
    const { to, body, type } = req.body;
    // Auto-register dashboard agent if not already
    const dashboardAgent = store.getAgent("dashboard");
    if (!dashboardAgent) {
      store.registerAgent("dashboard", "dashboard-connection");
    } else if (dashboardAgent.status === "offline") {
      store.registerAgent("dashboard", "dashboard-connection");
    }
    const message = store.sendFromDashboard(to, body, type);
    res.json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dashboard SSE events
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = uuidv4();
  const client: DashboardSSEClient = {
    id: clientId,
    send: (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  };

  store.addDashboardClient(client);

  req.on("close", () => {
    store.removeDashboardClient(clientId);
  });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Agent Comms MCP server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/sse`);
});
