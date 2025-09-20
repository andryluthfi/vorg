#!/usr/bin/env node

import inquirer from 'inquirer';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { handleRevert } from './action/revert';
import { handleApply } from './action/apply';
import { handleVerify } from './action/verify';
import { handleDbShow } from './action/db';
import { closeDatabase } from './infrastructure/database';

interface Args extends Record<string, unknown> {
  _: string[];
  scanPath?: string;
  'scan-path'?: string;
  'movie-path'?: string;
  'tv-path'?: string;
  interactive?: boolean;
  'no-save-config'?: boolean;
  noSaveConfig?: boolean;
  count?: number;
  verbose?: boolean;
  'verify-target'?: boolean;
}

const argv = yargs(hideBin(process.argv))
  .command('revert', 'Revert recent file moves', (yargs) => {
    return yargs.option('count', {
      alias: 'c',
      type: 'number',
      describe: 'Number of moves to revert',
      default: undefined
    });
  })
  .command('db', 'Database operations', (yargs) => {
    return yargs.command('show', 'Show database contents as table', () => {});
  })
  .command('$0', 'Scan and organize media files', (yargs) => {
    return yargs
      .positional('scanPath', {
        describe: 'Path to scan for media files',
        type: 'string'
      })
      .option('scan-path', {
        alias: 's',
        type: 'string',
        describe: 'Path to scan for media files'
      })
      .option('movie-path', {
        alias: 'm',
        type: 'string',
        describe: 'Destination folder for movies'
      })
      .option('tv-path', {
        alias: 't',
        type: 'string',
        describe: 'Destination folder for TV shows'
      })
      .option('interactive', {
        alias: 'i',
        type: 'boolean',
        describe: 'Enable interactive mode to prompt for missing inputs',
        default: false
      })
      .option('no-save-config', {
        type: 'boolean',
        describe: 'Do not save configuration to disk',
        default: false
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        describe: 'Show detailed config information and final merged config',
        default: false
      })
      .option('verify-target', {
        type: 'boolean',
        describe: 'Verify and fix misplaced TV shows in movie folders and vice versa',
        default: false
      });
  })
  .help()
  .argv as Args;


/**
 * Main entry point for the Media Auto Renamer CLI application.
 * Processes command line arguments, validates inputs, and dispatches to appropriate command handlers.
 * Supports commands: apply (default), revert, db show, verify.
 *
 * The function handles different CLI commands by checking argv._[0]:
 * - 'revert': Calls handleRevert with optional count
 * - 'db show': Calls handleDbShow
 * - 'verify': Calls handleVerify with scan path
 * - Default: Calls handleApply with scan path
 *
 * @async
 * @function main
 * @returns {Promise<void>} Resolves when the application completes successfully
 * @throws {Error} If scan path validation fails or command handlers throw errors
 *
 * @example
 * // Run default apply command on current directory
 * node dist/index.js
 *
 * @example
 * // Run apply command on specific path
 * node dist/index.js /path/to/media
 *
 * @example
 * // Revert last 3 moves
 * node dist/index.js revert --count 3
 *
 * @example
 * // Show database contents
 * node dist/index.js db show
 *
 * @example
 * // Verify files with interactive mode
 * node dist/index.js /path/to/media --verify-target --interactive
 *
 * @example
 * // Edge case: No scan path provided, uses current directory
 * node dist/index.js
 *
 * @example
 * // Edge case: Invalid command, falls back to apply
 * node dist/index.js invalid-command /path/to/media
 */
async function main() {
  // Handle commands
  if (argv._[0] === 'revert') {
    await handleRevert(argv.count as number);
    return;
  }

  if (argv._[0] === 'db' && argv._[1] === 'show') {
    await handleDbShow();
    return;
  }

  // Default apply command
  let scanPath = argv.scanPath || argv['scan-path'];

  // Fallback to positional argument if not set
  if (!scanPath && argv._[0]) {
    scanPath = argv._[0];
  }

  if (!scanPath) {
    if (argv.interactive) {
      const { inputScanPath } = await inquirer.prompt({
        type: 'input',
        name: 'inputScanPath',
        message: 'Enter the folder path to scan for media files:',
        default: process.cwd()
      });
      scanPath = inputScanPath;
    } else {
      // Use current working directory as default
      scanPath = process.cwd();
    }
  }

  if (argv['verify-target']) {
    await handleVerify(scanPath!, argv);
  } else {
    await handleApply(scanPath!, argv);
  }
}


// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  closeDatabase();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  closeDatabase();
  process.exit(1);
});

main().catch((error) => {
  console.error('Error:', error);
  closeDatabase();
  process.exit(1);
});