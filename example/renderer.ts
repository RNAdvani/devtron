// This runs in the BrowserWindow

function sendToDevTools(logData: any) {
  // Send via postMessage to the renderer process
  // The content script will pick this up
  if (typeof window !== 'undefined') {
    window.postMessage({
      type: 'IPC_LOG',
      log: logData
    }, '*');
  }
}

(window as any).api.onIpcLogData((logData: any) => {
    sendToDevTools(logData);
});


document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("pingBtn")!;
  const output = document.getElementById("output")!;

  btn.addEventListener("click", async () => {
    const reply = await (window as any).api.ping("Hello from renderer!");
    output.textContent = reply;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("notifyBtn")!;
  const output = document.getElementById("output")!;

  btn.addEventListener("click", async () => {
    const reply = await (window as any).api.notifyBtn("Hello from renderer!");
    output.textContent = reply;
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("dialogBtn")!;
  const output = document.getElementById("output")!;

  btn.addEventListener("click", async () => {
    const reply = await (window as any).api.dialogBtn("Hello from renderer!");
    output.textContent = reply;
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("onBtn")!;
  const output = document.getElementById("output")!;

  btn.addEventListener("click", async () => {
    const reply = await (window as any).api.sendOn("Hello from renderer!");
    output.textContent = reply;
  });
});
