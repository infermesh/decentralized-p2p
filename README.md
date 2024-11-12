# InferMesh

> A self-propagating mesh network that exists in the void. No central servers. No central nodes. Pure decentralized intelligence. Access and manage your node state from anywhere using your private key.

InferMesh is a revolutionary approach to peer-to-peer networking where nodes weave themselves into an intelligent mesh, accessible anywhere using your private key. Like a living digital fabric, your InferMesh node persists without central hosting, weaving itself across the network.

## Why InferMesh?

- 🌐 True serverless P2P network
- 🔑 Private key-based authentication
- 🖥️ Interactive CLI
- 📡 Decentralized state management
- 🔄 Automatic peer discovery
- 💾 Persistent configuration
- 🌍 Public/Private network support
- 🔍 Built-in peer discovery

## Quick Start

```bash
# Clone the repository
git clone https://github.com/infermesh/decentralized-p2p.git
cd decentralized-p2p

# Install dependencies
npm install

# Start a new node
node cli.js init

# Dont' forget to save the node ID and port shown!
```

## Interactive Commands

Once connected, you'll get an interactive prompt with these commands:

```bash
infermesh> state
# Shows current state and data

infermesh> peers
# Lists connected peers

infermesh> discover
# Shows all available peers in the network

infermesh> update <key> <value>
# Updates state. Value can be text, number, or JSON
# Example: update name "John"
# Example: update config {"theme":"dark","mode":1}

infermesh> delete <key>
# Deletes a state entry

infermesh> connect <host> <port>
# Connects to a peer node

infermesh> info
# Shows node information including public IP

infermesh> exit
# Exits the program
```

## AWS / Public Network Usage

1. Start node on AWS:
```bash
node cli.js init
# Note the public IP and port shown
```

2. Connect from another machine:
```bash
node cli.js init
infermesh> connect <aws-public-ip> <port>
```

3. Use discovery:
```bash
infermesh> discover
# Shows all available peers including AWS nodes
```

Remember to:
- Configure AWS security group to allow inbound traffic on port range 3000-4000
- Use the public IP address when connecting from outside AWS

## State Management Examples

1. Basic text state:
```bash
infermesh> update username "john_doe"
infermesh> update email "john@example.com"
```

2. JSON configuration:
```bash
infermesh> update config {"theme":"dark","notifications":true}
infermesh> update preferences {"language":"en","timezone":"UTC"}
```

3. Array data:
```bash
infermesh> update tags ["important","urgent","todo"]
```

4. Check state:
```bash
infermesh> state
{
  "data": {
    "username": "john_doe",
    "email": "john@example.com",
    "config": {
      "theme": "dark",
      "notifications": true
    },
    "tags": ["important","urgent","todo"]
  },
  "version": 4,
  "timestamp": 1699825678554
}
```

## Network Architecture

- Every node is equal (no central server)
- State is replicated across all connected nodes
- Automatic public IP detection
- Persistent peer connections
- Automatic state synchronization

## Technical Details

### Storage
- Configuration stored in `~/.infermesh/config.json`
- Persistent private keys
- Remembered peer connections

### Network
- WebSocket-based communication
- Auto-detecting public/private network
- Port range: 3000-4000
- Automatic peer discovery

### State
- Version-controlled state updates
- Real-time state synchronization
- JSON data support
- Conflict resolution

## Security

- Private key-based node identification
- Secure state propagation
- Connection persistence
- AWS security group configuration required for public access

## Project Structure

```
infermesh/
├── src/
│   └── state-p2p-node.js   # Core node implementation
├── cli.js                  # CLI interface
└── package.json            # Project configuration
└── README.md               # This file 
```

## Development

```bash
# Clone the repository
git clone https://github.com/infermesh/decentralized-p2p.git

# Install dependencies
npm install

# Start a node
node cli.js init
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Notes

- This is experimental software - use at your own risk
- Always keep your private key secure
- For production use, implement additional security measures

## Support

For issues and feature requests, please [open an issue](https://github.com/infermesh/decentralized-p2p/issues)