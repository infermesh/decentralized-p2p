import { WebSocketServer, WebSocket } from 'ws';
import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import https from 'https';

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

  async initialize() {
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

    this.server.on('connection', (ws, req) => {
      const remoteAddress = req.socket.remoteAddress;
      console.log(`Incoming connection from ${remoteAddress}`);
      this.handleConnection(ws, remoteAddress);
    });

    return true;
  }

  async discoverPeers() {
    const peers = [];

    // Add self if public IP is available
    if (this.publicIp) {
      peers.push({
        nodeId: this.nodeId,
        host: this.publicIp,
        port: this.port,
        isSelf: true
      });
    }

    // Add connected peers
    for (const [nodeId, peer] of this.peers.entries()) {
      peers.push({
        nodeId,
        host: peer.host || 'unknown',
        port: peer.port,
        isSelf: false
      });
    }

    return peers;
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
          this.broadcast(message, ws);
          this.emit('stateUpdated', this.state);
        }
        break;

      case 'DELETE_STATE':
        if (message.version > this.state.version) {
          delete this.state.data[message.key];
          this.state.version = message.version;
          this.state.timestamp = Date.now();
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
      const ws = new WebSocket(`ws://${host}:${port}`);

      ws.on('open', () => {
        console.log(`Connected to peer ${host}:${port}`);
        this.handleConnection(ws, host);
        resolve(true);
      });

      ws.on('error', (error) => {
        console.error(`Failed to connect to ${host}:${port}:`, error.message);
        reject(error);
      });
    });
  }

  async updateState(key, value) {
    this.state.version++;
    this.state.data[key] = value;
    this.state.timestamp = Date.now();

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