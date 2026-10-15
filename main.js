const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");
const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const APP_URL = "https://crash-pad.netlify.app";
const isMac = process.platform === "darwin";

// The local tool the site's "Process Item" button runs, with the IMDb ID as
// its only argument.
const PROCESS_COMMAND = "streamgrabber";
const IMDB_ID_RE = /^tt\d{7,10}$/;

// The site draws its own header, so the native title bar is hidden and the
// header doubles as the drag handle. The window controls float over one
// corner of it (traffic lights on the left on macOS, min/max/close on the
// right on Windows); the header's centered content only needs extra gutter
// once the window is narrow enough to reach them.
const CONTROLS_SIDE = isMac ? "left" : "right";
const CONTROLS_WIDTH = isMac ? "84px" : "150px";
const CSS = `
  header.glass-panel { -webkit-app-region: drag; }
  header.glass-panel :is(button, a, input, [role="tab"]) { -webkit-app-region: no-drag; }
  header.glass-panel > div {
    padding-${CONTROLS_SIDE}: max(1.5rem, calc(${CONTROLS_WIDTH} - max(0px, (100vw - 80rem) / 2))) !important;
  }
`;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    backgroundColor: "#000000",
    ...(isMac
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 26 } }
      : {
          titleBarStyle: "hidden",
          titleBarOverlay: { color: "#000000", symbolColor: "#ffffff", height: 40 },
          autoHideMenuBar: true,
        }),
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadURL(APP_URL);
  win.webContents.on("did-finish-load", () => win.webContents.insertCSS(CSS));
  // The site itself never opens new windows, so any popup is an ad (usually
  // from the embedded player) — drop it instead of opening it anywhere.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // Same for ad redirects that try to navigate the whole window away.
  // Compares whole origins: a prefix check would also let through look-alike
  // hosts such as crash-pad.netlify.app.example.com.
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAppOrigin(url)) event.preventDefault();
  });
}

// Apps started from Finder or the Dock get a bare PATH (/usr/bin:/bin:…), so
// tools installed with Homebrew or pipx wouldn't be found without these.
function toolEnv() {
  if (process.platform === "win32") return process.env;
  const extra = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  const dirs = new Set([...(process.env.PATH || "").split(path.delimiter), ...extra]);
  return { ...process.env, PATH: [...dirs].filter(Boolean).join(path.delimiter) };
}

// The window shows a remote site, so only that site's own top-level page may
// start the tool — not the embedded player's iframe, and not a page the
// window was somehow sent to instead.
function isAppOrigin(url) {
  try {
    return new URL(url).origin === new URL(APP_URL).origin;
  } catch {
    return false;
  }
}

function isTrustedSender(event) {
  const frame = event.senderFrame;
  return !!frame && frame === event.sender.mainFrame && isAppOrigin(frame.url);
}

// What the site and its player need; camera, microphone, location,
// notifications and the rest are refused for every page, ads included.
const ALLOWED_PERMISSIONS = new Set(["fullscreen", "mediaKeySystem", "clipboard-sanitized-write"]);

let running = null;

function setupProcessIpc() {
  ipcMain.handle("process-item:start", async (event, id) => {
    if (!isTrustedSender(event)) throw new Error("Not allowed from this page");
    if (typeof id !== "string" || !IMDB_ID_RE.test(id)) throw new Error("Not an IMDb ID");
    if (running) throw new Error("A task is already running");

    // A native prompt the page can't draw or click itself, so nothing runs
    // unless a person at this machine agrees to it.
    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Run", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      message: `Run ${PROCESS_COMMAND} for ${id}?`,
    });
    if (response !== 0) throw new Error("Cancelled");
    if (running) throw new Error("A task is already running");

    const sender = event.sender;
    const send = (channel, payload) => {
      if (!sender.isDestroyed()) sender.send(channel, payload);
    };
    // No shell: the ID reaches the tool as one literal argument, so nothing
    // in it can be read as another command.
    const targetUrl = `https://streamimdb.ru/embed/movie/${id}/`;
    const child = spawn(PROCESS_COMMAND, [targetUrl], { env: toolEnv(), shell: false, windowsHide: true });   
    running = child;

    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      if (running === child) running = null;
      send("process-item:exit", result);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text) => send("process-item:output", { stream: "stdout", text }));
    child.stderr.on("data", (text) => send("process-item:output", { stream: "stderr", text }));
    child.on("error", (err) =>
      finish({
        code: null,
        error: err.code === "ENOENT" ? `${PROCESS_COMMAND} was not found on PATH` : err.message,
      }),
    );
    child.on("close", (code, signal) => finish({ code, signal }));
    return true;
  });

  ipcMain.handle("process-item:cancel", (event) => {
    if (!isTrustedSender(event) || !running) return false;
    return running.kill();
  });

  app.on("before-quit", () => running?.kill());
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(ALLOWED_PERMISSIONS.has(perm)));
  setupProcessIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
