import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from "uuid";
import { Store } from "./store.js";
import { registerTools, setConnectionId } from "./tools.js";
import { getDashboardHTML } from "./dashboard.js";
import type { DashboardSSEClient } from "./types.js";

const PORT = Number(process.env.PORT) || 4200;
const store = new Store();

const app = express();
app.use(express.json());

// --- Track sessions for both transports ---
const sseSessions: Record<string, SSEServerTransport> = {};
const httpSessions: Record<string, StreamableHTTPServerTransport> = {};

// Helper: create a new McpServer wired to the store
function createMcpServer(connectionId: string): McpServer {
  const server = new McpServer({
    name: "agent-comms",
    version: "1.0.0",
  });
  setConnectionId(server, connectionId);
  registerTools(server, store);
  return server;
}

// --- Streamable HTTP Transport (modern, /mcp endpoint) ---
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Existing session
  if (sessionId && httpSessions[sessionId]) {
    await httpSessions[sessionId].handleRequest(req, res, req.body);
    return;
  }

  // New initialization
  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        httpSessions[sid] = transport;
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        const agent = store.getAgentByConnectionId(connectionId);
        if (agent) store.removeAgentServer(agent.name);
        store.setAgentOffline(connectionId);
        delete httpSessions[sid];
      }
    };

    const connectionId = randomUUID();
    const server = createMcpServer(connectionId);

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Bad Request: No valid session" },
    id: null,
  });
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && httpSessions[sessionId]) {
    await httpSessions[sessionId].handleRequest(req, res);
    return;
  }
  res.status(400).send("Invalid or missing session ID");
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && httpSessions[sessionId]) {
    await httpSessions[sessionId].handleRequest(req, res);
    return;
  }
  res.status(400).send("Invalid or missing session ID");
});

// --- Legacy SSE Transport (/sse endpoint) ---
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const connectionId = transport.sessionId;
  sseSessions[connectionId] = transport;

  const server = createMcpServer(connectionId);

  res.on("close", () => {
    const agent = store.getAgentByConnectionId(connectionId);
    if (agent) store.removeAgentServer(agent.name);
    store.setAgentOffline(connectionId);
    delete sseSessions[connectionId];
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseSessions[sessionId];
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
