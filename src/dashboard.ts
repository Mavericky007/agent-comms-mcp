export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Comms Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-tertiary: #21262d;
    --border: #30363d;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #484f58;
    --accent: #58a6ff;
    --accent-subtle: #1f6feb;
    --green: #3fb950;
    --red: #f85149;
    --orange: #d29922;
    --msg-self: #1f6feb;
    --msg-other: #21262d;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Top Bar */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .topbar h1 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--red);
  }
  .connection-dot.connected { background: var(--green); }

  /* Main Layout */
  .main {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* Sidebar */
  .sidebar {
    width: 240px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .sidebar-section {
    padding: 12px 16px 4px;
  }
  .sidebar-section h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-secondary);
    transition: background 0.15s;
  }
  .sidebar-item:hover { background: var(--bg-tertiary); }
  .sidebar-item.active {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-dot.online { background: var(--green); }
  .status-dot.offline { background: var(--text-muted); }
  .channel-prefix {
    color: var(--text-muted);
    font-weight: 600;
  }
  .create-channel-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
    border: 1px dashed var(--border);
    margin: 4px 0;
    transition: all 0.15s;
  }
  .create-channel-btn:hover {
    color: var(--text-secondary);
    border-color: var(--text-muted);
    background: var(--bg-tertiary);
  }

  /* Chat Area */
  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .chat-header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-primary);
    flex-shrink: 0;
  }
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .no-convo {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 14px;
  }
  .message {
    max-width: 70%;
    padding: 8px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
  }
  .message.self {
    align-self: flex-end;
    background: var(--msg-self);
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  .message.other {
    align-self: flex-start;
    background: var(--msg-other);
    color: var(--text-primary);
    border-bottom-left-radius: 4px;
  }
  .message .meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .message.self .meta { color: rgba(255,255,255,0.6); }
  .message .body { white-space: pre-wrap; }

  /* Input Bar */
  .input-bar {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    flex-shrink: 0;
  }
  .input-bar input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  .input-bar input:focus { border-color: var(--accent); }
  .input-bar input::placeholder { color: var(--text-muted); }
  .input-bar button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: var(--accent-subtle);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .input-bar button:hover { background: var(--accent); }
  .input-bar button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
</head>
<body>

<div class="topbar">
  <h1>Agent Comms</h1>
  <div class="connection-status">
    <div class="connection-dot" id="connDot"></div>
    <span id="connText">Connecting...</span>
  </div>
</div>

<div class="main">
  <div class="sidebar">
    <div class="sidebar-section">
      <h2>Agents</h2>
      <div id="agentList"></div>
    </div>
    <div class="sidebar-section">
      <h2>Channels</h2>
      <div id="channelList"></div>
      <div class="create-channel-btn" onclick="createChannel()">+ New Channel</div>
    </div>
  </div>

  <div class="chat-area">
    <div class="chat-header" id="chatHeader">Select a conversation</div>
    <div class="messages-container" id="messagesContainer">
      <div class="no-convo" id="noConvo">Select an agent or channel to start chatting</div>
    </div>
    <div class="input-bar">
      <input type="text" id="msgInput" placeholder="Type a message..." disabled
             onkeydown="if(event.key==='Enter')sendMsg()">
      <button id="sendBtn" onclick="sendMsg()" disabled>Send</button>
    </div>
  </div>
</div>

<script>
(function() {
  const DASHBOARD_AGENT = 'dashboard';

  let state = { agents: [], channels: [], messages: [] };
  let selected = null; // { type: 'agent'|'channel', name: string }
  let connected = false;

  // --- Escape HTML ---
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- SSE Connection ---
  function connectSSE() {
    const es = new EventSource('/api/events');

    es.onopen = function() {
      connected = true;
      updateConnectionStatus();
    };

    es.onerror = function() {
      connected = false;
      updateConnectionStatus();
    };

    es.addEventListener('agent:online', function(e) {
      const agent = JSON.parse(e.data);
      const idx = state.agents.findIndex(a => a.name === agent.name);
      if (idx >= 0) {
        state.agents[idx] = agent;
      } else {
        state.agents.push(agent);
      }
      render();
    });

    es.addEventListener('agent:offline', function(e) {
      const data = JSON.parse(e.data);
      const agent = state.agents.find(a => a.name === data.name);
      if (agent) agent.status = 'offline';
      render();
    });

    es.addEventListener('message:new', function(e) {
      const msg = JSON.parse(e.data);
      state.messages.push(msg);
      render();
      scrollToBottom();
    });

    es.addEventListener('channel:created', function(e) {
      const ch = JSON.parse(e.data);
      if (!state.channels.find(c => c.name === ch.name)) {
        state.channels.push(ch);
      }
      render();
    });

    es.addEventListener('channel:updated', function(e) {
      const ch = JSON.parse(e.data);
      const idx = state.channels.findIndex(c => c.name === ch.name);
      if (idx >= 0) {
        state.channels[idx] = ch;
      } else {
        state.channels.push(ch);
      }
      render();
    });
  }

  function updateConnectionStatus() {
    const dot = document.getElementById('connDot');
    const text = document.getElementById('connText');
    if (connected) {
      dot.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      dot.classList.remove('connected');
      text.textContent = 'Disconnected';
    }
  }

  // --- Fetch Initial State ---
  async function fetchState() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        state = await res.json();
        render();
      }
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  }

  // --- Render Functions ---
  function render() {
    renderAgents();
    renderChannels();
    renderMessages();
  }

  function renderAgents() {
    const el = document.getElementById('agentList');
    const agents = state.agents.filter(a => a.name !== DASHBOARD_AGENT);
    if (agents.length === 0) {
      el.innerHTML = '<div style="padding:6px 12px;font-size:12px;color:var(--text-muted)">No agents yet</div>';
      return;
    }
    el.innerHTML = agents.map(a => {
      const isActive = selected && selected.type === 'agent' && selected.name === a.name;
      return '<div class="sidebar-item' + (isActive ? ' active' : '') + '" onclick="window.__selectConvo(\\'agent\\',\\'' + escapeHtml(a.name) + '\\')">'
        + '<div class="status-dot ' + a.status + '"></div>'
        + '<span>' + escapeHtml(a.name) + '</span>'
        + '</div>';
    }).join('');
  }

  function renderChannels() {
    const el = document.getElementById('channelList');
    if (state.channels.length === 0) {
      el.innerHTML = '<div style="padding:6px 12px;font-size:12px;color:var(--text-muted)">No channels yet</div>';
      return;
    }
    el.innerHTML = state.channels.map(c => {
      const isActive = selected && selected.type === 'channel' && selected.name === c.name;
      return '<div class="sidebar-item' + (isActive ? ' active' : '') + '" onclick="window.__selectConvo(\\'channel\\',\\'' + escapeHtml(c.name) + '\\')">'
        + '<span class="channel-prefix">#</span>'
        + '<span>' + escapeHtml(c.name) + '</span>'
        + '</div>';
    }).join('');
  }

  function getConvoMessages() {
    if (!selected) return [];
    if (selected.type === 'agent') {
      return state.messages.filter(m =>
        m.type === 'direct' && (
          (m.from === DASHBOARD_AGENT && m.to === selected.name) ||
          (m.from === selected.name && m.to === DASHBOARD_AGENT)
        )
      );
    }
    if (selected.type === 'channel') {
      return state.messages.filter(m =>
        m.type === 'channel' && m.to === selected.name
      );
    }
    return [];
  }

  function renderMessages() {
    const container = document.getElementById('messagesContainer');
    const noConvo = document.getElementById('noConvo');
    const header = document.getElementById('chatHeader');
    const input = document.getElementById('msgInput');
    const btn = document.getElementById('sendBtn');

    if (!selected) {
      header.textContent = 'Select a conversation';
      noConvo.style.display = 'flex';
      container.querySelectorAll('.message').forEach(m => m.remove());
      input.disabled = true;
      btn.disabled = true;
      return;
    }

    noConvo.style.display = 'none';
    input.disabled = false;
    btn.disabled = false;

    if (selected.type === 'agent') {
      header.textContent = selected.name;
    } else {
      header.textContent = '# ' + selected.name;
    }

    const msgs = getConvoMessages();
    // Remove old messages but keep noConvo
    container.querySelectorAll('.message').forEach(m => m.remove());

    msgs.forEach(m => {
      const isSelf = m.from === DASHBOARD_AGENT;
      const div = document.createElement('div');
      div.className = 'message ' + (isSelf ? 'self' : 'other');

      const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sender = isSelf ? 'You' : escapeHtml(m.from);

      div.innerHTML = '<div class="meta">' + sender + ' &middot; ' + time + '</div>'
        + '<div class="body">' + escapeHtml(m.body) + '</div>';
      container.appendChild(div);
    });

    scrollToBottom();
  }

  function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  // --- Actions ---
  function selectConvo(type, name) {
    selected = { type: type, name: name };
    render();
    document.getElementById('msgInput').focus();
  }

  async function sendMsg() {
    if (!selected) return;
    const input = document.getElementById('msgInput');
    const body = input.value.trim();
    if (!body) return;

    input.value = '';

    try {
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selected.name,
          body: body,
          type: selected.type === 'agent' ? 'direct' : 'channel'
        })
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  async function createChannel() {
    const name = prompt('Channel name:');
    if (!name || !name.trim()) return;
    const channelName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    try {
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: channelName,
          body: 'Channel created',
          type: 'channel'
        })
      });
      selected = { type: 'channel', name: channelName };
      render();
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  }

  // Expose to inline handlers
  window.__selectConvo = selectConvo;
  window.sendMsg = sendMsg;
  window.createChannel = createChannel;

  // --- Init ---
  fetchState().then(() => {
    connectSSE();
  });
})();
</script>
</body>
</html>`;
}
