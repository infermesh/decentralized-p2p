#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { randomBytes } from 'crypto';
import readline from 'readline';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import DecentralizedNode from './src/state-p2p-node.js';

const CONFIG_DIR = join(homedir(), '.infermesh');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function loadConfig() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { peers: [], privateKey: null };
  }
}

async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function tryParseValue(valueStr) {
  try {
    return JSON.parse(valueStr);
  } catch {
    return valueStr;
  }
}

async function createInteractiveCLI(node) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'infermesh> '
  });

  console.log(chalk.cyan('\nAvailable commands:'));
  console.log(chalk.yellow('  state') + ' - Show current state');
  console.log(chalk.yellow('  peers') + ' - List connected peers');
  console.log(chalk.yellow('  discover') + ' - Discover available peers');
  console.log(chalk.yellow('  update <key> <value>') + ' - Update state (value can be text, number, or JSON)');
  console.log(chalk.yellow('  delete <key>') + ' - Delete state entry');
  console.log(chalk.yellow('  connect <host> <port>') + ' - Connect to a peer');
  console.log(chalk.yellow('  info') + ' - Show node info');
  console.log(chalk.yellow('  exit') + ' - Exit\n');

  rl.prompt();

  rl.on('line', async (line) => {
    const args = line.trim().split(' ');
    const command = args[0].toLowerCase();

    try {
      switch (command) {
        case 'state':
          const state = node.getState();
          console.log(chalk.cyan('Current State:'));
          console.log(JSON.stringify(state, null, 2));
          break;

        case 'peers':
          console.log(chalk.cyan('Connected Peers:'));
          node.peers.forEach((peer, nodeId) => {
            console.log(`${nodeId} (port: ${peer.port})`);
          });
          break;

        case 'discover':
          console.log(chalk.cyan('Discovering peers...'));
          const peers = await node.discoverPeers();
          if (peers.length > 0) {
            peers.forEach(peer => {
              if (peer.isSelf) {
                console.log(chalk.blue(`\nThis Node (${peer.nodeId}):`));
              } else {
                console.log(chalk.yellow(`\nPeer (${peer.nodeId}):`));
              }
              console.log(`Host: ${peer.host}`);
              console.log(`Port: ${peer.port}`);
            });
          } else {
            console.log(chalk.yellow('No peers discovered.'));
          }
          break;

        case 'update':
          if (args.length < 3) {
            console.log(chalk.red('Usage: update <key> <value>'));
            break;
          }
          const key = args[1];
          const value = tryParseValue(args.slice(2).join(' '));
          await node.updateState(key, value);
          console.log(chalk.green(`Updated state: ${key} = ${JSON.stringify(value)}`));
          break;

        case 'delete':
          if (args.length < 2) {
            console.log(chalk.red('Usage: delete <key>'));
            break;
          }
          await node.deleteState(args[1]);
          console.log(chalk.green(`Deleted state entry: ${args[1]}`));
          break;

        case 'connect':
          if (args.length < 3) {
            console.log(chalk.red('Usage: connect <host> <port>'));
            break;
          }
          const host = args[1];
          const port = parseInt(args[2]);

          try {
            await node.connect(host, port);
            console.log(chalk.green(`Connected to peer ${host}:${port}`));

            const config = await loadConfig();
            if (!config.peers.some(p => p.host === host && p.port === port)) {
              config.peers.push({ host, port });
              await saveConfig(config);
            }
          } catch (error) {
            console.error(chalk.red(`Failed to connect: ${error.message}`));
          }
          break;

        case 'info':
          console.log(chalk.cyan('Node Information:'));
          console.log(`Node ID: ${node.nodeId}`);
          console.log(`Port: ${node.port}`);
          if (node.publicIp) {
            console.log(`Public IP: ${node.publicIp}`);
          }
          console.log(`Connected Peers: ${node.peers.size}`);
          console.log(`State Version: ${node.state.version}`);
          console.log(`Last Updated: ${new Date(node.state.timestamp).toLocaleString()}`);
          break;

        case 'exit':
          console.log(chalk.yellow('Goodbye!'));
          process.exit(0);
          break;

        case '':
          break;

        default:
          console.log(chalk.red('Unknown command. Type any key to see available commands'));
          break;
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }

    rl.prompt();
  }).on('close', () => {
    console.log(chalk.yellow('Goodbye!'));
    process.exit(0);
  });

  node.on('stateUpdated', (state) => {
    console.log(chalk.green('\nState updated:'));
    console.log(JSON.stringify(state.data, null, 2));
    rl.prompt();
  });
}

const program = new Command();

program
  .version('1.0.0')
  .description('InferMesh CLI');

program
  .command('init')
  .description('Initialize a new P2P node')
  .action(async () => {
    try {
      let config = await loadConfig();

      if (!config.privateKey) {
        config.privateKey = randomBytes(32).toString('hex');
        await saveConfig(config);
      }

      const node = new DecentralizedNode(config.privateKey);
      await node.initialize();

      console.log(chalk.green('Node initialized successfully!'));
      console.log(chalk.cyan('Node ID:'), node.nodeId);
      console.log(chalk.cyan('Port:'), node.port);
      console.log(chalk.yellow('Private Key:'), config.privateKey);

      for (const peer of config.peers) {
        try {
          await node.connect(peer.host, peer.port);
          console.log(chalk.green(`Connected to peer ${peer.host}:${peer.port}`));
        } catch (error) {
          console.log(chalk.yellow(`Failed to connect to ${peer.host}:${peer.port}`));
        }
      }

      await createInteractiveCLI(node);
    } catch (error) {
      console.error(chalk.red('Failed to initialize node:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);