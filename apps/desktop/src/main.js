const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");
const { URL } = require("node:url");
const log = require("electron-log");
const { createWebAppRuntime } = require("./web-app");
const { createDesktopHelperServer } = require("./helper-server");

const HELPER_HOST = "127.0.0.1";
const HELPER_PORT = 43823;
const HELPER_URL = `http://${HELPER_HOST}:${HELPER_PORT}`;
// Dark-mode is the default brand mark everywhere outside the in-app UI (favicon, this taskbar/window icon, and the
// packaged installer icon via electron-builder's build/icon.png convention). Only the sidebar logo inside the app
// swaps with the in-app theme toggle - see apps/web/src/components/AppShell.tsx.
const APP_ICON_PATH = path.join(__dirname, "..", "build", "icon.png");

let mainWindow = null;
let webAppRuntime = null;
let helperServer = null;
let isShuttingDown = false;

function createHelperServer() {
    helperServer = createDesktopHelperServer({ app, host: HELPER_HOST, log, port: HELPER_PORT });
    void helperServer.start();
    // Fire-and-forget: warms Tectonic's local file cache in the background so the wait (if any) happens before
    // the user opens Resume Studio instead of blocking their first actual compile - see latex-runtime.js's
    // warmCache() for why this is needed at all. Never blocks window creation.
    void helperServer.latexRuntime.warmCache();
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        height: 860,
        icon: APP_ICON_PATH,
        minHeight: 680,
        minWidth: 980,
        show: false,
        title: "CareerOS Desktop",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
        width: 1280,
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    // Only the main window's own local origin (127.0.0.1:<web port>, and the "file://.../renderer/*.html" loading
    // shells) should ever be a main-frame navigation target - stops the main window itself from navigating away,
    // e.g. via a redirect bug or a link that isn't opened as target="_blank".
    mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
        try {
            const target = new URL(targetUrl);
            const isLocalHttp = target.protocol === "http:" && target.hostname === HELPER_HOST;
            const isLocalFile = target.protocol === "file:";
            if (!isLocalHttp && !isLocalFile) {
                event.preventDefault();
            }
        } catch {
            event.preventDefault();
        }
    });

    // Google/GitHub sign-in no longer relies on in-app popups (src/oauth.js opens the system browser directly via
    // shell.openExternal instead - Google actively blocks OAuth consent screens loaded inside an embedded webview
    // like an Electron BrowserWindow). Any window.open() call - accidental or from an external link - gets routed
    // to the system browser too, rather than spawning an unmanaged in-app popup window.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const target = new URL(url);
            if (target.protocol === "https:" || target.protocol === "http:") {
                void shell.openExternal(url);
            }
        } catch {
            // Ignore malformed URLs - nothing to open.
        }
        return { action: "deny" };
    });

    await mainWindow.loadFile(path.join(__dirname, "renderer", "loading.html"));

    webAppRuntime = createWebAppRuntime({
        app,
        log,
        helperUrl: HELPER_URL,
    });

    try {
        const webUrl = await webAppRuntime.start();
        // The coding arena fetches problem data live from the web app's own API (see src/coding/index.js) - it
        // needs to know the bundled web app's local URL once it's up, which isn't known any earlier than this.
        if (helperServer) {
            helperServer.setWebBaseUrl(webUrl);
        }
        await mainWindow.loadURL(`${webUrl}/dashboard`);
    } catch (error) {
        log.error("Failed to start CareerOS web app", error);
        await mainWindow.loadFile(path.join(__dirname, "renderer", "error.html"));
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
        shutdownRuntimes();
    });
}

function shutdownWebAppRuntime() {
    if (webAppRuntime) {
        webAppRuntime.stop();
        webAppRuntime = null;
    }
}

function shutdownHelperServer() {
    if (helperServer) {
        void helperServer.close();
        helperServer = null;
    }
}

function shutdownRuntimes() {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    shutdownWebAppRuntime();
    shutdownHelperServer();
}

function resetShutdownFlagForNewWindow() {
    isShuttingDown = false;
}

app.whenReady().then(async () => {
    createHelperServer();
    await createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            resetShutdownFlagForNewWindow();
            createHelperServer();
            void createWindow();
        }
    });
});

app.on("before-quit", () => {
    shutdownRuntimes();
});

app.on("window-all-closed", () => {
    shutdownRuntimes();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("will-quit", () => {
    shutdownRuntimes();
});

process.on("exit", () => {
    shutdownWebAppRuntime();
});
