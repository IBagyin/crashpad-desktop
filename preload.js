const { contextBridge, ipcRenderer } = require("electron");

// The site's only way into the main process. It gets these few functions
// rather than ipcRenderer itself, so it can't send on any other channel.
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("crashpad", {
  processItem: (id) => ipcRenderer.invoke("process-item:start", id),
  cancelProcess: () => ipcRenderer.invoke("process-item:cancel"),
  getOutputDir: () => ipcRenderer.invoke("process-item:get-output-dir"),
  chooseOutputDir: () => ipcRenderer.invoke("process-item:choose-output-dir"),
  onProcessOutput: (callback) => subscribe("process-item:output", callback),
  onProcessExit: (callback) => subscribe("process-item:exit", callback),
});
