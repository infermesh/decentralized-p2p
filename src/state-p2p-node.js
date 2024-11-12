// src/state-p2p-node.js
import { WebSocketServer, WebSocket } from 'ws';
import { createHash, randomBytes } from 'crypto';
import net from 'net';

class ReplicationStrategy {
  constructor(node) {
    this.node = node;
    this.replicas = new Map();
    this.replicaServers = new Map();
    this.portRange = {
      start: 3000,
      end: 8999
    };
    this.state = {};
  }

  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });
  }

  async findAvailablePort(startPort) {
    const endPort = this.portRange.end;
    for (let port = startPort; port <= endPort; port++) {
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        return port;
      }
    }
    return null;
  }

  async replicateLocal(count = 2) {
    console.log('Starting local replication...');
    let replicasCreated = 0;
    let basePort = this.portRange.start + 100; // Start replicas from 3100

    while (replicasCreated < count) {
      try {
        const port = await this.findAvailablePort(basePort);
        if (!port) {
          console.log('No more ports available for replicas');
          break;
        }

        const replicaServer = new WebSocketServer({ port });
        this.replicaServers.set(port, replicaServer);

        replicaServer.on('connection', (ws) => {
          console.log(`Replica on port ${port} received connection`);
          this.handleReplicaConnection(ws, port);
        });

        console.log(`Created replica server on port ${port}`);
        replicasCreated++;
        basePort = port + 1;
      } catch (error) {
        console.error(`Failed to create replica on port ${basePort}:`, error.message);
        basePort++;
      }
    }

    return replicasCreated;
  }

  handleReplicaConnection(ws, port) {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'CONNECT') {
          ws.send(JSON.stringify({
            type: 'CONNECT_ACK',
            nodeId: this.node.nodeId,
            port: port
          }));
        }
      } catch (error) {
        console.error('Error handling replica connection:', error);
      }
    });
  }
}

class EnhancedNode {
  constructor(privateKey) {
    this.privateKey = privateKey;
    this.nodeId = this.generateNodeId();
    this.peers = new Map();
    this.connections = new Map();
    this.port = null;
    this.replicationStrategy = new ReplicationStrategy(this);
    this.portRange = {
      start: 3000,
      end: 3999
    };
  }

  generateNodeId() {
    return createHash('sha256')
      .update(this.privateKey)
      .digest('hex');
  }

  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });
  }

  async findAvailablePort() {
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        return port;
      }
    }
    throw new Error(`No available ports found between ${this.portRange.start} and ${this.portRange.end}`);
  }

  async initialize() {
    try {
      // Find available port for main server
      this.port = await this.findAvailablePort();
      console.log(`Found available port: ${this.port}`);

      // Start main server
      this.server = new WebSocketServer({ port: this.port });
      console.log(`Main node server started on port ${this.port}`);

      this.server.on('connection', this.handleConnection.bind(this));
      this.server.on('error', (error) => {
        console.error('Main server error:', error);
      });

      // Initialize replicas
      const replicasCreated = await this.replicationStrategy.replicateLocal(2);
      console.log(`Created ${replicasCreated} replicas`);

      console.log(`Node initialized with ID: ${this.nodeId}`);
      console.log(`Main service running on port: ${this.port}`);

      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      throw error;
    }
  }

  handleConnection(ws) {
    console.log('New connection received on main server');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message);

        if (message.type === 'CONNECT') {
          this.connections.set(message.nodeId, ws);
          ws.send(JSON.stringify({
            type: 'CONNECT_ACK',
            nodeId: this.nodeId,
            port: this.port
          }));
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('Connection error:', error);
    });
  }

  async connect(targetNodeId, host = 'localhost') {
    console.log(`Attempting to connect to ${targetNodeId} at ${host}`);

    // Try main server ports first
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      try {
        console.log(`Trying port ${port}...`);
        const connected = await this.tryConnect(targetNodeId, host, port);
        if (connected) {
          console.log(`Successfully connected on port ${port}`);
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('Could not connect to target node on any available port');
  }

  async tryConnect(targetNodeId, host, port) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${host}:${port}`);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 1000); // Reduced timeout for faster scanning

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`Connected to ${host}:${port}`);
        ws.send(JSON.stringify({
          type: 'CONNECT',
          nodeId: this.nodeId,
          auth: this.privateKey
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'CONNECT_ACK') {
            this.connections.set(targetNodeId, ws);
            resolve(true);
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        reject(new Error(`Connection failed on port ${port}`));
      });
    });
  }

  async updateState(update) {
    this.state = {
      ...this.state,
      ...update,
      lastUpdated: Date.now()
    };

    // Broadcast state update to all connections
    const updateMessage = JSON.stringify({
      type: 'STATE_UPDATE',
      data: this.state
    });

    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(updateMessage);
      }
    }

    // Update replicas
    for (const server of this.replicationStrategy.replicaServers.values()) {
      server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(updateMessage);
        }
      });
    }

    return this.state;
  }

  async deleteState(key) {
    if (key in this.state) {
      delete this.state[key];
      await this.updateState({}); // Trigger update to sync
      return true;
    }
    return false;
  }

  async getState() {
    return {
      nodeId: this.nodeId,
      port: this.port,
      timestamp: Date.now(),
      connections: Array.from(this.connections.keys()),
      replicas: Array.from(this.replicationStrategy.replicaServers.keys()),
      data: this.state
    };
  }

}

export default EnhancedNode;