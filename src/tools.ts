import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Store } from "./store.js";
import { getVersionInfo } from "./version.js";

// Each MCP client (Claude Code instance) gets its own McpServer.
// The connectionId links it to an agent in the shared store.
const serverConnections = new Map<McpServer, string>();

export function getConnectionId(server: McpServer): string {
  const id = serverConnections.get(server);
  if (!id) throw new Error("Server not registered");
  return id;
}

export function setConnectionId(server: McpServer, id: string): void {
  serverConnections.set(server, id);
}

export function registerTools(server: McpServer, store: Store): void {

  server.tool(
    "register",
    "Register this agent with a name. Must be called before any other tool.",
    { name: z.string().describe("Your agent name, e.g. 'Mark' or 'John'") },
    async ({ name }) => {
      try {
        const connectionId = getConnectionId(server);
        const { agent, versionChanged } = store.registerAgent(name, connectionId);
        store.setAgentServer(name, server);
        const response: Record<string, unknown> = { ...agent, server: getVersionInfo() };
        if (versionChanged) {
          response.notice = "Server has been updated since your last session. You may want to reload plugins to pick up changes.";
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "send_message",
    "Send a direct message to a named agent. Works even if recipient is offline.",
    {
      to: z.string().describe("Recipient agent name"),
      body: z.string().describe("Message content (text or markdown)"),
    },
    async ({ to, body }) => {
      try {
        const connectionId = getConnectionId(server);
        const agent = store.getAgentByConnectionId(connectionId);
        if (!agent) return { content: [{ type: "text" as const, text: "Error: Must register first" }], isError: true };
        const message = store.sendDirectMessage(agent.name, to, body);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(message, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "broadcast",
    "Post a message to a channel. All members receive the message. Use mentions to flag specific agents who should pay attention.",
    {
      channel: z.string().describe("Channel name"),
      body: z.string().describe("Message content (text or markdown)"),
      mentions: z.array(z.string()).optional().describe("Agent names to mention — mentioned agents get a priority notification. All channel members still receive the message."),
    },
    async ({ channel, body, mentions }) => {
      try {
        const connectionId = getConnectionId(server);
        const agent = store.getAgentByConnectionId(connectionId);
        if (!agent) return { content: [{ type: "text" as const, text: "Error: Must register first" }], isError: true };
        const message = store.broadcastMessage(agent.name, channel, body, mentions ?? []);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(message, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "check_messages",
    "Get all unread messages (direct and from subscribed channels). Marks them as read. Messages with your name in the 'mentions' array require your attention; other channel messages are informational.",
    {},
    async () => {
      try {
        const connectionId = getConnectionId(server);
        const agent = store.getAgentByConnectionId(connectionId);
        if (!agent) return { content: [{ type: "text" as const, text: "Error: Must register first" }], isError: true };
        const messages = store.checkMessages(agent.name);
        if (messages.length === 0) {
          return { content: [{ type: "text" as const, text: "No unread messages." }] };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(messages, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "join_channel",
    "Join a channel (creates it if it doesn't exist).",
    { channel: z.string().describe("Channel name to join") },
    async ({ channel }) => {
      try {
        const connectionId = getConnectionId(server);
        const agent = store.getAgentByConnectionId(connectionId);
        if (!agent) return { content: [{ type: "text" as const, text: "Error: Must register first" }], isError: true };
        const ch = store.joinChannel(agent.name, channel);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(ch, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "leave_channel",
    "Leave a channel.",
    { channel: z.string().describe("Channel name to leave") },
    async ({ channel }) => {
      try {
        const connectionId = getConnectionId(server);
        const agent = store.getAgentByConnectionId(connectionId);
        if (!agent) return { content: [{ type: "text" as const, text: "Error: Must register first" }], isError: true };
        store.leaveChannel(agent.name, channel);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_agents",
    "List all registered agents with their online/offline status.",
    {},
    async () => {
      const agents = store.listAgents();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(agents, null, 2) }],
      };
    }
  );

  server.tool(
    "list_channels",
    "List all channels with their members.",
    {},
    async () => {
      const channels = store.listChannels();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(channels, null, 2) }],
      };
    }
  );
}
