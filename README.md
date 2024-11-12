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

## Network Architecture

- Every node is equal (no central server)
- State is replicated across all connected nodes
- Automatic public IP detection
- Persistent peer connections
- Automatic state synchronization

## Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/infermesh/decentralized-p2p/main/install.sh | bash
```

## Usage

```bash
# Initialize a new node
mesh init

# List known nodes
mesh ls

# Show node status
mesh status

# Interactive shell commands:
mesh> state                     # Show current state
mesh> ls                        # List connected peers
mesh> set <key> <value>         # Set state value (supports JSON)
mesh> get <key>                 # Get state value
mesh> del <key>                 # Delete state value
mesh> connect <nodeId>          # Connect to a node
mesh> status                    # Show node status
mesh> help                      # Show available commands
mesh> exit                      # Exit the shell
```

## Examples

1. Start first node:
```bash
mesh init
# Note the node ID and port shown
```

2. Start second node and connect:
```bash
mesh init
mesh> connect <nodeId>
```

3. Set and get state:
```bash
# Simple values
mesh> set name "John"
mesh> get name

# JSON values
mesh> set config {"theme":"dark","notifications":true}
mesh> set colors ["red","green","blue"]
```

## AWS / Public Network Usage

1. Start node on AWS:
```bash
mesh init
# Note the public IP and node ID
```

2. Connect from another machine:
```bash
mesh init
mesh> connect <nodeId>
```

Remember to:
- Configure AWS security group for ports 3000-4000
- Use public IP when connecting from outside

## Technical Information

### Storage
- Configuration stored in `~/.infermesh/config.json`
- Persistent private keys
- Remembered peer connections

### Network
- WebSocket-based communication
- Auto-detecting public/private network
- Port range: 3000-4000
- Automatic peer discovery

### State Persistence
- Recovered on restart
- Version-controlled state updates
- Real-time state synchronization between nodes
- JSON data support
- Conflict resolution

## Security

- Private key-based node identification
- Secure state propagation
- Connection persistence
- AWS security group configuration required for public access

## Project Structure

```
~/.infermesh/
├── nodes/        # Node registry
├── states/       # Persistent states
└── bin/          # Executables
```

## Security Notes

- Keep your private key secure
- States are synced across all connected nodes
- Use AWS security groups in production
- Consider network security in public deployments

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
