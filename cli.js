#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { randomBytes } from 'crypto';
import readline from 'readline';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import DecentralizedNode from './src/state-p2p-node.js';
import figlet from 'figlet';

const CONFIG_DIR = join(homedir(), '.infermesh');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Add this function for displaying the logo
function showLogo() {
  console.log(chalk.cyan(figlet.textSync('InferMesh', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  })));
}

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
      startShell(node);
    } catch (error) {
      console.error(chalk.red('Failed to initialize node:'), error);
      process.exit(1);
    }
  });

// Add help command
program
  .command('help')
  .description('Show help information')
  .action(() => {
    showLogo();
    console.log(chalk.cyan('\nUsage:'));
    console.log('  mesh [command] [options]');

    console.log(chalk.cyan('\nGlobal Commands:'));
    console.log(chalk.yellow('  init') + '              Initialize a new node');
    console.log(chalk.yellow('  ls') + '                List all known nodes');
    console.log(chalk.yellow('  status') + '            Show node status and connections');
    console.log(chalk.yellow('  help') + '              Show this help message');

    console.log(chalk.cyan('\nShell Commands (available after init):'));
    console.log(chalk.yellow('  state') + '             Show current state');
    console.log(chalk.yellow('  ls') + '                List connected peers');
    console.log(chalk.yellow('  set <key> <value>') + ' Set state value (supports JSON)');
    console.log(chalk.yellow('  get <key>') + '         Get state value');
    console.log(chalk.yellow('  del <key>') + '         Delete state value');
    console.log(chalk.yellow('  connect <nodeId>') + '  Connect to a node');
    console.log(chalk.yellow('  status') + '            Show node status');
    console.log(chalk.yellow('  exit') + '              Exit the shell');

    console.log(chalk.cyan('\nExamples:'));
    console.log('  # Start a new node');
    console.log('  $ mesh init');
    console.log('\n  # Check node status');
    console.log('  $ mesh status');
    console.log('\n  # In shell, set a value');
    console.log('  mesh> set name "John"');
    console.log('\n  # In shell, set JSON value');
    console.log('  mesh> set config {"theme":"dark","enabled":true}');
    console.log('\n  # In shell, connect to another node');
    console.log('  mesh> connect abc123...');

    console.log(chalk.cyan('\nConfiguration:'));
    console.log(`  Config directory: ${CONFIG_DIR}`);
    console.log('  State persistence: Enabled');
    console.log('  Auto-discovery: Enabled');
    console.log('  Port range: 3000-4000');

    process.exit(0);
  });

program
  .command('ls')
  .description('List all known nodes')
  .action(async () => {
    try {
      const config = await loadConfig();
      if (!config.privateKey) {
        console.error(chalk.red('No node initialized. Run "mesh init" first.'));
        process.exit(1);
      }
      const node = new DecentralizedNode(config.privateKey);
      const nodes = await node.discoverNodes();

      if (nodes.length > 0) {
        console.log(chalk.cyan('\nKnown Nodes:'));
        nodes.forEach(nodeInfo => {
          console.log(chalk.yellow(`\nNode ${nodeInfo.nodeId.slice(0, 8)}...`));
          console.log(`Host: ${nodeInfo.host}`);
          console.log(`Port: ${nodeInfo.port}`);
          console.log(`Last Seen: ${new Date(nodeInfo.lastSeen).toLocaleString()}`);
        });
      } else {
        console.log(chalk.yellow('No nodes discovered.'));
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show node status and connections')
  .action(async () => {
    try {
      const config = await loadConfig();
      if (!config.privateKey) {
        console.error(chalk.red('No node initialized. Run "mesh init" first.'));
        process.exit(1);
      }
      const node = new DecentralizedNode(config.privateKey);
      console.log(chalk.cyan('\nNode Information:'));
      console.log(`ID: ${node.nodeId}`);
      if (node.publicIp) {
        console.log(`Public IP: ${node.publicIp}`);
      }
      console.log(`Connected Peers: ${node.peers.size}`);
      console.log(`State Version: ${node.state.version}`);
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

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

function startShell(node) {
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
      const nodes = await node.discoverNodes();

      switch (cmd) {
        case 'state':
          console.log(JSON.stringify(node.getState(), null, 2));
          break;

        case 'ls':
          nodes.forEach(n => {
            console.log(chalk.yellow(`\nNode ${n.nodeId.slice(0, 8)}...`));
            console.log(`Host: ${n.host}`);
            console.log(`Port: ${n.port}`);
          });
          break;

        case 'set':
          if (args.length < 3) {
            console.log(chalk.red('Usage: set <key> <value>'));
            break;
          }
          const value = args.slice(2).join(' ');
          try {
            await node.updateState(args[1], JSON.parse(value));
          } catch {
            await node.updateState(args[1], value);
          }
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
            console.log(chalk.red('Usage: connect <nodeId>'));
            break;
          }

          const targetNode = nodes.find(n => n.nodeId.startsWith(args[1]));
          if (targetNode) {
            await node.connect(targetNode.host, targetNode.port);
            console.log(chalk.green('Connected successfully'));
          } else {
            console.log(chalk.red('Node not found'));
          }
          break;

        case 'status':
          console.log(chalk.cyan('\nNode Status:'));
          console.log(`ID: ${node.nodeId}`);
          if (node.publicIp) console.log(`Public IP: ${node.publicIp}`);
          console.log(`Connected Peers: ${node.peers.size}`);
          console.log(`State Version: ${node.state.version}`);
          break;

        case 'exit':
          console.log(chalk.yellow('Goodbye!'));
          process.exit(0);
          break;

        case 'help':
          showShellHelp();
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
}

program.parse();