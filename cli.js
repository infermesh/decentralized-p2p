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
  .command('set')
  .description('Set a state value')
  .argument('<key>', 'State key')
  .argument('<value>', 'State value')
  .action(async (key, value) => {
    try {
      const config = await loadConfig();
      const node = new DecentralizedNode(config.privateKey);
      const parsedValue = JSON.parse(value);
      await node.updateState(key, parsedValue);
      console.log(chalk.green('State updated'));
    } catch (error) {
      console.error(chalk.red('Invalid JSON format or error setting state:'), error);
    }
  });

program.parse();
