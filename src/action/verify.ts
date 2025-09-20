import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs-extra';
import { loadConfig } from '../config/config';
import { scanMediaFiles, MediaFile } from '../core-data/scanner';
import { parseFilename, EnrichedMetadata } from '../core-data/parser';
import { enrichMetadata } from '../infrastructure/api';
import { closeDatabase } from '../infrastructure/database';

interface VerificationResult {
  misplacedFiles: {
    file: MediaFile;
    metadata: EnrichedMetadata;
    currentPath: string;
    correctPath: string;
    reason: string;
  }[];
  emptyFolders: string[];
}

/**
 * Verifies and fixes misplaced media files by checking if they are in correct locations based on metadata.
 * Scans media files, determines correct paths, identifies misplaced files and empty folders,
 * displays results, and optionally moves files to correct locations and removes empty folders.
 *
 * @async
 * @function handleVerify
 * @param {string} scanPath - Path to scan for media files
 * @param {Record<string, unknown>} argv - Command line arguments
 * @returns {Promise<void>}
 * @throws {Error} If configuration is missing or file operations fail
 *
 * @example
 * // Verify files in current directory
 * await handleVerify('.', { 'movie-path': '/movies', 'tv-path': '/tv' });
 *
 * @example
 * // Edge case: No media files found
 * await handleVerify('/empty/dir', {});
 * // Output: No media files found.
 *
 * @example
 * // Edge case: Missing configuration
 * await handleVerify('/path', {});
 * // Error: Movie path and TV path must be configured
 *
 * @example
 * // Edge case: All files correctly placed
 * await handleVerify('/organized', {});
 * // Output: All files are in their correct locations!
 */
export async function handleVerify(scanPath: string, argv: Record<string, unknown>) {
  console.log('🔍 Media Target Verification\n');

  // Load config
  const configResult = loadConfig(scanPath);
  const config = configResult.config;

  // Get destination paths
  const moviePath = (argv['movie-path'] as string | undefined) || config.moviePath;
  const tvPath = (argv['tv-path'] as string | undefined) || config.tvPath;

  if (!moviePath || !tvPath) {
    console.error('❌ Movie path and TV path must be configured. Please run without --verify-target first to set them up.');
    return;
  }

  console.log(`📁 Scanning: ${scanPath}`);
  console.log(`🎥 Movies: ${moviePath}`);
  console.log(`📺 TV Shows: ${tvPath}\n`);

  // Scan for media files
  const mediaFiles = await scanMediaFiles(scanPath, config);
  if (mediaFiles.length === 0) {
    console.log('No media files found.');
    return;
  }

  console.log(`Found ${mediaFiles.length} media file(s).\n`);

  // Process files to determine correct locations
  const verificationResults = await verifyFileLocations(mediaFiles, moviePath, tvPath, scanPath);

  if (verificationResults.misplacedFiles.length === 0 && verificationResults.emptyFolders.length === 0) {
    console.log('✅ All files are in their correct locations!');
    return;
  }

  // Display results
  displayVerificationResults(verificationResults);

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

  // Execute the plan
  await executeVerificationPlan(verificationResults);

  console.log('\n🎉 Verification and cleanup complete!');
  closeDatabase();
}

/**
 * Analyzes media files to determine if they are in correct locations based on their metadata.
 * Enriches metadata for video files, calculates correct paths, identifies misplaced files,
 * and detects empty folders that can be removed.
 *
 * @async
 * @function verifyFileLocations
 * @param {MediaFile[]} mediaFiles - Array of media files to verify
 * @param {string} moviePath - Destination path for movies
 * @param {string} tvPath - Destination path for TV shows
 * @param {string} scanPath - Original scan path
 * @returns {Promise<VerificationResult>} Results containing misplaced files and empty folders
 *
 * @example
 * const files = [{ name: 'Movie.2020.avi', path: '/wrong/path/Movie.2020.avi', type: 'video' }];
 * const result = await verifyFileLocations(files, '/movies', '/tv', '/scan');
 * // Returns misplaced files and empty folders
 *
 * @example
 * // Edge case: Subtitle file (no enrichment)
 * const files = [{ name: 'Movie.srt', path: '/path/Movie.srt', type: 'subtitle' }];
 * const result = await verifyFileLocations(files, '/movies', '/tv', '/scan');
 * // Uses basic metadata without API enrichment
 */
