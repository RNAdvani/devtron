class IPCMonitorPanel {
    constructor() {
        this.logs = [];
        this.channels = new Map();
        this.serviceTree = new Map();
        this.isConnected = false;
        this.maxDuration = 0;

        
        this.logContainer = document.getElementById('logContainer');
        this.logContainer.style.overflowY = 'scroll';
        this.logContainer.style.height = '100px';
        this.statusElement = document.getElementById('status');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.totalCount = document.getElementById('totalCount');
        this.avgDuration = document.getElementById('avgDuration');
        this.channelStats = document.getElementById('channelStats');
        this.treeGraph = document.getElementById('treeGraph');
        this.expandAllBtn = document.getElementById('expandAllBtn');
        this.collapseAllBtn = document.getElementById('collapseAllBtn');

        this.init();
    }

    init() {
    this.clearBtn.addEventListener('click', () => this.clearLogs());
    this.exportBtn.addEventListener('click', () => this.exportLogs());
    this.expandAllBtn.addEventListener('click', () => this.expandAllServices());
    this.collapseAllBtn.addEventListener('click', () => this.collapseAllServices());

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            this.switchTab(tabName);
        });
    });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
        if (!this._listenerAdded) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.type === 'IPC_DATA') {
                    this.handleIPCData(message.data);
                } else if (message.type === 'CONNECTION_STATUS') {
                    this.updateConnectionStatus(message.connected);
                }
            });
            this._listenerAdded = true;
        }
        this.checkConnection();
    } else {
        console.warn('Not running in a Chrome Extension context. No data will be received.');
        this.updateConnectionStatus(false);
    }
}
    
    checkConnection() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            // Check the connection with the content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, (response) => {
                        this.updateConnectionStatus(!!response);
                    });
                } else {
                    this.updateConnectionStatus(false);
                }
            });
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        this.statusElement.className = `status ${connected ? 'connected' : 'disconnected'}`;
        this.statusElement.innerHTML = `
            <div class="status-dot"></div>
            <span>${connected ? 'Connected to DevTools' : 'Waiting for connection...'}</span>
        `;
    }

    handleIPCData(data) {
    const logEntry = {
        ...data,
        timestamp: data.timestamp || Date.now(),
        id: this.logs.length
    };

    // Prevent duplicates by checking last log
    const lastLog = this.logs[this.logs.length - 1];
    if (lastLog 
        && lastLog.channel === logEntry.channel 
        && lastLog.method === logEntry.method 
        && lastLog.timestamp === logEntry.timestamp) {
        return;
    }

    this.logs.push(logEntry);
    this.updateChannelStats(data);
    this.updateServiceTree(data);
    this.updateGlobalStats();
    this.renderLogs(logEntry); // append only new one
    this.renderServiceTree();
    this.updateConnectionStatus(true);

    if (data.duration) {
        this.maxDuration = Math.max(this.maxDuration, data.duration);
    }
    }


    updateServiceTree(data) {
        const channel = data.channel;
        if (!channel) return;

        let serviceName;
        let eventName;

        // Graph to depict service-event relationships

        if (channel.includes(':')) {
            
            [serviceName, eventName] = channel.split(':', 2);
        } else {
            
            serviceName = channel;
            eventName = channel; 
        }

        if (!this.serviceTree.has(serviceName)) {
            this.serviceTree.set(serviceName, {
                name: serviceName,
                events: new Map(),
                totalCalls: 0,
                totalDuration: 0,
                avgDuration: 0,
                lastActivity: null
            });
        }

        const service = this.serviceTree.get(serviceName);

        if (!service.events.has(eventName)) {
            service.events.set(eventName, {
                name: eventName,
                calls: 0,
                totalDuration: 0,
                avgDuration: 0,
                lastCall: null,
                method: data.method || 'handle'
            });
        }

        const event = service.events.get(eventName);

        if (data.type === 'call' && data.duration) {
            event.calls++;
            event.totalDuration += data.duration;
            event.avgDuration = event.totalDuration / event.calls;
            event.lastCall = data.timestamp;

            service.totalCalls++;
            service.totalDuration += data.duration;
            service.avgDuration = service.totalDuration / service.totalCalls;
            service.lastActivity = data.timestamp;
        }
    }

    renderServiceTree() {
        if (this.serviceTree.size === 0) {
            this.treeGraph.innerHTML = `
                <div class="empty-state">
                    No IPC services detected yet. Interact with your app to see the service graph.
                </div>
            `;
            return;
        }

        const servicesHtml = Array.from(this.serviceTree.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(service => {
                const eventsHtml = Array.from(service.events.values())
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(event => {
                        const perfClass = this.getPerformanceClass(event.avgDuration);
                        const fullChannelName = service.name === event.name ? service.name : `${service.name}:${event.name}`;
                        return `
                            <div class="event-node" data-channel="${fullChannelName}">
                                <div class="event-name">${event.name}</div>
                                <div class="event-stats">
                                    <span>${event.calls} calls</span>
                                    <span class="${perfClass}">${event.avgDuration.toFixed(1)}ms</span>
                                </div>
                            </div>
                        `;
                    }).join('');

                return `
                    <div class="service-node">
                        <div class="service-name">${service.name}</div>
                        <div class="service-stats">
                            ${service.totalCalls} total calls | 
                            Avg: ${service.avgDuration.toFixed(1)}ms | 
                            Last: ${service.lastActivity ? new Date(service.lastActivity).toLocaleTimeString() : 'Never'}
                        </div>
                        <div class="event-children">
                            ${eventsHtml}
                        </div>
                    </div>
                `;
            }).join('');

        this.treeGraph.innerHTML = servicesHtml;

        this.treeGraph.querySelectorAll('.event-node').forEach(node => {
            node.addEventListener('click', () => {
                this.treeGraph.querySelectorAll('.event-node').forEach(n => n.classList.remove('active'));
                node.classList.add('active');
                
                const channel = node.getAttribute('data-channel');
                this.filterLogsByChannel(channel);
            });
        });
    }

    getPerformanceClass(duration) {
        if (duration < 10) return 'perf-fast';
        if (duration < 30) return 'perf-medium';
        return 'perf-slow';
    }

    filterLogsByChannel(channel) {
        this.switchTab('logs');
        
        setTimeout(() => {
            this.logContainer.querySelectorAll('.log-entry').forEach(entry => {
                const channelElement = entry.querySelector('.log-channel');
                if (channelElement && channelElement.textContent === channel) {
                    entry.style.background = '#0e639c33';
                    // Scroll the element into view
                    entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        entry.style.background = '';
                    }, 2500);
                }
            });
        }, 100);
    }

    expandAllServices() {
        console.log('Expand all services functionality can be implemented here.');
    }

    collapseAllServices() {
        console.log('Collapse all services functionality can be implemented here.');
    }

    updateChannelStats(data) {
        if (!this.channels.has(data.channel)) {
            this.channels.set(data.channel, {
                name: data.channel,
                calls: 0,
                totalDuration: 0,
                avgDuration: 0,
                lastCall: null
            });
        }

        const stats = this.channels.get(data.channel);
        if (data.type === 'call' && data.duration) {
            stats.calls++;
            stats.totalDuration += data.duration;
            stats.avgDuration = stats.totalDuration / stats.calls;
            stats.lastCall = data.timestamp;
        }

        this.renderChannelStats();
    }

    updateGlobalStats() {
        const callLogs = this.logs.filter(log => log.type === 'call' && log.duration);
        const totalCalls = callLogs.length;
        const avgDuration = totalCalls > 0 ?
            callLogs.reduce((sum, log) => sum + log.duration, 0) / totalCalls : 0;

        this.totalCount.textContent = this.logs.length;
        this.avgDuration.textContent = `${avgDuration.toFixed(1)}ms`;
    }

    renderChannelStats() {
        const statsHtml = Array.from(this.channels.values())
            .sort((a, b) => b.calls - a.calls)
            .slice(0, 10) // Show top 10 channels
            .map(stats => `
                <div class="channel-item">
                    <div class="channel-name">${stats.name}</div>
                    <div class="channel-meta">
                        <span>Calls: ${stats.calls}</span>
                        <span>Avg: ${stats.avgDuration.toFixed(1)}ms</span>
                        <span>Last: ${stats.lastCall ? new Date(stats.lastCall).toLocaleTimeString() : 'Never'}</span>
                    </div>
                </div>
            `).join('');

        this.channelStats.innerHTML = statsHtml;
    }

    renderLogs(newLog) {
    if (!newLog) {
        // Initial empty state
        if (this.logs.length === 0) {
            this.logContainer.innerHTML = `
                <div class="empty-state">
                    No IPC messages yet. Interact with your app to see messages here.
                </div>
            `;
        }
        return;
    }

    // Remove placeholder empty state if present
    if (this.logContainer.querySelector('.empty-state')) {
        this.logContainer.innerHTML = '';
    }

    const entry = this.createLogEntry(newLog);
    this.logContainer.appendChild(entry);

    // Keep only the last 100 entries in DOM
    while (this.logContainer.childNodes.length > 100) {
        this.logContainer.removeChild(this.logContainer.firstChild);
    }

    // Auto-scroll to bottom
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    createLogEntry(log) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${log.type}`;

        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const duration = log.duration || 0;
        const timingWidth = this.maxDuration > 0 ? (duration / this.maxDuration) * 100 : 0;
        const perfClass = this.getPerformanceClass(duration);

        entry.innerHTML = `
            <div class="log-header">
                <div class="log-method method-${log.method || log.type}">${log.method || log.type}</div>
                <div class="log-channel">${log.channel}</div>
                <div class="log-timing">
                    ${duration > 0 ? `
                        <div class="timing-bar">
                            <div class="timing-fill" style="width: ${timingWidth}%"></div>
                        </div>
                        <span>${duration.toFixed(1)}ms</span>
                        <span class="performance-badge ${perfClass}">
                            ${duration < 10 ? 'Fast' : duration < 30 ? 'OK' : 'Slow'}
                        </span>
                    ` : `
                        <span>${timestamp}</span>
                    `}
                </div>
                <div class="expand-icon">▶</div>
            </div>
            <div class="log-details">
                ${log.args ? `
                    <div class="detail-section">
                        <div class="detail-title">Arguments</div>
                        <div class="detail-content">${this.formatJSON(log.args)}</div>
                    </div>
                ` : ''}
                ${log.result !== undefined ? `
                    <div class="detail-section">
                        <div class="detail-title">Result</div>
                        <div class="detail-content">${this.formatJSON(log.result)}</div>
                    </div>
                ` : ''}
                ${log.error ? `
                    <div class="detail-section">
                        <div class="detail-title">Error</div>
                        <div class="detail-content">${this.formatJSON(log.error)}</div>
                    </div>
                ` : ''}
                ${log.sender ? `
                    <div class="detail-section">
                        <div class="detail-title">Sender</div>
                        <div class="detail-content">${log.sender}</div>
                    </div>
                ` : ''}
                <div class="detail-section">
                    <div class="detail-title">Timestamp</div>
                    <div class="detail-content">${new Date(log.timestamp).toISOString()}</div>
                </div>
            </div>
        `;

        entry.querySelector('.log-header').addEventListener('click', () => {
            entry.classList.toggle('expanded');
        });

        return entry;
    }

    formatJSON(data) {
        try {
            if (typeof data === 'string') return data;
            const jsonString = JSON.stringify(data, null, 2);
            return jsonString
                .replace(/"([^"]+)":/g, '<span class="json-key">"$1":</span>')
                .replace(/"([^"]*)"/g, '<span class="json-string">"$1"</span>')
                .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>')
                .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>');
        } catch (e) {
            return 'Could not format data.';
        }
    }

    clearLogs() {
        this.logs = [];
        this.channels.clear();
        this.serviceTree.clear();
        this.maxDuration = 0;
        this.renderLogs();
        this.renderChannelStats();
        this.renderServiceTree();
        this.updateGlobalStats();
    }

    exportLogs() {
        const data = {
            logs: this.logs,
            channels: Object.fromEntries(this.channels),
            serviceTree: this.serializeServiceTree(),
            exportedAt: new Date().toISOString(),
            totalCount: this.logs.length
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `ipc-logs-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    serializeServiceTree() {
        const result = {};
        for (const [serviceName, service] of this.serviceTree) {
            result[serviceName] = {
                ...service,
                events: Object.fromEntries(service.events)
            };
        }
        return result;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    new IPCMonitorPanel();
});