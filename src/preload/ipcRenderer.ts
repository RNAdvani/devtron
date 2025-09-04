export function hookIpcRenderer() {
  try {
    const { ipcRenderer } = require('electron');
    
    const originalInvoke = ipcRenderer.invoke.bind(ipcRenderer);
    const originalSend = ipcRenderer.send.bind(ipcRenderer);
    const originalOn = ipcRenderer.on.bind(ipcRenderer);

    ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
      console.log("[IPC RENDERER - invoke register]", channel, "with args:", args);

      const start = performance.now();
      try {
        const result = await originalInvoke(channel, ...args);
        const duration = performance.now() - start;

        console.log("[IPC RENDERER - invoke call]", channel, { 
          args, 
          result, 
          duration: `${duration.toFixed(2)}ms` 
        });
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error("[IPC RENDERER - invoke error]", channel, { 
          args,
          argsTypes: args.map(arg => typeof arg),
          error, 
          duration: `${duration.toFixed(2)}ms` 
        });
        throw error;
      }
    };

    ipcRenderer.send = (channel: string, ...args: any[]) => {
      console.log("[IPC RENDERER - send call]", channel, { args });
      return originalSend(channel, ...args);
    };

    ipcRenderer.on = (channel: string, listener: (...args: any[]) => void) => {
      console.log("[IPC RENDERER - on register]", channel);

      return originalOn(channel, (...args: any[]) => {
        const start = performance.now();
        try {
          listener(...args);
          const duration = performance.now() - start;

          console.log("[IPC RENDERER - on call]", channel, { 
            args, 
            duration: `${duration.toFixed(2)}ms` 
          });
        } catch (error) {
          const duration = performance.now() - start;
          console.error("[IPC RENDERER - on error]", channel, { 
            args, 
            error, 
            duration: `${duration.toFixed(2)}ms` 
          });
        }
      });
    };

    return ipcRenderer
    console.log("[IPC RENDERER] Hook installed successfully");
  } catch (error) {
    console.error("[IPC HOOK] Failed:", error);
  }
}