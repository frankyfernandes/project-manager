import { app, BrowserWindow, ipcMain, shell, Menu, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { db } from './db.js';
import { registerIpcHandlers } from './ipcHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      plugins: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow.webContents.send('open-command-palette');
          }
        },
        {
          label: 'Settings',
          click: () => {
            mainWindow.webContents.send('open-settings');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'p') {
      event.preventDefault();
      mainWindow.webContents.send('open-command-palette');
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.on('show-menu', (event, { type, x, y }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  let template = [];
  
  if (type === 'file') {
    template = [
      {
        label: 'Command Palette',
        accelerator: 'CmdOrCtrl+P',
        click: () => win.webContents.send('open-command-palette')
      },
      {
        label: 'Settings',
        click: () => win.webContents.send('open-settings')
      },
      { type: 'separator' },
      { role: 'quit' }
    ];
  } else if (type === 'edit') {
    template = [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ];
  } else if (type === 'view') {
    template = [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win, x: Math.round(x), y: Math.round(y) });
});

ipcMain.handle('open-path', async (event, filePath) => {
  return await shell.openPath(filePath);
});
