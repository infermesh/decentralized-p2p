// state-p2p-node.js
import { WebSocketServer, WebSocket } from 'ws';
import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import https from 'https';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

class DecentralizedNode extends EventEmitter {
  constructor(privateKey) {
    super();
    this.privateKey = privateKey;
    this.nodeId = this.generateNodeId();
    this.peers = new Map();
    this.state = {
      data: {},
      version: 0,
      timestamp: Date.now()
    };
    this.port = 3000 + Math.floor(Math.random() * 1000);
    this.nodePath = join(homedir(), '.infermesh', 'nodes');
    this.nodeFile = join(this.nodePath, `${this.nodeId}.json`);
    this.statePath = join(homedir(), '.infermesh', 'states');
    this.stateFile = join(this.statePath, `${this.nodeId}.json`);
    this.connectionAttempts = new Map();
    this.reconnectTimeouts = new Map();
  }

  generateNodeId() {
    return createHash('sha256')
      .update(this.privateKey)
      .digest('hex');
  }

  async getPublicIp() {
    return new Promise((resolve, reject) => {
      const req = https.get('https://api.ipify.org?format=json', (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try {
            const ip = JSON.parse(data).ip;
            resolve(ip);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('IP lookup timeout'));
      });
    });
  }

  async saveState() {
    try {
      await fs.mkdir(this.statePath, { recursive: true });
      const stateData = {
        nodeId: this.nodeId,
        state: this.state,
        timestamp: Date.now()
      };

      // Write to temporary file first
      const tempFile = `${this.stateFile}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(stateData, null, 2));
      await fs.rename(tempFile, this.stateFile);
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      const savedData = JSON.parse(data);

      if (!this.validateState(savedData)) {
        throw new Error('Invalid state data');
      }

      if (savedData.nodeId === this.nodeId) {
        this.state = savedData.state;
        console.log('State loaded successfully');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No previous state found, starting fresh');
      } else {
        console.error('Error loading state:', error);
        await this.backupCorruptedState();
      }
    }
  }

  validateState(state) {
    return state &&
      typeof state === 'object' &&
      state.nodeId &&
      state.state &&
      typeof state.state.version === 'number' &&
      typeof state.state.timestamp === 'number' &&
      typeof state.state.data === 'object';
  }

  async backupCorruptedState() {
    try {
      const timestamp = Date.now();
      const backupFile = `${this.stateFile}.${timestamp}.corrupt`;
      await fs.rename(this.stateFile, backupFile);
      console.log(`Corrupted state backed up to: ${backupFile}`);
    } catch (error) {
      console.error('Error backing up corrupted state:', error);
    }
  }

  async registerNode() {
    try {
      await fs.mkdir(this.nodePath, { recursive: true });
      const nodeInfo = {
        nodeId: this.nodeId,
        host: this.publicIp || 'localhost',
        port: this.port,
        lastSeen: Date.now(),
        startTime: Date.now(),
        state: {
          version: this.state.version,
          timestamp: this.state.timestamp
        }
      };

      // Write to temporary file first
      const tempFile = `${this.nodeFile}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(nodeInfo, null, 2));
      await fs.rename(tempFile, this.nodeFile);
    } catch (error) {
      console.error('Error registering node:', error);
    }
  }

  async updateNodeRegistry() {
    try {
      const nodeInfo = {
        nodeId: this.nodeId,
        host: this.publicIp || 'localhost',
        port: this.port,
        lastSeen: Date.now(),
        startTime: Date.now(),
        state: {
          version: this.state.version,
          timestamp: this.state.timestamp
        }
      };

      await fs.writeFile(this.nodeFile, JSON.stringify(nodeInfo, null, 2));
    } catch (error) {
      await this.registerNode();
    }
  }

  async discoverNodes() {
    const nodes = [];
    try {
      const files = await fs.readdir(this.nodePath);
      const currentTime = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const data = await fs.readFile(join(this.nodePath, file), 'utf8');
          const nodeInfo = JSON.parse(data);

          // Validate node info
          if (!nodeInfo.nodeId || !nodeInfo.host || !nodeInfo.port) {
            continue;
          }

          // Check if node was seen in the last hour
          if (currentTime - nodeInfo.lastSeen < 3600000) {
            nodeInfo.isConnected = this.peers.has(nodeInfo.nodeId);
            nodeInfo.isSelf = nodeInfo.nodeId === this.nodeId;
            nodes.push(nodeInfo);
          } else {
            // Clean up old node files
            await fs.unlink(join(this.nodePath, file));
          }
        } catch (error) {
          console.error(`Error reading node file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error discovering nodes:', error);
    }
    return nodes;
  }

  async initialize() {
    await fs.mkdir(this.nodePath, { recursive: true });
    await fs.mkdir(this.statePath, { recursive: true });

    // Load saved state
    await this.loadState();

    // Start the WebSocket server
    this.server = new WebSocketServer({
      port: this.port,
      host: '0.0.0.0'
    });

    try {
      this.publicIp = await this.getPublicIp();
      console.log(`Node ${this.nodeId} listening on port ${this.port}`);
      console.log('Public IP address:', this.publicIp);
    } catch (error) {
      console.log(`Node ${this.nodeId} listening on port ${this.port}`);
      console.log('Running on local network');
    }

    // Register node
    await this.registerNode();

    // Set up server connection handling
    this.server.on('connection', (ws, req) => {
      const remoteAddress = req.socket.remoteAddress;
      console.log(`Incoming connection from ${remoteAddress}`);
      this.handleConnection(ws, remoteAddress);
    });

    // Start periodic node discovery and connection
    await this.startNetworkDiscovery();

    // Set up periodic tasks
    setInterval(() => this.updateNodeRegistry(), 30000);
    setInterval(() => this.saveState(), 5000);
    setInterval(() => this.startNetworkDiscovery(), 60000);
    setInterval(() => this.checkPeerHealth(), 30000);

    return true;
  }

  checkPeerHealth() {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.ws.readyState !== WebSocket.OPEN) {
        console.log(`Peer ${peerId} connection is unhealthy, removing...`);
        this.peers.delete(peerId);
        this.scheduleReconnect(peerId);
      }
    }
  }

  scheduleReconnect(nodeId) {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeouts.has(nodeId)) {
      clearTimeout(this.reconnectTimeouts.get(nodeId));
    }

    // Schedule reconnection attempt
    const timeout = setTimeout(async () => {
      try {
        const nodes = await this.discoverNodes();
        const nodeInfo = nodes.find(n => n.nodeId === nodeId);
        if (nodeInfo && !nodeInfo.isConnected && !nodeInfo.isSelf) {
          console.log(`Attempting to reconnect to node ${nodeId}`);
          await this.connectToNode(nodeInfo);
        }
      } catch (error) {
        console.log(`Failed to reconnect to node ${nodeId}:`, error.message);
      }
      this.reconnectTimeouts.delete(nodeId);
    }, 5000 + Math.random() * 5000); // Random delay between 5-10 seconds

    this.reconnectTimeouts.set(nodeId, timeout);
  }

  async startNetworkDiscovery() {
    try {
      console.log('\nDiscovering network nodes...');
      const nodes = await this.discoverNodes();

      for (const nodeInfo of nodes) {
        if (nodeInfo.isSelf || nodeInfo.isConnected) continue;

        const lastAttempt = this.connectionAttempts.get(nodeInfo.nodeId);
        const now = Date.now();
        if (lastAttempt && (now - lastAttempt) < 300000) continue;

        this.connectionAttempts.set(nodeInfo.nodeId, now);

        try {
          console.log(`Attempting to connect to node ${nodeInfo.nodeId}`);
          await this.connectToNode(nodeInfo);
          console.log(`Successfully connected to node ${nodeInfo.nodeId}`);
        } catch (error) {
          console.log(`Failed to connect to node ${nodeInfo.nodeId}: ${error.message}`);
        }
      }

      const connectedNodes = this.peers.size;
      if (connectedNodes > 0) {
        console.log(`\nConnected to ${connectedNodes} active node${connectedNodes > 1 ? 's' : ''}`);
      } else {
        console.log('\nNo active nodes found. This is the first node in the network.');
      }
    } catch (error) {
      console.error('Error in network discovery:', error);
    }
  }

  async connectToNode(nodeInfo) {
    return new Promise((resolve, reject) => {
      if (!nodeInfo.host || !nodeInfo.port) {
        reject(new Error('Invalid node info'));
        return;
      }

      if (nodeInfo.port === this.port &&
        (nodeInfo.host === 'localhost' || nodeInfo.host === '127.0.0.1' || nodeInfo.host === this.publicIp)) {
        reject(new Error('Cannot connect to self'));
        return;
      }

      if (this.peers.has(nodeInfo.nodeId)) {
        reject(new Error('Already connected'));
        return;
      }

      const ws = new WebSocket(`ws://${nodeInfo.host}:${nodeInfo.port}`);
      let connectionTimeout;

      const cleanup = () => {
        clearTimeout(connectionTimeout);
        ws.removeAllListeners();
      };

      connectionTimeout = setTimeout(() => {
        cleanup();
        ws.terminate();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('error', (error) => {
        cleanup();
        reject(error);
      });

      ws.on('open', () => {
        cleanup();
        ws.send(JSON.stringify({
          type: 'INFO',
          nodeId: this.nodeId,
          port: this.port,
          state: this.state
        }));

        this.handleConnection(ws, nodeInfo.host);
        resolve(nodeInfo);
      });
    });
  }

  handleConnection(ws, remoteAddress) {
    let peerId = null;

    const messageHandler = async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'INFO' && !this.peers.has(message.nodeId)) {
          peerId = message.nodeId;
          this.peers.set(peerId, { ws, port: message.port });
          console.log(`Peer ${peerId} registered`);
        }

        await this.handleMessage(message, ws);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };

    const closeHandler = () => {
      if (peerId && this.peers.has(peerId)) {
        console.log(`Peer ${peerId} disconnected`);
        this.peers.delete(peerId);
        this.scheduleReconnect(peerId);
      }
      ws.removeListener('message', messageHandler);
      ws.removeListener('close', closeHandler);
      ws.removeListener('error', errorHandler);
    };

    const errorHandler = (error) => {
      console.error(`WebSocket error with peer ${peerId}:`, error);
      ws.close();
    };

    ws.on('message', messageHandler);
    ws.on('close', closeHandler);
    ws.on('error', errorHandler);

    ws.send(JSON.stringify({
      type: 'INFO',
      nodeId: this.nodeId,
      port: this.port,
      state: this.state
    }));
  }

  async handleMessage(message, ws) {
    if (!this.validateMessage(message)) {
      console.error('Invalid message received');
      return;
    }

    console.log('Received message:', message.type);

    switch (message.type) {
      case 'INFO':
        if (!this.peers.has(message.nodeId)) {
          this.peers.set(message.nodeId, { ws, port: message.port });
        }
        if (message.state.version > this.state.version) {
          this.state = message.state;
          await this.saveState();
          this.emit('stateUpdated', this.state);
        }
        break;

      case 'STATE_UPDATE':
        if (message.version > this.state.version) {
          this.state = {
            data: { ...this.state.data, ...message.data },
            version: message.version,
            timestamp: Date.now()
          };
          await this.saveState();
          this.broadcast(message, ws);
          this.emit('stateUpdated', this.state);
        }
        break;

      case 'DELETE_STATE':
        if (message.version > this.state.version) {
          delete this.state.data[message.key];
          this.state.version = message.version;
          this.state.timestamp = Date.now();
          await this.saveState();
          this.broadcast(message, ws);
          this.emit('stateUpdated', this.state);
        }
        break;
    }
  }

  validateMessage(message) {
    if (!message || typeof message !== 'object') return false;

    switch (message.type) {
      case 'INFO':
        return message.nodeId &&
          message.port &&
          message.state &&
          typeof message.state.version === 'number';

      case 'STATE_UPDATE':
        return message.data &&
          typeof message.data === 'object' &&
          typeof message.version === 'number';

      case 'DELETE_STATE':
        return typeof message.key === 'string' &&
          typeof message.version === 'number';

      default:
        return false;
    }
  }

  broadcast(message, excludeWs = null) {
    const messageString = JSON.stringify(message);
    for (const peer of this.peers.values()) {
      if (peer.ws !== excludeWs && peer.ws.readyState === WebSocket.OPEN) {
        try {
          peer.ws.send(messageString);
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    }
  }

  async updateState(key, value) {
    try {
      this.state.version++;
      this.state.data[key] = value;
      this.state.timestamp = Date.now();

      await this.saveState();

      this.broadcast({
        type: 'STATE_UPDATE',
        data: { [key]: value },
        version: this.state.version
      });

      return this.state;
    } catch (error) {
      console.error('Error updating state:', error);
      throw error;
    }
  }

  async deleteState(key) {
    try {
      if (key in this.state.data) {
        this.state.version++;
        delete this.state.data[key];
        this.state.timestamp = Date.now();

        await this.saveState();

        this.broadcast({
          type: 'DELETE_STATE',
          key,
          version: this.state.version
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting state:', error);
      throw error;
    }
  }

  getState() {
    return this.state;
  }

  async shutdown() {
    // Clear all reconnection timeouts
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();

    // Close all peer connections
    for (const [peerId, peer] of this.peers.entries()) {
      try {
        peer.ws.close();
      } catch (error) {
        console.error(`Error closing connection to peer ${peerId}:`, error);
      }
    }
    this.peers.clear();

    // Close the server
    if (this.server) {
      await new Promise((resolve, reject) => {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Save final state
    await this.saveState();

    console.log('Node shutdown complete');
  }
}

export default DecentralizedNode;