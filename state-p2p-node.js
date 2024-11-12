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
  }

  generateNodeId() {
    return createHash('sha256')
      .update(this.privateKey)
      .digest('hex');
  }

  async getPublicIp() {
    return new Promise((resolve, reject) => {
      https.get('https://api.ipify.org?format=json', (resp) => {
        let data = '';
        resp.on('data', (chunk) => data += chunk);
        resp.on('end', () => {
          try {
            const ip = JSON.parse(data).ip;
            resolve(ip);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  async saveState() {
    try {
      await fs.mkdir(this.statePath, { recursive: true });
      await fs.writeFile(
        this.stateFile,
        JSON.stringify({
          nodeId: this.nodeId,
          state: this.state,
          timestamp: Date.now()
        }, null, 2)
      );
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      const savedData = JSON.parse(data);
      if (savedData.nodeId === this.nodeId) {
        this.state = savedData.state;
        console.log('State loaded from disk');
      }
    } catch (error) {
      console.log('No previous state found, starting fresh');
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

      await fs.writeFile(
        this.nodeFile,
        JSON.stringify(nodeInfo, null, 2)
      );
    } catch (error) {
      console.error('Error registering node:', error);
    }
  }

  async updateNodeRegistry() {
    try {
      if (await fs.access(this.nodeFile).then(() => true).catch(() => false)) {
        const nodeInfo = JSON.parse(await fs.readFile(this.nodeFile, 'utf8'));
        nodeInfo.lastSeen = Date.now();
        nodeInfo.state = {
          version: this.state.version,
          timestamp: this.state.timestamp
        };
        await fs.writeFile(this.nodeFile, JSON.stringify(nodeInfo, null, 2));
      } else {
        await this.registerNode();
      }
    } catch (error) {
      await this.registerNode();
    }
  }

  async discoverNodes() {
    const nodes = [];
    try {
      const files = await fs.readdir(this.nodePath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(join(this.nodePath, file), 'utf8');
            const nodeInfo = JSON.parse(data);

            // Check if node was seen in the last hour
            if (Date.now() - nodeInfo.lastSeen < 3600000) {
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

    // Auto-connect to active nodes
    console.log('\nDiscovering and connecting to active nodes...');
    const nodes = await this.discoverNodes();
    for (const nodeInfo of nodes) {
      if (!nodeInfo.isSelf) {
        try {
          console.log(`Attempting to connect to node ${nodeInfo.nodeId}`);
          await this.connect(nodeInfo.host, nodeInfo.port);
          console.log(`Successfully connected to node ${nodeInfo.nodeId}`);
        } catch (error) {
          console.log(`Failed to connect to node ${nodeInfo.nodeId}: ${error.message}`);
        }
      }
    }

    // Show connection summary
    const connectedNodes = this.peers.size;
    if (connectedNodes > 0) {
      console.log(`\nConnected to ${connectedNodes} active node${connectedNodes > 1 ? 's' : ''}`);
    } else {
      console.log('\nNo active nodes found. This is the first node in the network.');
    }

    // Set up periodic updates
    setInterval(() => this.updateNodeRegistry(), 30000);
    setInterval(() => this.saveState(), 5000);

    this.server.on('connection', (ws, req) => {
      const remoteAddress = req.socket.remoteAddress;
      console.log(`Incoming connection from ${remoteAddress}`);
      this.handleConnection(ws, remoteAddress);
    });

    return true;
  }

  handleConnection(ws, remoteAddress) {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(message, ws);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('close', () => {
      for (const [peerId, peer] of this.peers.entries()) {
        if (peer.ws === ws) {
          console.log(`Peer ${peerId} disconnected`);
          this.peers.delete(peerId);
          break;
        }
      }
    });

    ws.send(JSON.stringify({
      type: 'INFO',
      nodeId: this.nodeId,
      port: this.port,
      state: this.state
    }));
  }

  async handleMessage(message, ws) {
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

  broadcast(message, excludeWs = null) {
    for (const peer of this.peers.values()) {
      if (peer.ws !== excludeWs && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify(message));
      }
    }
  }

  async connect(host, port) {
    return new Promise((resolve, reject) => {
      if (host === 'localhost' && port === this.port) {
        reject(new Error('Cannot connect to self'));
        return;
      }

      const ws = new WebSocket(`ws://${host}:${port}`);
      let nodeInfo = null;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        console.log(`Connected to ${host}:${port}`);
        this.handleConnection(ws, host);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'INFO') {
            nodeInfo = {
              nodeId: message.nodeId,
              host,
              port
            };
            clearTimeout(timeout);
            resolve(nodeInfo);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Failed to connect to ${host}:${port}:`, error.message);
        reject(error);
      });
    });
  }

  async updateState(key, value) {
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
  }

  async deleteState(key) {
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
  }

  getState() {
    return this.state;
  }
}

export default DecentralizedNode;