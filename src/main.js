import "./styles.css";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

const app = document.querySelector("#app");

const state = {
  sessions: new Map(),
  activeId: null,
  hosts: []
};

app.innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">M</div>
        <div>
          <h1>MyShell</h1>
          <p>Xshell 风格 SSH 终端</p>
        </div>
      </div>

      <form class="connect-form" id="connect-form">
        <label>
          <span>会话名称</span>
          <input name="name" placeholder="生产环境 / Web01" />
        </label>
        <label>
          <span>主机</span>
          <input name="host" placeholder="192.168.1.10" required />
        </label>
        <label class="inline">
          <span>端口</span>
          <input name="port" type="number" value="22" min="1" max="65535" />
        </label>
        <label>
          <span>用户名</span>
          <input name="username" placeholder="root" required />
        </label>
        <label>
          <span>密码</span>
          <input name="password" type="password" placeholder="优先使用测试账号" />
        </label>
        <label>
          <span>私钥</span>
          <div class="key-row">
            <input id="key-path" placeholder="未选择私钥" readonly />
            <button type="button" id="pick-key" class="ghost">选择</button>
          </div>
        </label>
        <label class="checkbox-row">
          <input name="saveHost" type="checkbox" checked />
          <span>保存到快速连接</span>
        </label>
        <button class="primary" type="submit">连接 SSH</button>
      </form>

      <section class="saved-hosts">
        <div class="section-head">
          <strong>快速连接</strong>
          <button type="button" id="refresh-hosts" class="ghost">刷新</button>
        </div>
        <div id="host-list" class="host-list">
          <div class="host-empty">还没有保存的主机</div>
        </div>
      </section>

      <div class="hint">
        <strong>说明</strong>
        <p>Windows 本机不安装 WSL/虚拟机时，不能原生执行全部 Linux 命令。这个终端通过 SSH 连接远端 Linux，从而获得完整 Linux 环境。</p>
      </div>
      <div id="status" class="status">准备就绪</div>
    </aside>

    <main class="workspace">
      <div class="tabs" id="tabs"></div>
      <div class="terminal-stack" id="terminal-stack">
        <div class="empty-state">
          <h2>建立你的第一个 SSH 会话</h2>
          <p>连接 Linux 主机后，这里会显示交互式终端。</p>
        </div>
      </div>
    </main>
  </div>
