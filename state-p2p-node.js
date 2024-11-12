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

  async handleMessage(message, ws) {
    try {
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
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  broadcast(message, excludeWs = null) {
    for (const peer of this.peers.values()) {
      if (peer.ws !== excludeWs && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify(message));
      }
    }
  }
}

export default DecentralizedNode;
