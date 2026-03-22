const path = require("node:path");
const fs = require("node:fs/promises");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { Client } = require("ssh2");

const sessions = new Map();
const isDev = !app.isPackaged;
let hostsFilePath = "";

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function sessionData(eventName, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(eventName, payload);
  }
}

async function ensureHostsFile() {
  if (!hostsFilePath) {
    hostsFilePath = path.join(app.getPath("userData"), "hosts.json");
  }

  try {
    await fs.access(hostsFilePath);
  } catch {
    await fs.mkdir(path.dirname(hostsFilePath), { recursive: true });
    await fs.writeFile(hostsFilePath, "[]", "utf8");
  }
}

async function readHosts() {
  await ensureHostsFile();

  try {
    const content = await fs.readFile(hostsFilePath, "utf8");
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeHosts(hosts) {
  await ensureHostsFile();
  await fs.writeFile(hostsFilePath, JSON.stringify(hosts, null, 2), "utf8");
}

function validateConfig(config) {
  if (!config.host || !config.username) {
    throw new Error("host 和 username 不能为空");
  }

  if (!config.password && !config.privateKey) {
    throw new Error("当前 MVP 需要 password 或 privateKey");
  }
}

ipcMain.handle("session:create-ssh", async (_event, config) => {
  validateConfig(config);

  const id = `ssh-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const conn = new Client();

  return await new Promise((resolve, reject) => {
    let resolved = false;

    conn.on("ready", () => {
      conn.shell(
        {
          term: "xterm-256color",
          cols: config.cols || 120,
          rows: config.rows || 36
        },
        (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          sessions.set(id, {
            id,
            type: "ssh",
            conn,
            stream
          });

          stream.on("data", (data) => {
            sessionData("session:data", {
              id,
              data: data.toString("utf8")
            });
          });

          stream.on("close", () => {
            sessions.delete(id);
            sessionData("session:exit", { id });
            conn.end();
          });

          conn.on("close", () => {
            sessions.delete(id);
            sessionData("session:exit", { id });
          });

          conn.on("error", (error) => {
            sessionData("session:error", {
              id,
              message: error.message
            });
          });

          resolved = true;
          resolve({
            id,
            name: `${config.username}@${config.host}`
          });
        }
      );
    });

    conn.on("error", (err) => {
      if (!resolved) {
        reject(err);
        return;
      }

      sessionData("session:error", {
        id,
        message: err.message
      });
    });

    conn.connect({
      host: config.host,
      port: Number(config.port) || 22,
      username: config.username,
      password: config.password || undefined,
      privateKey: config.privateKey || undefined,
      readyTimeout: 15000,
      tryKeyboard: false
    });
  });
});

ipcMain.handle("session:write", (_event, payload) => {
  const session = sessions.get(payload.id);
  if (!session) {
    return false;
  }

  session.stream.write(payload.data);
  return true;
});

ipcMain.handle("session:resize", (_event, payload) => {
  const session = sessions.get(payload.id);
  if (!session) {
    return false;
  }

  session.stream.setWindow(payload.rows, payload.cols, 0, 0);
  return true;
});

ipcMain.handle("session:close", (_event, id) => {
  const session = sessions.get(id);
  if (!session) {
    return false;
  }

  session.stream.close();
  session.conn.end();
  sessions.delete(id);
  return true;
});

ipcMain.handle("dialog:pick-key", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Key Files", extensions: ["pem", "key", "ppk", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("hosts:list", async () => {
  return await readHosts();
});

ipcMain.handle("hosts:save", async (_event, host) => {
  if (!host.host || !host.username) {
    throw new Error("保存主机时 host 和 username 不能为空");
  }

  const hosts = await readHosts();
  const now = new Date().toISOString();
  const next = {
    id: host.id || `host-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: host.name || `${host.username}@${host.host}`,
    host: host.host,
    port: Number(host.port) || 22,
    username: host.username,
    privateKeyPath: host.privateKeyPath || "",
    updatedAt: now
  };
  const index = hosts.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    hosts[index] = next;
  } else {
    hosts.unshift(next);
  }

  await writeHosts(hosts);
  return next;
});

ipcMain.handle("hosts:remove", async (_event, id) => {
  const hosts = await readHosts();
  const next = hosts.filter((item) => item.id !== id);
  await writeHosts(next);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  for (const session of sessions.values()) {
    session.stream.close();
    session.conn.end();
  }
  sessions.clear();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
