const path = require("node:path");
const { app, BrowserWindow } = require("electron");
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
