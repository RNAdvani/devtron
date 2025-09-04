// Create the DevTools panel
chrome.devtools.panels.create(
  'IPC Monitor',
  'icon16.png',
  'panel.html',
  (panel) => {
    console.log('IPC Monitor panel created');
    
    
    panel.onShown.addListener((window) => {
      console.log('IPC Monitor panel shown');
      
      window.postMessage({ type: 'PANEL_SHOWN' }, '*');
    });
    
    panel.onHidden.addListener(() => {
      console.log('IPC Monitor panel hidden');
    });
  }
);