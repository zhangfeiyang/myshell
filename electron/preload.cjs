const { contextBridge, ipcRenderer } = require("electron");
const fs = require("node:fs/promises");

contextBridge.exposeInMainWorld("myshell", {
  platform: process.platform,
  createSshSession: (config) => ipcRenderer.invoke("session:create-ssh", config),
  writeSession: (payload) => ipcRenderer.invoke("session:write", payload),
  resizeSession: (payload) => ipcRenderer.invoke("session:resize", payload),
  closeSession: (id) => ipcRenderer.invoke("session:close", id),
  pickPrivateKey: async () => {
    const file = await ipcRenderer.invoke("dialog:pick-key");
    if (!file) {
      return null;
    }

    const content = await fs.readFile(file, "utf8");
    return {
      path: file,
      content
    };
  },
  onSessionData: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("session:data", handler);
    return () => ipcRenderer.removeListener("session:data", handler);
  },
  onSessionExit: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("session:exit", handler);
    return () => ipcRenderer.removeListener("session:exit", handler);
  },
  onSessionError: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("session:error", handler);
    return () => ipcRenderer.removeListener("session:error", handler);
  }
});
