export interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
  channels: string[];
  connectedAt: string;
  lastSeen: string;
  serverVersion?: string;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  type: "direct" | "channel";
  body: string;
  mentions: string[];
  createdAt: string;
  expiresAt: string;
  readBy: string[];
}

export interface Channel {
  name: string;
  members: string[];
  createdAt: string;
}

export interface StoreData {
  agents: Agent[];
  channels: Channel[];
  messages: Message[];
}

export interface DashboardSSEClient {
  id: string;
  send: (event: string, data: unknown) => void;
}
