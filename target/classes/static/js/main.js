const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let loginWindow;
let mainWindow;

// --- LOGIN WINDOW ---
function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loginWindow.loadURL('http://localhost:8080/login');

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// --- MAIN WINDOW ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    show: false, // hide until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.maximize(); // ensure full screen
  mainWindow.loadURL('http://localhost:8080');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus(); // bring to front
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- APP FLOW ---
app.whenReady().then(() => {
  createLoginWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });
});

ipcMain.on('login-success', () => {
  // Ensure login window closes cleanly before launching main window
  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }

  setTimeout(() => {
    createMainWindow();
  }, 300); // slight delay prevents minimized bug
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
