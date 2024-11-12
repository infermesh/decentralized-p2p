#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { randomBytes } from 'crypto';
import readline from 'readline';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import DecentralizedNode from './state-p2p-node.js';
import figlet from 'figlet';

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

function showLogo() {
  console.log(chalk.cyan(figlet.textSync('InferMesh', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  })));
}

function showShellHelp() {
  console.log(chalk.cyan('\nAvailable Commands:'));
  console.log(chalk.yellow('  state') + '             Show current state');
  console.log(chalk.yellow('  ls') + '                List connected peers');
  console.log(chalk.yellow('  set <key> <value>') + ' Set state value (supports JSON)');
  console.log(chalk.yellow('  get <key>') + '         Get state value');
  console.log(chalk.yellow('  del <key>') + '         Delete state value');
  console.log(chalk.yellow('  connect <nodeId>') + '  Connect to a node');
  console.log(chalk.yellow('  status') + '            Show node status');
  console.log(chalk.yellow('  help') + '              Show this help message');
  console.log(chalk.yellow('  exit') + '              Exit the shell');
  console.log();
}

function tryParseValue(valueStr) {
  try {
    return JSON.parse(valueStr);
  } catch {
    return valueStr;
  }
}

async function createInteractiveCLI(node) {
  showLogo();
  showShellHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue('mesh> ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const args = line.trim().split(' ');
    const cmd = args[0].toLowerCase();

    try {
      switch (cmd) {
        case 'state':
          console.log(JSON.stringify(node.getState(), null, 2));
          break;

        case 'ls':
          const nodes = await node.discoverNodes();
          if (nodes.length > 0) {
            nodes.forEach(n => {
              if (n.isSelf) {
                console.log(chalk.blue('\nThis Node'));
              } else if (n.isConnected) {
                console.log(chalk.green('\nConnected Node'));
              } else {
                console.log(chalk.yellow('\nDiscovered Node'));
              }
              console.log(`ID: ${n.nodeId}`);
              console.log(`Host: ${n.host}`);
              console.log(`Port: ${n.port}`);
            });
          } else {
            console.log(chalk.yellow('No nodes discovered.'));
          }
          break;

        case 'set':
          if (args.length < 3) {
            console.log(chalk.red('Usage: set <key> <value>'));
            break;
          }
          const value = tryParseValue(args.slice(2).join(' '));
          await node.updateState(args[1], value);
          console.log(chalk.green('State updated'));
          break;

        case 'get':
          if (args.length < 2) {
            console.log(chalk.red('Usage: get <key>'));
            break;
          }
          const state = node.getState();
          console.log(state.data[args[1]] || 'null');
          break;

        case 'del':
          if (args.length < 2) {
            console.log(chalk.red('Usage: del <key>'));
            break;
          }
          await node.deleteState(args[1]);
          console.log(chalk.green('State deleted'));
          break;

        case 'connect':
          if (args.length < 2) {
            console.log(chalk.red('Usage:'));
            console.log('  connect <nodeId>     - Connect using node ID');
            console.log('  connect <host> <port> - Connect using host and port');
            break;
          }

          try {
            if (args.length === 2) {
              const targetId = args[1];
              const nodes = await node.discoverNodes();
              console.log(chalk.blue('Searching for node...'));

              const targetNode = nodes.find(n =>
                n.nodeId === targetId ||
                n.nodeId.startsWith(targetId) ||
                n.nodeId.includes(targetId)
              );

              if (targetNode) {
                console.log(chalk.blue(`Found node ${targetNode.nodeId}`));
                console.log(chalk.blue(`Connecting to ${targetNode.host}:${targetNode.port}`));
                await node.connect(targetNode.host, targetNode.port);
                console.log(chalk.green('Connected successfully!'));
              } else {
                console.log(chalk.red('Node not found in the network'));
                console.log('Available nodes:');
                for (const n of nodes) {
                  if (n.nodeId !== node.nodeId) {
                    console.log(chalk.yellow(`${n.nodeId}`));
                    console.log(`  Host: ${n.host}`);
                    console.log(`  Port: ${n.port}`);
                  }
                }
              }
            } else {
              const host = args[1];
              const port = parseInt(args[2]);
              await node.connect(host, port);
              console.log(chalk.green(`Connected to ${host}:${port}`));
            }
          } catch (error) {
            console.error(chalk.red('Connection failed:'), error.message);
          }
          break;

        case 'status':
          console.log(chalk.cyan('\nNode Status:'));
          console.log(`ID: ${node.nodeId}`);
          if (node.publicIp) console.log(`Public IP: ${node.publicIp}`);
          console.log(`Connected Peers: ${node.peers.size}`);
          console.log(`State Version: ${node.state.version}`);
          break;

        case 'help':
          showShellHelp();
          break;

        case 'exit':
          console.log(chalk.yellow('Goodbye!'));
          process.exit(0);
          break;

        case '':
          break;

        default:
          console.log(chalk.red('Unknown command. Type "help" to see available commands'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }

    rl.prompt();
  });

  node.on('stateUpdated', (state) => {
    console.log(chalk.green('\nState updated:'));
    console.log(JSON.stringify(state.data, null, 2));
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.yellow('Goodbye!'));
    process.exit(0);
  });
}

const program = new Command();

program
  .name('mesh')
  .description('InferMesh - Decentralized State Management')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new node')
  .action(async () => {
    try {
      let config = await loadConfig();

      if (!config.privateKey) {
        config.privateKey = randomBytes(32).toString('hex');
        await saveConfig(config);
      }

      const node = new DecentralizedNode(config.privateKey);
      await node.initialize();
      await createInteractiveCLI(node);
    } catch (error) {
      console.error(chalk.red('Failed to initialize node:'), error);
      process.exit(1);
    }
  });

program.parse();