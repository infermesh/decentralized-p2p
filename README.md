# InferMesh

> A self-propagating mesh network that exists in the void. No central servers. No central nodes. Pure decentralized intelligence. Access and manage your node state from anywhere using your private key.

InferMesh is a revolutionary approach to peer-to-peer networking where nodes weave themselves into an intelligent mesh, accessible anywhere using your private key. Like a living digital fabric, your InferMesh node persists without central hosting, weaving itself across the network.

## Why InferMesh?

- 🌐 True serverless architecture
- 🧬 Self-propagating nodes
- 🔑 Private key-based authentication
- 📡 Decentralized state management
- 🔄 Automatic replication
- 💾 Persistent state
- 🖥️ Interactive CLI

## Quick Start

```bash
# Clone the repository
git clone https://github.com/infermesh/decentralized-p2p.git
cd decentralized-p2p

# Install dependencies
npm install

# Start a new node
node cli.js init
# Save the node ID shown - you'll need it to connect!

# In another terminal, connect to the node
node cli.js connect <nodeId>
```

## Interactive Commands

Once connected, you'll get an interactive prompt with these commands:

```bash
infermesh> state
# Shows current node state and connections

infermesh> update <state_name> <value>
# Updates state with the given value
# Value can be text, number, JSON object, or array

infermesh> create <state_name> <value>
# Same as update, creates or updates a state value

infermesh> delete <state_name>
# Deletes a state entry

infermesh> exit
# Exits the program
```

### Value Types Examples

```bash
# Text values
infermesh> update name John
Updated state: name = "John"

# Number values
infermesh> update age 25
Updated state: age = 25

# Boolean values
infermesh> update active true
Updated state: active = true

# JSON objects
infermesh> update config {"theme":"dark","fontSize":14}
Updated state: config = {"theme":"dark","fontSize":14}

# Arrays
infermesh> update tags ["nodejs","p2p","mesh"]
Updated state: tags = ["nodejs","p2p","mesh"]

# Nested structures
infermesh> update user {"name":"John","preferences":{"theme":"dark"}}
Updated state: user = {"name":"John","preferences":{"theme":"dark"}}
```

### Example State Output

```bash
infermesh> state
{
  "nodeId": "9f8a2d1....",
  "port": 3025,
  "connections": [],
  "replicas": [3100, 3101],
  "data": {
    "name": "John",
    "age": 25,
    "active": true,
    "config": {
      "theme": "dark",
      "fontSize": 14
    },
    "tags": ["nodejs", "p2p", "mesh"],
    "user": {
      "name": "John",
      "preferences": {
        "theme": "dark"
      }
    }
  }
}
```

All values are automatically synchronized across connected nodes and replicas. The system automatically detects and preserves the value type (string, number, boolean, object, or array).

## Technical Details

### Port Usage
- Main nodes: 3000-3099
- Replicas: 3100-3999
- Automatic port selection within ranges

### Network Architecture
```
Main Node (e.g., :3000)
    │
    ├── Replica 1 (e.g., :3100)
    │
    └── Replica 2 (e.g., :3101)
```

### State Synchronization
- Real-time state sync across all replicas
- Automatic state persistence
- State recovery on node restart

### Node Discovery
- Automatic port scanning
- Multi-replica support
- Resilient connections

## Project Structure

```
infermesh/
├── src/
│   └── state-p2p-node.js   # Core node implementation
├── cli.js                  # CLI interface
└── package.json           # Project configuration
```

## Example Usage

1. Start First Node:
```bash
$ node cli.js init
Node initialized successfully!
Private Key: 3a7bd3e....
Node ID: 9f8a2d1....
Main service running on port: 3025

infermesh> state
Current State:
{
  "nodeId": "9f8a2d1....",
  "port": 3025,
  "timestamp": 1699825678554,
  "connections": [],
  "replicas": [3100, 3101],
  "data": {}
}
```

2. Connect From Another Terminal:
```bash
$ node cli.js connect 9f8a2d1....
Connected successfully!
Local Node ID: 7e3f5d2....

infermesh> create myKey Hello World
Created state entry: myKey = Hello World

infermesh> state
Current State:
{
  "nodeId": "7e3f5d2....",
  "port": 3030,
  "timestamp": 1699825689012,
  "connections": ["9f8a2d1...."],
  "replicas": [3102, 3103],
  "data": {
    "myKey": "Hello World",
    "lastUpdated": 1699825689012
  }
}
```

## Key Features Explained

1. **Self-Propagation**
   - Nodes automatically create replicas
   - Network survives original node shutdown
   - Automatic state synchronization

2. **State Management**
   - Real-time state updates
   - Cross-node synchronization
   - Persistent storage

3. **Resilience**
   - Automatic port conflict resolution
   - Multiple replica support
   - Connection retry logic

4. **Security**
   - Private key authentication
   - Secure state transmission
   - Node verification

## Future Enhancements

- [ ] Web interface
- [ ] Enhanced state validation
- [ ] Custom replication strategies
- [ ] Advanced node discovery
- [ ] State conflict resolution
- [ ] Network visualization
- [ ] Access control lists
- [ ] End-to-end encryption

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Security Notes

- Keep your private key secure
- Don't expose nodes directly to the internet without proper security measures
- Consider implementing additional authentication for production use
- This is experimental software - use at your own risk

## Support

For issues and feature requests, please [open an issue](https://github.com/infermesh/decentralized-p2p/issues).