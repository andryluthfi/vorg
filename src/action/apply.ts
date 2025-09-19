import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs-extra';
import { loadConfig, saveConfig, AppConfig } from '../config/config';
import { scanMediaFiles, MediaFile } from '../core-data/scanner';
import { parseFilename, MediaMetadata, EnrichedMetadata } from '../core-data/parser';
import { enrichMetadata, validateApiKey } from '../infrastructure/api';
import { organizeFiles, ProcessedFile } from '../business-logic/organizer';
import { closeDatabase } from '../infrastructure/database';

function displayPreview(results: ProcessedFile[], moviePath: string, tvPath: string) {
  console.log('Proposed folder structure with changes:');

  const basePaths = { movie: moviePath, tv: tvPath };

  for (const [type, basePath] of Object.entries(basePaths)) {
    console.log(`${type === 'movie' ? '🎥' : '📺'} ${type.toUpperCase()}: ${basePath}`);
    const typeResults = results.filter(r => r.metadata.type === type);

    if (typeResults.length === 0) {
      console.log('  (no files)');
      continue;
    }

    // Build hierarchical structure
    const root: any = {};

    for (const result of typeResults) {
      const fullPath = path.dirname(result.newPath);
      const relativePath = path.relative(basePath, fullPath);
      const pathParts = relativePath.split(path.sep);
      const oldName = path.basename(result.originalPath);
      const newName = path.basename(result.newPath);

      let current = root;
      for (const part of pathParts) {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      if (!current._files) {
        current._files = [];
      }
      current._files.push({ oldName, newName });
    }

    // Display hierarchical structure
    function displayNode(node: any, indent: string = '  ') {
      for (const [key, value] of Object.entries(node)) {
        if (key === '_files') {
          const files = value as { oldName: string; newName: string }[];
          if (files.length === 1) {
            console.log(`${indent}📄 ${files[0].oldName} ⮞ \x1b[32m${files[0].newName}\x1b[0m`);
          } else if (files.length > 1) {
            console.log(`${indent}📄 Multiple files:`);

            // Calculate max lengths for proper alignment
            const maxOldLength = Math.max(...files.map(f => f.oldName.length));
            const maxNewLength = Math.max(...files.map(f => f.newName.length));

            // Create table borders
            const header = `${indent}  ┌─${'─'.repeat(maxOldLength)}─┬─${'─'.repeat(maxNewLength)}─┐`;
            const separator = `${indent}  ├─${'─'.repeat(maxOldLength)}─┼─${'─'.repeat(maxNewLength)}─┤`;
            const footer = `${indent}  └─${'─'.repeat(maxOldLength)}─┴─${'─'.repeat(maxNewLength)}─┘`;

            console.log(header);
            console.log(`${indent}  │ ${'Old Name'.padEnd(maxOldLength)} │ ${'New Name'.padEnd(maxNewLength)} │`);
            console.log(separator);

            // Display each file with right-padded old names
            for (const file of files) {
              const paddedOldName = file.oldName.padEnd(maxOldLength);
              const paddedNewName = file.newName.padEnd(maxNewLength);
              console.log(`${indent}  │ ${paddedOldName} │ \x1b[32m${paddedNewName}\x1b[0m │`);
            }

            console.log(footer);
          }
        } else {
          console.log(`${indent}\x1b[32m📁 ${key}\x1b[0m`);
          displayNode(value as any, indent + '  ');
        }
      }
    }

    displayNode(root);
    console.log();
  }
}

function createProgressBar(total: number) {
  let current = 0;
  return {
    update: () => {
      current++;
      const percentage = Math.round((current / total) * 100);
      process.stdout.write(`\r🔍 Enriching metadata... ${current}/${total} (${percentage}%)`);
    }
  };
}

export async function handleApply(scanPath: string, argv: any) {
  console.log('🎬 Media Auto Renamer\n');

  // At this point scanPath is guaranteed to be defined
  scanPath = scanPath!;

  // Validate scan path
  if (!path.isAbsolute(scanPath)) {
    scanPath = path.resolve(scanPath);
  }

  // Load config with scanned folder priority
  let configResult = loadConfig(scanPath);
  let config = configResult.config;

  // Check API key at startup
  if (!(await validateApiKey(config.omdbApiKey || ''))) {
    console.log('❌ Invalid or missing API key! Please enter a valid OMDB API key.');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'omdbApiKey',
        message: 'Enter OMDB API key (get from http://www.omdbapi.com/apikey.aspx):',
        validate: async (input) => {
          if (!input.trim()) return 'API key cannot be empty';
          if (!/^[a-zA-Z0-9]+$/.test(input)) return 'API key should contain only letters and numbers';
          const valid = await validateApiKey(input);
          if (!valid) return 'Invalid API key! Please enter a valid one.';
          return true;
        }
      }
    ]);

    config.omdbApiKey = answers.omdbApiKey.trim();

    // Save the updated config
    const configToSave: AppConfig = {
      moviePath: config.moviePath,
      tvPath: config.tvPath,
      omdbApiKey: config.omdbApiKey,
      includeSubtitles: config.includeSubtitles
    };

    try {
      await saveConfig(configToSave, 'user');
      console.log('💾 API key saved to config.');
    } catch (error) {
      console.warn('⚠️ Failed to save config:', error);
      console.log('Continuing without saving...');
    }
  }

  // Display config source
  if (configResult.path) {
    console.log(`📄 Using config: ${configResult.source} (${configResult.path})`);
  } else {
    console.log(`📄 Config: ${configResult.source}`);
  }

  // Show verbose config information if requested
  if (argv.verbose && configResult.sources) {
    console.log('\n📋 Config Sources:');
    console.table(configResult.sources.map(source => ({
      'Location': source.location,
      'Path': source.path || 'N/A',
      'Exists': source.exists ? '✅' : '❌',
      'Config': source.config ? JSON.stringify(source.config) : 'N/A'
    })));

    console.log('\n🔀 Final Merged Config:');
    console.log(JSON.stringify(configResult.config, null, 2));
    console.log();
  }

  // Step 2: Get destination paths BEFORE scanning
  let moviePath = argv['movie-path'] || config.moviePath;
  let tvPath = argv['tv-path'] || config.tvPath;
  let omdbApiKey = config.omdbApiKey;

  // Always prompt for config if:
  // 1. --no-save-config flag is set, OR
  // 2. No config was found in any path (configResult.path is null), OR
  // 3. Config exists but moviePath, tvPath, or omdbApiKey are missing
  const noSaveConfigFlag = process.argv.includes('--no-save-config');
  const shouldPromptForConfig = noSaveConfigFlag || !configResult.path || !moviePath || !tvPath || !omdbApiKey;

  if (shouldPromptForConfig) {
    console.log('📁 Configuration needed. Please provide destination paths and API key:');
  } else {
    // Validate and resolve provided paths
    if (moviePath) {
      moviePath = path.resolve(moviePath);
      if (!fs.existsSync(path.dirname(moviePath))) {
        console.error(`❌ Movie path parent directory does not exist: ${path.dirname(moviePath)}`);
        process.exit(1);
      }
    }
    if (tvPath) {
      tvPath = path.resolve(tvPath);
      if (!fs.existsSync(path.dirname(tvPath))) {
        console.error(`❌ TV path parent directory does not exist: ${path.dirname(tvPath)}`);
        process.exit(1);
      }
    }
  }

  if (shouldPromptForConfig) {
    console.log('📁 No destination paths or API key found in config. Please provide them:');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'moviePath',
        message: 'Enter destination folder for Movies:',
        default: moviePath || path.join(require('os').homedir(), 'Movies'),
        validate: (input) => {
          if (!input.trim()) return 'Path cannot be empty';
          try {
            const resolved = path.resolve(input);
            // Check if we can access the directory or its parent
            const parent = path.dirname(resolved);
            if (!fs.existsSync(parent)) return `Parent directory does not exist: ${parent}`;
            return true;
          } catch (error) {
            return `Invalid path: ${error}`;
          }
        }
      },
      {
        type: 'input',
        name: 'tvPath',
        message: 'Enter destination folder for TV Shows:',
        default: tvPath || path.join(require('os').homedir(), 'TV Shows'),
        validate: (input) => {
          if (!input.trim()) return 'Path cannot be empty';
          try {
            const resolved = path.resolve(input);
            const parent = path.dirname(resolved);
            if (!fs.existsSync(parent)) return `Parent directory does not exist: ${parent}`;
            return true;
          } catch (error) {
            return `Invalid path: ${error}`;
          }
        }
      },
      {
        type: 'input',
        name: 'omdbApiKey',
        message: 'Enter OMDB API key (optional, get from http://www.omdbapi.com/apikey.aspx):',
        default: omdbApiKey || '',
        validate: (input) => {
          // Allow empty for optional
          if (!input.trim()) return true;
          // Basic validation for API key format (alphanumeric)
          if (!/^[a-zA-Z0-9]+$/.test(input)) return 'API key should contain only letters and numbers';
          return true;
        }
      }
    ]);

    moviePath = answers.moviePath;
    tvPath = answers.tvPath;
    omdbApiKey = answers.omdbApiKey.trim() || undefined;

    // Validate and resolve paths
    if (moviePath && tvPath) {
      moviePath = path.resolve(moviePath);
      tvPath = path.resolve(tvPath);
    } else {
      console.error('❌ Invalid paths provided');
      process.exit(1);
    }

    // Handle config saving
    const configToSave: AppConfig = {
      moviePath: moviePath,
      tvPath: tvPath,
      omdbApiKey: omdbApiKey,
      includeSubtitles: true // Default to true for subtitle handling
    };

    const saveChoices = [
      { name: 'User folder', value: 'user' },
      { name: 'Current scanned folder', value: 'scanned' },
      { name: 'Project folder', value: 'project' },
      { name: 'Don\'t save', value: 'none' }
    ];

    const { saveLocation } = await inquirer.prompt({
      type: 'list',
      name: 'saveLocation',
      message: 'Where to save the config?',
      choices: saveChoices
    });

    if (saveLocation !== 'none') {
      try {
        await saveConfig(configToSave, saveLocation, scanPath);
        console.log(`💾 Config saved to ${saveLocation}`);
      } catch (error) {
        console.warn('⚠️  Failed to save config:', error);
        console.log('Continuing without saving config...');
      }
    } else {
      console.log('💾 Config not saved');
    }
  }

  console.log(`📁 Scanning: ${scanPath}\n`);

  // Step 3: Scan files
  const mediaFiles = await scanMediaFiles(scanPath, config);
  if (mediaFiles.length === 0) {
    console.log('No media files found.');
    return;
  }

  console.log(`Found ${mediaFiles.length} media file(s).\n`);

  // Step 4: Process files
  const metadatas: EnrichedMetadata[] = [];
  const progressBar = createProgressBar(mediaFiles.length);

  for (const file of mediaFiles) {
    const metadata = parseFilename(file.name);
    let enriched: EnrichedMetadata;

    if (file.type === 'video') {
      // Only enrich metadata for video files
      enriched = await enrichMetadata(metadata);
    } else {
      // For subtitle files, use basic metadata without enrichment
      enriched = { ...metadata };
    }

    metadatas.push(enriched);
    progressBar.update();
  }

  console.log('\n✅ Metadata processed.\n');

  // Step 5: Preview changes
  console.log('📋 Previewing changes...\n');

  const previewResults = await organizeFiles(mediaFiles, metadatas, moviePath!, tvPath!, async () => 'skip', true);

  // Visualize changes
  console.log('Proposed folder structure with changes:');
  displayPreview(previewResults, moviePath!, tvPath!);

  // Ask for confirmation
  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Do you want to proceed with these changes?',
    default: false
  });

  if (!confirm) {
    console.log('Operation cancelled.');
    closeDatabase();
    return;
  }

  // Step 6: Organize files
  const conflictHandler = async (original: string, newPath: string): Promise<'skip' | 'overwrite'> => {
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: `File already exists: ${path.basename(newPath)}\nOriginal: ${original}`,
      choices: [
        { name: 'Skip', value: 'skip' },
        { name: 'Overwrite', value: 'overwrite' }
      ]
    });
    return action;
  };

  const results = await organizeFiles(mediaFiles, metadatas, moviePath!, tvPath!, conflictHandler, false);

  console.log('\n🎉 Processing complete!');
  console.log(`Processed ${results.length} file(s).`);

  closeDatabase();
}