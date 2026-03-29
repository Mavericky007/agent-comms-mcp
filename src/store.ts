import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Agent, Message, Channel, StoreData, DashboardSSEClient } from "./types.js";

const DEFAULT_TTL_MS = Number(process.env.MESSAGE_TTL_MS) || 86400000; // 24h
const STORE_PATH = process.env.STORE_PATH || new URL("../store.json", import.meta.url).pathname;

export class Store {
  private agents: Map<string, Agent> = new Map();
  private channels: Map<string, Channel> = new Map();
  private messages: Message[] = [];
  private dashboardClients: DashboardSSEClient[] = [];
  private agentServers: Map<string, McpServer> = new Map();

  constructor() {
    this.load();
    this.startTTLCleanup();
  }

  // --- Persistence ---

  private load(): void {
    try {
      const raw = readFileSync(STORE_PATH, "utf-8");
      const data: StoreData = JSON.parse(raw);
      for (const agent of data.agents) {
        agent.status = "offline"; // all agents offline on restart
        this.agents.set(agent.name, agent);
      }
      for (const channel of data.channels) {
        this.channels.set(channel.name, channel);
      }
      this.messages = data.messages;
      this.cleanupExpired();
    } catch {
      // No store file or corrupted — start fresh
    }
  }

  private persist(): void {
    const data: StoreData = {
      agents: Array.from(this.agents.values()),
      channels: Array.from(this.channels.values()),
      messages: this.messages,
    };
    try {
      mkdirSync(dirname(STORE_PATH), { recursive: true });
      writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to persist store:", err);
    }
  }

