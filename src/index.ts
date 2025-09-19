#!/usr/bin/env node

import inquirer from 'inquirer';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { handleRevert } from './action/revert';
import { handleApply } from './action/apply';
import { handleVerify } from './action/verify';
import { handleDbShow } from './action/db';
import { closeDatabase } from './infrastructure/database';

interface Args {
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