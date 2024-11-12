#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { randomBytes } from 'crypto';
import EnhancedNode from './src/state-p2p-node.js';
import readline from 'readline';

const program = new Command();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'infermesh> '
});

function tryParseValue(value) {
  // First try to parse as JSON
  try {
    if (value.startsWith('{') || value.startsWith('[')) {
      return JSON.parse(value);
    }
  } catch (e) {
    // Not valid JSON, continue to other types
  }

  // Try to parse as number
  if (!isNaN(value)) {
    return Number(value);
  }

  // Handle boolean values
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'null') return null;

  // Return as string if no other type matches
  return value;
}

async function startInteractiveMode(node) {
  console.log(chalk.cyan('\nAvailable commands:'));
  console.log(chalk.yellow('  state') + ' - Show current state');
  console.log(chalk.yellow('  update <state_name> <value>') + ' - Update state (value can be text, number, or JSON)');
  console.log(chalk.yellow('  create <state_name> <value>') + ' - Same as update');
  console.log(chalk.yellow('  delete <state_name>') + ' - Delete a state entry');
  console.log(chalk.yellow('  exit') + ' - Exit the program');

  console.log(chalk.cyan('\nValue examples:'));
  console.log('  update name John           # Text value');
  console.log('  update age 25              # Number value');
  console.log('  update active true         # Boolean value');
  console.log('  update data {"x":1,"y":2}  # JSON object');
  console.log('  update list [1,2,3]        # JSON array\n');

  rl.prompt();

  rl.on('line', async (line) => {
    const args = line.trim().split(' ');
    const command = args[0].toLowerCase();

    try {
      switch (command) {
        case 'state':
          const state = await node.getState();
          console.log(chalk.cyan('Current State:'));
          console.log(JSON.stringify(state, null, 2));
          break;

        case 'update':
        case 'create':
          if (args.length < 3) {
            console.log(chalk.red(`Usage: ${command} <state_name> <value>`));
            console.log(chalk.yellow('Value can be:'));
            console.log('- Text: update name John');
            console.log('- Number: update age 25');
            console.log('- Boolean: update active true');
            console.log('- JSON: update data {"x":1,"y":2}');
            console.log('- Array: update list [1,2,3]');
            break;
          }
          const name = args[1];
          const value = tryParseValue(args.slice(2).join(' '));
          await node.updateState({ [name]: value });
          console.log(chalk.green(`Updated state: ${name} = ${JSON.stringify(value)}`));
          break;

        case 'delete':
          if (args.length < 2) {
            console.log(chalk.red('Usage: delete <state_name>'));
            break;
          }
          await node.deleteState(args[1]);
          console.log(chalk.green(`Deleted state entry: ${args[1]}`));
          break;

        case 'exit':
          console.log(chalk.yellow('Goodbye!'));
          process.exit(0);
          break;

        case '':
          break;

        default:
          console.log(chalk.red('Unknown command. Available commands: state, update, create, delete, exit'));
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
}

program
  .version('1.0.0')
  .description('InferMesh CLI');

program
  .command('init')
  .description('Initialize a new P2P node')
  .action(async () => {
    try {
      const privateKey = randomBytes(32).toString('hex');
      const node = new EnhancedNode(privateKey);
      await node.initialize();

      console.log(chalk.green('Node initialized successfully!'));
      console.log(chalk.yellow('Private Key (save this securely):'), privateKey);
      console.log(chalk.cyan('Node ID:'), node.nodeId);

      // Start interactive mode
      await startInteractiveMode(node);
    } catch (error) {
      console.error(chalk.red('Failed to initialize node:'), error);
      process.exit(1);
    }
  });

program
  .command('connect')
  .description('Connect to a specific node')
  .argument('<nodeId>', 'Target node ID')
  .option('-h, --host <host>', 'Target host', 'localhost')
  .action(async (nodeId, options) => {
    try {
      const node = new EnhancedNode(randomBytes(32).toString('hex'));
      await node.initialize();

      console.log(chalk.blue(`Connecting to node: ${nodeId}`));
      await node.connect(nodeId, options.host);

      console.log(chalk.green('Connected successfully!'));
      console.log(chalk.cyan('Local Node ID:'), node.nodeId);

      // Start interactive mode
      await startInteractiveMode(node);
    } catch (error) {
      console.error(chalk.red('Failed to connect:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);