`;

const connectForm = document.querySelector("#connect-form");
const statusEl = document.querySelector("#status");
const tabsEl = document.querySelector("#tabs");
const terminalStackEl = document.querySelector("#terminal-stack");
const keyPathEl = document.querySelector("#key-path");
const pickKeyBtn = document.querySelector("#pick-key");
const hostListEl = document.querySelector("#host-list");
const refreshHostsBtn = document.querySelector("#refresh-hosts");

let selectedPrivateKey = null;

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function setStatus(message, type = "normal") {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function renderHosts() {
  if (state.hosts.length === 0) {
    hostListEl.innerHTML = `<div class="host-empty">还没有保存的主机</div>`;
    return;
  }

  hostListEl.innerHTML = state.hosts
    .map((host) => `
      <article class="host-card" data-host-id="${host.id}">
        <button class="host-main" data-connect-host="${host.id}">
          <strong>${escapeHtml(host.name || `${host.username}@${host.host}`)}</strong>
          <span>${escapeHtml(`${host.username}@${host.host}:${host.port || 22}`)}</span>
        </button>
        <button class="host-delete" data-delete-host="${host.id}" title="删除">×</button>
      </article>
    `)
    .join("");
}

async function loadHosts() {
  state.hosts = await window.myshell.listHosts();
  renderHosts();
}

function fillForm(host) {
  connectForm.elements.name.value = host.name || "";
  connectForm.elements.host.value = host.host || "";
  connectForm.elements.port.value = host.port || 22;
  connectForm.elements.username.value = host.username || "";
  connectForm.elements.password.value = "";
  connectForm.elements.saveHost.checked = true;

  selectedPrivateKey = null;
  keyPathEl.value = host.privateKeyPath || "";
}

function renderTabs() {
  const items = [...state.sessions.values()]
    .map((session) => `
      <button class="tab ${session.id === state.activeId ? "active" : ""}" data-id="${session.id}">
        <span>${session.name}</span>
        <span class="close" data-close="${session.id}">×</span>
      </button>
    `)
    .join("");

  tabsEl.innerHTML = items;
}

function setActiveSession(id) {
  state.activeId = id;

  for (const session of state.sessions.values()) {
    session.wrapper.hidden = session.id !== id;
  }

  renderTabs();

  const active = state.sessions.get(id);
  if (active) {
    active.fit.fit();
    active.term.focus();
    void window.myshell.resizeSession({
      id,
      cols: active.term.cols,
      rows: active.term.rows
    });
  }
}

function removeSession(id) {
  const session = state.sessions.get(id);
  if (!session) {
    return;
  }

  session.term.dispose();
  session.wrapper.remove();
  state.sessions.delete(id);

  if (state.activeId === id) {
    const next = state.sessions.keys().next().value || null;
    state.activeId = next;
  }

  if (state.sessions.size === 0) {
    terminalStackEl.innerHTML = `
      <div class="empty-state">
        <h2>建立你的第一个 SSH 会话</h2>
        <p>连接 Linux 主机后，这里会显示交互式终端。</p>
      </div>
    `;
    state.activeId = null;
  }

  renderTabs();
  if (state.activeId) {
    setActiveSession(state.activeId);
  }
}

function createTerminalView(sessionInfo) {
  const empty = terminalStackEl.querySelector(".empty-state");
  if (empty) {
    empty.remove();
  }

  const wrapper = document.createElement("section");
  wrapper.className = "terminal-pane";
  wrapper.hidden = true;

  const mount = document.createElement("div");
  mount.className = "terminal";
  wrapper.appendChild(mount);
  terminalStackEl.appendChild(wrapper);

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
    fontSize: 14,
    lineHeight: 1.2,
    theme: {
      background: "#08111f",
      foreground: "#d6e2ff",
      cursor: "#f8fafc",
      selectionBackground: "#26415f",
      black: "#102033",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#f59e0b",
      blue: "#3b82f6",
      magenta: "#ec4899",
      cyan: "#06b6d4",
      white: "#dbeafe",
      brightBlack: "#3d5875",
      brightRed: "#f87171",
      brightGreen: "#4ade80",
      brightYellow: "#fbbf24",
      brightBlue: "#60a5fa",
      brightMagenta: "#f472b6",
      brightCyan: "#22d3ee",
      brightWhite: "#ffffff"
    }
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(mount);
  fit.fit();
  term.focus();

  term.onData((data) => {
    void window.myshell.writeSession({
      id: sessionInfo.id,
      data
    });
  });

  state.sessions.set(sessionInfo.id, {
    ...sessionInfo,
    wrapper,
    mount,
    term,
    fit
  });

  setActiveSession(sessionInfo.id);
  requestAnimationFrame(() => {
    fit.fit();
    void window.myshell.resizeSession({
      id: sessionInfo.id,
      cols: term.cols,
      rows: term.rows
    });
  });
}

pickKeyBtn.addEventListener("click", async () => {
  const result = await window.myshell.pickPrivateKey();
  if (!result) {
    return;
  }

  selectedPrivateKey = result;
  keyPathEl.value = result.path;
});

connectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(connectForm);

  setStatus("正在建立 SSH 连接...", "working");

  try {
    const payload = {
      name: String(form.get("name") || "").trim(),
      host: String(form.get("host") || "").trim(),
      port: String(form.get("port") || "22").trim(),
      username: String(form.get("username") || "").trim(),
      password: String(form.get("password") || ""),
      privateKey: selectedPrivateKey?.content || ""
    };

    const session = await window.myshell.createSshSession({
      ...payload
    });

    createTerminalView(session);

    if (form.get("saveHost")) {
      await window.myshell.saveHost({
        name: payload.name || `${payload.username}@${payload.host}`,
        host: payload.host,
        port: payload.port,
        username: payload.username,
        privateKeyPath: keyPathEl.value.trim()
      });
      await loadHosts();
    }

    setStatus(`已连接 ${session.name}`, "success");
  } catch (error) {
    setStatus(`连接失败: ${error.message}`, "error");
  }
});

tabsEl.addEventListener("click", async (event) => {
  const closeId = event.target.dataset.close;
  if (closeId) {
    await window.myshell.closeSession(closeId);
    removeSession(closeId);
    return;
  }

  const tab = event.target.closest(".tab");
  if (tab?.dataset.id) {
    setActiveSession(tab.dataset.id);
  }
});

hostListEl.addEventListener("click", async (event) => {
  const deleteId = event.target.dataset.deleteHost;
  if (deleteId) {
    await window.myshell.removeHost(deleteId);
    await loadHosts();
    setStatus("已删除保存的主机", "normal");
    return;
  }

  const connectId = event.target.closest("[data-connect-host]")?.dataset.connectHost;
  if (!connectId) {
    return;
  }

  const host = state.hosts.find((item) => item.id === connectId);
  if (!host) {
    return;
  }

  fillForm(host);
  setStatus(`已载入 ${host.name}`, "normal");
});

refreshHostsBtn.addEventListener("click", async () => {
  await loadHosts();
  setStatus("已刷新主机列表", "normal");
});

window.myshell.onSessionData(({ id, data }) => {
  const session = state.sessions.get(id);
  if (session) {
    session.term.write(data);
  }
});

window.myshell.onSessionExit(({ id }) => {
  if (state.sessions.has(id)) {
    setStatus(`会话已关闭: ${state.sessions.get(id).name}`, "normal");
  }
  removeSession(id);
});

window.myshell.onSessionError(({ id, message }) => {
  const session = state.sessions.get(id);
  if (session) {
    session.term.writeln(`\r\n[error] ${message}`);
  }
  setStatus(`连接异常: ${message}`, "error");
});

window.addEventListener("resize", () => {
  const active = state.sessions.get(state.activeId);
  if (!active) {
    return;
  }

  active.fit.fit();
  void window.myshell.resizeSession({
    id: active.id,
    cols: active.term.cols,
    rows: active.term.rows
  });
});

void loadHosts();
