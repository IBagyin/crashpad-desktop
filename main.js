const { app, BrowserWindow, session } = require("electron");

const APP_URL = "https://crash-pad.netlify.app";
const isMac = process.platform === "darwin";

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
    webPreferences: { backgroundThrottling: false },
  });
  win.loadURL(APP_URL);
  win.webContents.on("did-finish-load", () => win.webContents.insertCSS(CSS));
  // The site itself never opens new windows, so any popup is an ad (usually
  // from the embedded player) — drop it instead of opening it anywhere.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // Same for ad redirects that try to navigate the whole window away.
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) event.preventDefault();
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
