import { app, BrowserWindow, ipcMain,Notification,session } from "electron";
import * as path from "path";
import { hookIpcMain } from '../src'

let win: BrowserWindow | null = null;
let extensionId: string | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  await win.loadFile("index.html");

  win.webContents.openDevTools();
}

async function loadExtension(): Promise<string | null> {
  const extensionPath = "C:\\Users\\Rohan\\Desktop\\ipc-monitor\\example\\dist\\extension";
  console.log(extensionPath);

  try {
    const extension = await session.defaultSession.loadExtension(extensionPath, {
      allowFileAccess: true
    });
    
    console.log('IPC Logger extension loaded successfully with ID:', extension.id);
    return extension.id;
  } catch (error) {
    console.error('Failed to load IPC Logger extension:', error);
    return null;
  }
}

app.whenReady().then(() => {

  loadExtension().then((id)=>{
    extensionId =  id;
  });


  createWindow().then(() => {
    // Hook IPC Main AFTER creating window but BEFORE registering handlers
    if (win) {
      hookIpcMain(win);
    }
    
    // Now register your IPC handlers - they will be automatically logged
    ipcMain.handle("ping", handlePing);

    ipcMain.handle("system:dialog", async (event, message) => {
      new Notification({ title: 'Notification', body: message }).show();
      return `Notification sent with message: ${message}`;
    });

    ipcMain.handle("system:notify", async (event, message) => {
      const { dialog } = require('electron');
      await dialog.showMessageBox({
        type: 'info',
        title: 'Dialog',
        message: message
      });
    });

    ipcMain.on("send-on", (event, message) => {
      console.log('on', message);
      event.sender.send("on-reply", `Received your message: ${message}`);
    });
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
});

async function handlePing(event: Electron.IpcMainInvokeEvent, message: string) {
  console.log('ping')
  return `pong: ${message}`;
}