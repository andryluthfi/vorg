import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { loadConfig, saveConfig, AppConfig } from '../config/config';
import { scanMediaFiles } from '../core-data/scanner';
import { parseFilename, EnrichedMetadata } from '../core-data/parser';
import { enrichMetadata, validateApiKey } from '../infrastructure/api';
import { organizeFiles, ProcessedFile } from '../business-logic/organizer';
import { closeDatabase } from '../infrastructure/database';
import { handleCleanup } from './cleanup';

interface FileInfo {
  oldName: string;
  newName: string;
  errors: string[];
}

interface FileNode {
  [key: string]: FileNode | FileInfo[];
}

/**
 * Recursively displays a hierarchical file structure with visual formatting.
 * Shows directories with 📁 and files with 📄, using indentation for nesting.
 * For multiple files in a directory, displays them in a table format with old/new names.
 *
 * @function displayNode
 * @param {FileNode} node - The hierarchical node structure to display
 * @param {string} [indent='  '] - Indentation string for nesting levels
 * @returns {void}
 *
 * @example
 * const node = {
 *   'Movies': {
 *     '_files': [{ oldName: 'movie.avi', newName: 'Movie (2020).avi' }]
 *   }
 * };
 * displayNode(node);
 * // Output:
 * // 📁 Movies
 * //   📄 movie.avi ⮞ Movie (2020).avi
 *
 * @example
 * // Edge case: Empty node
 * displayNode({});
 * // No output
 *
 * @example
 * // Edge case: Multiple files in directory
 * const node = {
 *   '_files': [
 *     { oldName: 'file1.avi', newName: 'File1.avi' },
 *     { oldName: 'file2.avi', newName: 'File2.avi' }
 *   ]
 * };
 * displayNode(node);
 * // Displays table format
 */
