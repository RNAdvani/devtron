import {BrowserWindow, ipcMain, IpcMainInvokeEvent} from 'electron'

export function hookIpcMain(mainWindow: BrowserWindow){
    const originalHandle = ipcMain.handle.bind(ipcMain);
    const originalOn = ipcMain.on.bind(ipcMain);

    // Function to send logs to renderer
    function sendLogToRenderer(logData: any) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ipc-log-data', logData);
        }
    }

    ipcMain.handle = (channel:string,listener:any)=>{
        console.log("[IPC REGISTER - handle]", channel);
        
        const logData = {
            type: 'register',
            method: 'handle',
            channel,
            timestamp: Date.now()
        };
        sendLogToRenderer(logData);

        return originalHandle(channel,async (event:IpcMainInvokeEvent,...args:any[])=>{
            const start = performance.now();
            const result = await listener(event,...args);
            const duration = performance.now() - start

            const callLogData = {
                type: 'call',
                method: 'handle',
                channel,
                args,
                result,
                duration,
                timestamp: Date.now(),
                sender: event.sender.id
            };

            console.log("[IPC CALL - handle]", channel, callLogData);
            sendLogToRenderer(callLogData);

            return result
        })
    }

    ipcMain.on = (channel:string,listener:any)=>{
        console.log("[IPC REGISTER - on]", channel);
        
        const logData = {
            type: 'register',
            method: 'on',
            channel,
            timestamp: Date.now()
        };
        sendLogToRenderer(logData);

        return originalOn(channel,async (event:IpcMainInvokeEvent,...args:any[])=>{
            const start = performance.now();
            const result = await listener(event,...args);
            const duration = performance.now() - start

            const callLogData = {
                type: 'call',
                method: 'on',
                channel,
                args,
                result,
                duration,
                timestamp: Date.now(),
                sender: event.sender.getTitle() 
            };

            console.log("[IPC CALL - on]", channel, callLogData);
            sendLogToRenderer(callLogData);

            return result
        })
    }
}