  private cleanupExpired(): void {
    const now = new Date().toISOString();
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => m.expiresAt > now);
    if (this.messages.length !== before) {
      this.persist();
    }
  }

  private startTTLCleanup(): void {
    setInterval(() => this.cleanupExpired(), 60000);
  }

  // --- Dashboard SSE ---

  addDashboardClient(client: DashboardSSEClient): void {
    this.dashboardClients.push(client);
  }

  removeDashboardClient(id: string): void {
    this.dashboardClients = this.dashboardClients.filter((c) => c.id !== id);
  }

  private notifyDashboard(event: string, data: unknown): void {
    for (const client of this.dashboardClients) {
      client.send(event, data);
    }
  }

  // --- Agent MCP Server Registry ---

  setAgentServer(agentName: string, server: McpServer): void {
    this.agentServers.set(agentName, server);
  }

  removeAgentServer(agentName: string): void {
    this.agentServers.delete(agentName);
  }

  private notifyAgent(agentName: string, message: Message): void {
    const server = this.agentServers.get(agentName);
    if (!server) return;
    const mentioned = message.mentions.includes(agentName);
    const prefix = mentioned ? `[MENTION]` : `[INFO]`;
    const source = message.type === "channel" ? `#${message.to}` : "DM";
    server.sendLoggingMessage({
      level: mentioned ? "warning" : "info",
      data: `${prefix} New message from ${message.from} in ${source}: ${message.body}`,
    }).catch(() => {});
  }

  // --- Agent Operations ---

  registerAgent(name: string, connectionId: string): Agent {
    const existing = this.agents.get(name);
    const now = new Date().toISOString();

    // Allow re-registration: update connection ID and mark online
    if (existing) {
      existing.id = connectionId;
      existing.status = "online";
      existing.connectedAt = now;
      existing.lastSeen = now;
      this.persist();
      this.notifyDashboard("agent:online", existing);
      return existing;
    }

    const agent: Agent = {
      id: connectionId,
      name,
      status: "online",
      channels: [],
      connectedAt: now,
      lastSeen: now,
    };
    this.agents.set(name, agent);
    this.persist();
    this.notifyDashboard("agent:online", agent);
    return agent;
  }

  setAgentOffline(connectionId: string): void {
    for (const agent of this.agents.values()) {
      if (agent.id === connectionId && agent.status === "online") {
        agent.status = "offline";
        agent.lastSeen = new Date().toISOString();
        this.persist();
        this.notifyDashboard("agent:offline", { name: agent.name });
        return;
      }
    }
  }

  getAgentByConnectionId(connectionId: string): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.id === connectionId) return agent;
    }
    return undefined;
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // --- Message Operations ---

  sendDirectMessage(from: string, to: string, body: string): Message {
    const recipient = this.agents.get(to);
    if (!recipient) {
      throw new Error(`Agent '${to}' not found`);
    }
    const now = new Date().toISOString();
    const message: Message = {
      id: uuidv4(),
      from,
      to,
      type: "direct",
      body,
      mentions: [to],
      createdAt: now,
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
      readBy: [],
    };
    this.messages.push(message);
    this.persist();
    this.notifyDashboard("message:new", message);
    this.notifyAgent(to, message);
    return message;
  }

  broadcastMessage(from: string, channelName: string, body: string, mentions: string[] = []): Message {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Channel '${channelName}' not found`);
    }
    if (!channel.members.includes(from)) {
      throw new Error(`Not a member of channel '${channelName}'`);
    }
    const now = new Date().toISOString();
    const message: Message = {
      id: uuidv4(),
      from,
      to: channelName,
      type: "channel",
      body,
      mentions,
      createdAt: now,
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
      readBy: [],
    };
    this.messages.push(message);
    this.persist();
    this.notifyDashboard("message:new", message);

    // Notify all online channel members except the sender
    for (const member of channel.members) {
      if (member !== from) {
        this.notifyAgent(member, message);
      }
    }

    return message;
  }

  checkMessages(agentName: string): Message[] {
    const agent = this.agents.get(agentName);
    if (!agent) return [];

    const unread = this.messages.filter((m) => {
      if (m.readBy.includes(agentName)) return false;
      if (m.from === agentName) return false;
      if (m.type === "direct" && m.to === agentName) return true;
      if (m.type === "channel" && agent.channels.includes(m.to)) return true;
      return false;
    });

    // Mark as read
    for (const msg of unread) {
      msg.readBy.push(agentName);
    }
    if (unread.length > 0) this.persist();

    return unread;
  }

  getAllMessages(): Message[] {
    return [...this.messages];
  }

  // --- Channel Operations ---

  joinChannel(agentName: string, channelName: string): Channel {
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = {
        name: channelName,
        members: [],
        createdAt: new Date().toISOString(),
      };
      this.channels.set(channelName, channel);
      this.notifyDashboard("channel:created", channel);
    }
    if (!channel.members.includes(agentName)) {
      channel.members.push(agentName);
      this.notifyDashboard("channel:updated", channel);
    }
    const agent = this.agents.get(agentName);
    if (agent && !agent.channels.includes(channelName)) {
      agent.channels.push(channelName);
    }
    this.persist();
    return channel;
  }

  leaveChannel(agentName: string, channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.members = channel.members.filter((m) => m !== agentName);
      this.notifyDashboard("channel:updated", channel);
    }
    const agent = this.agents.get(agentName);
    if (agent) {
      agent.channels = agent.channels.filter((c) => c !== channelName);
    }
    this.persist();
  }

  listChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  // --- Dashboard Message Sending ---

  sendFromDashboard(to: string, body: string, type: "direct" | "channel"): Message {
    if (type === "channel") {
      // Auto-join dashboard to channel if not already a member
      const channel = this.channels.get(to);
      if (!channel || !channel.members.includes("dashboard")) {
        this.joinChannel("dashboard", to);
      }
      return this.broadcastMessage("dashboard", to, body);
    }
    return this.sendDirectMessage("dashboard", to, body);
  }

  // --- Full State (for dashboard) ---

  getFullState(): StoreData {
    return {
      agents: this.listAgents(),
      channels: this.listChannels(),
      messages: this.getAllMessages(),
    };
  }
}