function displayNode(node: FileNode, indent: string = '  ') {
  for (const [key, value] of Object.entries(node)) {
    if (key === '_files') {
      const files = value as FileInfo[];
      if (files.length > 0) {
        // Always use table format
        console.log(`${indent}📄 Files:`);

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
      displayNode(value as FileNode, indent + '  ');
    }
  }
}

/**
 * Displays a preview of the proposed folder structure changes for movies and TV shows.
 * Separates valid files from invalid files, showing hierarchical organization for valid files
 * and error details for invalid files.
 *
 * @function displayPreview
 * @param {ProcessedFile[]} results - Array of processed files with their new paths and errors
 * @param {string} moviePath - Destination path for movies
 * @param {string} tvPath - Destination path for TV shows
 * @returns {void}
 *
 * @example
 * const results = [{
 *   originalPath: '/old/movie.avi',
 *   newPath: '/movies/Movie (2020)/Movie (2020).avi',
 *   metadata: { type: 'movie', title: 'Movie', year: 2020 },
 *   errors: []
 * }];
 * displayPreview(results, '/movies', '/tv');
 * // Output:
 * // ✅ VALID FILES
 * // 🎥 MOVIE: /movies
 * // 📁 Movie (2020)
 * //   📄 movie.avi ⮞ Movie (2020).avi
 *
 * @example
 * // Edge case: Files with errors
 * const results = [{
 *   originalPath: '/old/bad.avi',
 *   newPath: '/old/bad.avi',
 *   metadata: { type: 'tv', title: '' },
 *   errors: ['Missing TV show name']
 * }];
 * displayPreview(results, '/movies', '/tv');
 * // Shows invalid files section
 */
function displayPreview(results: ProcessedFile[], moviePath: string, tvPath: string) {
  const validResults = results.filter(r => r.errors.length === 0 && r.action !== 'skip');
  const invalidResults = results.filter(r => r.errors.length > 0);

  // Display valid files
  if (validResults.length > 0) {
    console.log('✅ VALID FILES');
    console.log('Proposed folder structure with changes:');

    const basePaths = { movie: moviePath, tv: tvPath };

    for (const [type, basePath] of Object.entries(basePaths)) {
      console.log(`${type === 'movie' ? '🎥' : '📺'} ${type.toUpperCase()}: ${basePath}`);
      const typeResults = validResults.filter(r => r.metadata.type === type);

      if (typeResults.length === 0) {
        console.log('  (no files)');
        continue;
      }

      // Build hierarchical structure
      const root: FileNode = {};

      for (const result of typeResults) {
        const fullPath = path.dirname(result.newPath);
        const relativePath = path.relative(basePath, fullPath);
        const pathParts = relativePath.split(path.sep);
        const oldName = path.basename(result.originalPath);
        const newName = path.basename(result.newPath);

        let current = root;
        for (const part of pathParts) {
          if (!current[part]) {
            current[part] = {} as FileNode;
          }
          current = current[part] as FileNode;
        }

        if (!current['_files']) {
          current['_files'] = [] as FileInfo[];
        }
        (current['_files'] as FileInfo[]).push({ oldName, newName, errors: [] });
      }

      // Display hierarchical structure
      displayNode(root);
      console.log();
    }
  } else {
    console.log('✅ VALID FILES');
    console.log('  (no valid files)');
    console.log();
  }

  // Display invalid files
  if (invalidResults.length > 0) {
    console.log('❌ INVALID FILES');

    // Calculate max lengths for proper alignment
    const maxFileLength = Math.max(...invalidResults.map(r => path.basename(r.originalPath).length));
    const maxErrorsLength = Math.max(...invalidResults.map(r => r.errors.join(', ').length));

    // Create table borders
    const header = `  ┌─${'─'.repeat(maxFileLength)}─┬─${'─'.repeat(maxErrorsLength)}─┐`;
    const separator = `  ├─${'─'.repeat(maxFileLength)}─┼─${'─'.repeat(maxErrorsLength)}─┤`;
    const footer = `  └─${'─'.repeat(maxFileLength)}─┴─${'─'.repeat(maxErrorsLength)}─┘`;

    console.log(header);
    console.log(`  │ ${'File Name'.padEnd(maxFileLength)} │ ${'Errors'.padEnd(maxErrorsLength)} │`);
    console.log(separator);

    // Display each invalid file
    for (const result of invalidResults) {
      const fileName = path.basename(result.originalPath);
      const errorsText = result.errors.join(', ');
      console.log(`  │ ${fileName.padEnd(maxFileLength)} │ ${errorsText.padEnd(maxErrorsLength)} │`);
    }

    console.log(footer);
    console.log();
  }
}

/**
 * Creates a progress bar object for tracking metadata enrichment progress.
 * Updates the console with current progress percentage on each update call.
 *
 * @function createProgressBar
 * @param {number} total - Total number of items to process
 * @returns {Object} Progress bar object with update method
 * @returns {function} returns.update - Function to increment progress and update display
 *
 * @example
 * const progress = createProgressBar(100);
 * for (let i = 0; i < 100; i++) {
 *   // Perform metadata enrichment
 *   await enrichMetadata(file);
 *   progress.update();
 * }
 * // Console output: 🔍 Enriching metadata... 50/100 (50%)
 *
 * @example
 * // Edge case: Total is 0
 * const progress = createProgressBar(0);
 * progress.update(); // No division by zero, handles gracefully
 */
function createProgressBar(total: number) {
  let current = 0;
  return {
    update: () => {
      current++;
      const percentage = Math.round((current / total) * 100);
      process.stdout.write(`\r🔍 Enriching metadata... ${current}/${total} (${percentage}%)`);
      if (current === total) {
        console.log(); // New line after completion
      }
    }
  };
}

/**
 * Main handler for the apply command - orchestrates the complete media file organization workflow.
 * Loads configuration, scans for media files, enriches metadata via OMDB API, previews changes,
 * and organizes files into proper directory structure with conflict resolution.
 *
 * Workflow steps:
 * 1. Validate scan path and resolve to absolute
 * 2. Load and validate configuration (moviePath, tvPath, omdbApiKey)
 * 3. Prompt for missing configuration if needed
 * 4. Scan directory for media files
 * 5. Parse filenames and enrich metadata for video files
 * 6. Preview proposed folder structure
 * 7. Confirm changes with user
 * 8. Organize files with conflict handling
 * 9. Cleanup scanned folder (empty folders, trash files)
 *
 * @async
 * @function handleApply
 * @param {string} scanPath - Path to scan for media files (can be relative)
 * @param {Record<string, unknown>} argv - Parsed command line arguments
 * @returns {Promise<void>}
 * @throws {Error} If scan path doesn't exist, config validation fails, or file operations error
 *
 * @example
 * // Basic usage
 * await handleApply('/path/to/media', { verbose: true });
 *
 * @example
 * // With custom paths
 * await handleApply('/downloads', {
 *   'movie-path': '/movies',
 *   'tv-path': '/tvshows',
 *   interactive: true
 * });
 *
 * @example
 * // Edge case: No media files found
 * await handleApply('/empty/directory', {});
 * // Output: No media files found.
 *
 * @example
 * // Edge case: Invalid API key, prompts for new one
 * await handleApply('/path', {});
 * // Validates API key, prompts if invalid
 *
 * @example
 * // Edge case: File conflicts during organization
 * await handleApply('/path', {});
 * // Prompts user to skip or overwrite conflicting files
 *
 * @example
 * // Edge case: Parent directory doesn't exist
 * await handleApply('/invalid/path', {});
 * // Throws error: scan path parent directory does not exist
 */
export async function handleApply(scanPath: string, argv: Record<string, unknown>) {
  console.log('🎬 Media Auto Renamer\n');

  // At this point scanPath is guaranteed to be defined
  scanPath = scanPath!;

  // Validate scan path
  if (!path.isAbsolute(scanPath)) {
    scanPath = path.resolve(scanPath);
  }

  // Load config with scanned folder priority
  const configResult = loadConfig(scanPath);
  const config = configResult.config;

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
      tmdbApiKey: config.tmdbApiKey,
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
  let moviePath = (argv['movie-path'] as string | undefined) || config.moviePath;
  let tvPath = (argv['tv-path'] as string | undefined) || config.tvPath;
  let omdbApiKey = config.omdbApiKey;
  let tmdbApiKey = config.tmdbApiKey;

  // Always prompt for config if:
  // 1. --no-save-config flag is set, OR
  // 2. No config was found in any path (configResult.path is null), OR
  // 3. Config exists but moviePath, tvPath, omdbApiKey, or tmdbApiKey are missing
  const noSaveConfigFlag = process.argv.includes('--no-save-config');
  const shouldPromptForConfig = noSaveConfigFlag || !configResult.path || !moviePath || !tvPath || !omdbApiKey || !tmdbApiKey;

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
        default: moviePath || path.join(os.homedir(), 'Movies'),
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
        default: tvPath || path.join(os.homedir(), 'TV Shows'),
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
      },
      {
        type: 'input',
        name: 'tmdbApiKey',
        message: 'Enter TMDB API key (optional, get from https://www.themoviedb.org/settings/api):',
        default: tmdbApiKey || '',
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
    tmdbApiKey = answers.tmdbApiKey.trim() || undefined;

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
      tmdbApiKey: tmdbApiKey,
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
    const metadata = parseFilename(file.name, file.path, scanPath);
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

  const previewResults = await organizeFiles(mediaFiles, metadatas, moviePath!, tvPath!, async () => 'skip', true, scanPath);

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
  /**
   * Handles file conflict resolution by prompting user for action when a target file already exists.
   * Presents options to skip the move or overwrite the existing file.
   *
   * @async
   * @function conflictHandler
   * @param {string} original - Original file path being moved
   * @param {string} newPath - Target path that conflicts with existing file
   * @returns {Promise<'skip' | 'overwrite'>} User's chosen action
   *
   * @example
   * const action = await conflictHandler('/old/movie.avi', '/new/movie.avi');
   * // Prompts: "File already exists: movie.avi"
   * // Options: Skip, Overwrite
   * // Returns: 'skip' or 'overwrite'
   *
   * @example
   * // Edge case: Same file (original === newPath)
   * const action = await conflictHandler('/file.avi', '/file.avi');
   * // Still prompts for action
   */
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

  const results = await organizeFiles(mediaFiles, metadatas, moviePath!, tvPath!, conflictHandler, false, scanPath);

  console.log('\n🎉 Processing complete!');
  console.log(`Processed ${results.length} file(s).`);

  // Step 7: Cleanup scanned folder
  try {
    await handleCleanup(scanPath);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    console.log('Continuing with database cleanup...');
  }

  closeDatabase();
}