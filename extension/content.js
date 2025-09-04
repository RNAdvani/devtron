class IPCContentScript {
  constructor() {
    this.isElectronApp = false;
    this.logBuffer = [];
    
    this.init();
  }
  
  init() {
    this.setupPageBridge();
  }
  
  setupPageBridge() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'ELECTRON_CHECK') {
        this.isElectronApp = event.data.isElectron;
        
        if (this.isElectronApp) {
          this.injectIPCHook();
        }
        
        chrome.runtime.sendMessage({
          type: 'CONNECTION_STATUS',
          connected: this.isElectronApp
        });
      } else if (event.data.type === 'IPC_LOG') {
        this.handleIPCLog(event.data.log);
      }
    });
  }
  
  
  handleIPCLog(log) {
    this.logBuffer.push(log);
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
    
    

    chrome.runtime.sendMessage({
      type: 'IPC_DATA',
      data: log
    });
  }
}

new IPCContentScript();