async function verifyFileLocations(mediaFiles: MediaFile[], moviePath: string, tvPath: string, scanPath: string): Promise<VerificationResult> {
  const misplacedFiles: VerificationResult['misplacedFiles'] = [];
  const emptyFolders = new Set<string>();

  console.log('🔍 Analyzing file locations...\n');

  for (const file of mediaFiles) {
    const metadata = parseFilename(file.name);
    let enrichedMetadata: EnrichedMetadata;

    // Only enrich video files
    if (file.type === 'video') {
      enrichedMetadata = await enrichMetadata(metadata);
    } else {
      enrichedMetadata = { ...metadata };
    }

    // Determine correct location
    let correctPath: string;
    if (enrichedMetadata.type === 'movie') {
      const folderName = enrichedMetadata.title; // Just the title without year
      correctPath = path.join(moviePath, folderName, `${folderName}${file.extension}`);
    } else {
      // TV show
      const showFolder = `${enrichedMetadata.title}${enrichedMetadata.year ? ` (${enrichedMetadata.year})` : ''}`;
      const seasonFolder = `Season ${enrichedMetadata.season}`;
      const episodeName = `${enrichedMetadata.title} - Season ${enrichedMetadata.season} Episode ${enrichedMetadata.episode}${enrichedMetadata.episodeTitle ? ` - ${enrichedMetadata.episodeTitle}` : ''}`;
      correctPath = path.join(tvPath, showFolder, seasonFolder, `${episodeName}${file.extension}`);
    }

    // Check if file is in wrong location
    const normalizedCurrentPath = path.normalize(file.path);
    const normalizedCorrectPath = path.normalize(correctPath);

    if (normalizedCurrentPath !== normalizedCorrectPath) {
      // Determine the reason
      let reason = '';
      const currentDir = path.dirname(normalizedCurrentPath);

      if (enrichedMetadata.type === 'movie') {
        if (currentDir.includes(tvPath)) {
          reason = 'Movie file found in TV shows directory';
        } else {
          reason = 'Movie file in incorrect location';
        }
      } else {
        if (currentDir.includes(moviePath)) {
          reason = 'TV show file found in movies directory';
        } else {
          reason = 'TV show file in incorrect location';
        }
      }

      misplacedFiles.push({
        file,
        metadata: enrichedMetadata,
        currentPath: normalizedCurrentPath,
        correctPath: normalizedCorrectPath,
        reason
      });
    }

    // Track parent directories for empty folder detection
    let currentDir = path.dirname(file.path);
    while (currentDir !== scanPath && currentDir !== path.dirname(currentDir)) {
      emptyFolders.add(currentDir);
      currentDir = path.dirname(currentDir);
    }
  }

  // Filter out non-empty folders
  const actualEmptyFolders: string[] = [];
  for (const folder of emptyFolders) {
    try {
      const items = await fs.readdir(folder);
      if (items.length === 0) {
        actualEmptyFolders.push(folder);
      }
    } catch (error) {
      // Folder might not exist or inaccessible, skip
    }
  }

  return {
    misplacedFiles,
    emptyFolders: actualEmptyFolders
  };
}

/**
 * Displays the results of the verification process in a readable format.
 * Shows details of misplaced files with current/correct paths and reasons,
 * and lists empty folders that will be removed.
 *
 * @function displayVerificationResults
 * @param {VerificationResult} results - Verification results to display
 * @returns {void}
 *
 * @example
 * const results = {
 *   misplacedFiles: [{
 *     currentPath: '/tv/Movie.avi',
 *     correctPath: '/movies/Movie/Movie.avi',
 *     reason: 'Movie file found in TV shows directory'
 *   }],
 *   emptyFolders: ['/old/empty/folder']
 * };
 * displayVerificationResults(results);
 * // Displays formatted results with file details and empty folders
 *
 * @example
 * // Edge case: No issues found
 * displayVerificationResults({ misplacedFiles: [], emptyFolders: [] });
 * // No output (handled in handleVerify)
 */
function displayVerificationResults(results: VerificationResult) {
  console.log('📋 Verification Results:\n');

  if (results.misplacedFiles.length > 0) {
    console.log(`🚨 Found ${results.misplacedFiles.length} misplaced file(s):\n`);

    for (const item of results.misplacedFiles) {
      console.log(`📄 ${path.basename(item.currentPath)}`);
      console.log(`   Current: ${item.currentPath}`);
      console.log(`   Should be: ${item.correctPath}`);
      console.log(`   Reason: ${item.reason}\n`);
    }
  }

  if (results.emptyFolders.length > 0) {
    console.log(`🗂️  Found ${results.emptyFolders.length} empty folder(s) that will be removed:\n`);

    for (const folder of results.emptyFolders) {
      console.log(`   ${folder}`);
    }
    console.log();
  }
}

/**
 * Executes the verification plan by moving misplaced files to correct locations
 * and removing identified empty folders.
 *
 * @async
 * @function executeVerificationPlan
 * @param {VerificationResult} results - Verification results containing actions to execute
 * @returns {Promise<void>}
 *
 * @example
 * const results = {
 *   misplacedFiles: [{ currentPath: '/wrong/file.avi', correctPath: '/correct/file.avi' }],
 *   emptyFolders: ['/empty/folder']
 * };
 * await executeVerificationPlan(results);
 * // Moves file and removes empty folder
 *
 * @example
 * // Edge case: Move fails (destination not writable)
 * await executeVerificationPlan(results);
 * // Logs error but continues with other operations
 *
 * @example
 * // Edge case: Empty results
 * await executeVerificationPlan({ misplacedFiles: [], emptyFolders: [] });
 * // Does nothing
 */
async function executeVerificationPlan(results: VerificationResult) {
  console.log('🔄 Executing verification plan...\n');

  // Move misplaced files
  for (const item of results.misplacedFiles) {
    try {
      console.log(`Moving: ${path.basename(item.currentPath)}`);
      console.log(`  From: ${item.currentPath}`);
      console.log(`  To: ${item.correctPath}`);

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(item.correctPath));

      // Move the file
      await fs.move(item.currentPath, item.correctPath, { overwrite: true });

      console.log('  ✅ Moved successfully\n');
    } catch (error) {
      console.error(`  ❌ Failed to move: ${error}\n`);
    }
  }

  // Remove empty folders
  for (const folder of results.emptyFolders) {
    try {
      console.log(`Removing empty folder: ${folder}`);
      await fs.remove(folder);
      console.log('  ✅ Removed successfully\n');
    } catch (error) {
      console.error(`  ❌ Failed to remove folder: ${error}\n`);
    }
  }
}