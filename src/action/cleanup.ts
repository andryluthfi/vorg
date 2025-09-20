import * as fs from 'fs-extra';
import * as path from 'path';
import inquirer from 'inquirer';
import { deleteEmptyDirectoriesRecursively } from './revert';

// Define trash file extensions (excluding subtitle files)
const TRASH_EXTENSIONS = ['.torrent', '.nfo', '.txt', '.jpg', '.png', '.sfv', '.md5'];

// Define subtitle extensions to preserve
const SUBTITLE_EXTENSIONS = ['.srt', '.sub', '.ssa', '.ass', '.vtt', '.idx', '.sup', '.mks', '.ttml'];

interface CleanupItem {
  path: string;
  type: 'empty_folder' | 'trash_file' | 'sample_folder';
  reason: string;
}

interface CleanupResult {
  emptyFolders: CleanupItem[];
  trashFiles: CleanupItem[];
  sampleFolders: CleanupItem[];
}

/**
 * Checks if a directory is a torrent-related folder by looking for .torrent files
 * or common torrent folder naming patterns.
 *
 * @function isTorrentFolder
 * @param {string} dirPath - Path to the directory to check
 * @returns {boolean} True if the directory appears to be torrent-related
 *
 * @example
 * isTorrentFolder('/path/to/downloads'); // true if contains .torrent files
 * isTorrentFolder('/path/to/movies'); // false
 */
function isTorrentFolder(dirPath: string): boolean {
  try {
    const items = fs.readdirSync(dirPath);
    // Check if folder contains .torrent files
    const hasTorrentFiles = items.some(item => path.extname(item).toLowerCase() === '.torrent');

    // Check for common torrent folder names
    const folderName = path.basename(dirPath).toLowerCase();
    const torrentFolderNames = ['torrent', 'torrents', 'download', 'downloads'];

    return hasTorrentFiles || torrentFolderNames.some(name => folderName.includes(name));
  } catch {
    return false;
  }
}

/**
 * Checks if a file is a trash file in a torrent folder.
 * Excludes subtitle files and video files.
 */
function isTrashFile(filePath: string, _parentDir: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();

  // Skip subtitle files
  if (SUBTITLE_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Skip video files
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
  if (videoExtensions.includes(ext)) {
    return false;
  }

  // Check if it's a known trash extension
  if (TRASH_EXTENSIONS.includes(ext)) {
    return true;
  }

  // Check for sample files (common in torrents)
  if (fileName.includes('sample')) {
    return true;
  }

  return false;
}

/**
 * Checks if a folder is a sample folder (common in torrents).
 */
function isSampleFolder(dirPath: string): boolean {
  const folderName = path.basename(dirPath).toLowerCase();
  return folderName.includes('sample') || folderName.includes('screens');
}

/**
 * Recursively scans a directory for cleanup candidates including empty folders,
 * trash files in torrent directories, and sample folders.
 *
 * @function scanForCleanup
 * @param {string} scanPath - Root directory path to scan for cleanup opportunities
 * @returns {CleanupResult} Object containing arrays of empty folders, trash files, and sample folders
 *
 * @example
 * const result = scanForCleanup('/path/to/downloads');
 * console.log(`Found ${result.trashFiles.length} trash files`);
 * console.log(`Found ${result.emptyFolders.length} empty folders`);
 *
 * @example
 * // Edge case: Non-existent directory
 * const result = scanForCleanup('/non/existent/path');
 * // Returns empty result object
 */
export function scanForCleanup(scanPath: string): CleanupResult {
  const result: CleanupResult = {
    emptyFolders: [],
    trashFiles: [],
    sampleFolders: []
  };

  function scanDir(dirPath: string): void {
    try {
      const items = fs.readdirSync(dirPath);

      if (items.length === 0) {
        // Empty folder
        result.emptyFolders.push({
          path: dirPath,
          type: 'empty_folder',
          reason: 'Empty directory'
        });
        return;
      }

      const isTorrent = isTorrentFolder(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Check if it's a sample folder
          if (isSampleFolder(fullPath)) {
            result.sampleFolders.push({
              path: fullPath,
              type: 'sample_folder',
              reason: 'Sample folder'
            });
          } else {
            // Recursively scan subdirectory
            scanDir(fullPath);
          }
        } else if (stat.isFile() && isTorrent) {
          // Check if it's a trash file in torrent folder
          if (isTrashFile(fullPath, dirPath)) {
            result.trashFiles.push({
              path: fullPath,
              type: 'trash_file',
              reason: `Trash file in torrent folder (${path.extname(fullPath)})`
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  scanDir(scanPath);
  return result;
}

/**
 * Displays a formatted preview of cleanup operations that will be performed.
 * Shows empty folders, trash files grouped by directory, and sample folders.
 *
 * @function displayCleanupPreview
 * @param {CleanupResult} result - Cleanup scan results to display
 * @returns {void}
 *
 * @example
 * const result = scanForCleanup('/downloads');
 * displayCleanupPreview(result);
 * // Output:
 * // 🧹 CLEANUP PREVIEW
 * // ==================
 * // 📁 Empty Folders to Delete:
 * //   🗂️  /downloads/empty
 * // 🗑️  Trash Files in Torrent Folders:
 * //   📁 /downloads/torrent1/
 * //     🗑️  info.nfo (Trash file in torrent folder (.nfo))
 *
 * @example
 * // Edge case: No cleanup needed
 * const emptyResult = { emptyFolders: [], trashFiles: [], sampleFolders: [] };
 * displayCleanupPreview(emptyResult);
 * // Output: ✨ No cleanup needed - folder is already clean!
 */
export function displayCleanupPreview(result: CleanupResult): void {
  console.log('\n🧹 CLEANUP PREVIEW');
  console.log('==================\n');

  let hasItems = false;

  // Display empty folders
  if (result.emptyFolders.length > 0) {
    hasItems = true;
    console.log('📁 Empty Folders to Delete:');
    result.emptyFolders.forEach(folder => {
      console.log(`  🗂️  ${folder.path}`);
    });
    console.log();
  }

  // Display trash files
  if (result.trashFiles.length > 0) {
    hasItems = true;
    console.log('🗑️  Trash Files in Torrent Folders:');
    // Group by parent directory
    const groupedByDir: { [key: string]: CleanupItem[] } = {};
    result.trashFiles.forEach(file => {
      const dir = path.dirname(file.path);
      if (!groupedByDir[dir]) {
        groupedByDir[dir] = [];
      }
      groupedByDir[dir].push(file);
    });

    Object.entries(groupedByDir).forEach(([dir, files]) => {
      console.log(`  📁 ${dir}/`);
      files.forEach(file => {
        console.log(`    🗑️  ${path.basename(file.path)} (${file.reason})`);
      });
    });
    console.log();
  }

  // Display sample folders
  if (result.sampleFolders.length > 0) {
    hasItems = true;
    console.log('🎬 Sample Folders to Delete:');
    result.sampleFolders.forEach(folder => {
      console.log(`  📁 ${folder.path}`);
    });
    console.log();
  }

  if (!hasItems) {
    console.log('✨ No cleanup needed - folder is already clean!\n');
  } else {
    const totalItems = result.emptyFolders.length + result.trashFiles.length + result.sampleFolders.length;
    console.log(`📊 Total items to clean: ${totalItems}`);
    console.log(`  • Empty folders: ${result.emptyFolders.length}`);
    console.log(`  • Trash files: ${result.trashFiles.length}`);
    console.log(`  • Sample folders: ${result.sampleFolders.length}\n`);
  }
}

/**
 * Performs the actual cleanup operations.
 */
async function performCleanup(result: CleanupResult): Promise<void> {
  let deletedCount = 0;

  // Delete trash files
  for (const file of result.trashFiles) {
    try {
      await fs.remove(file.path);
      console.log(`🗑️  Deleted: ${path.basename(file.path)}`);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete ${file.path}:`, error);
    }
  }

  // Delete sample folders
  for (const folder of result.sampleFolders) {
    try {
      await fs.remove(folder.path);
      console.log(`📁 Deleted sample folder: ${folder.path}`);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete sample folder ${folder.path}:`, error);
    }
  }

  // Delete empty folders (using existing function)
  for (const folder of result.emptyFolders) {
    try {
      deleteEmptyDirectoriesRecursively(folder.path, 5); // Higher depth for cleanup
      console.log(`🗂️  Deleted empty folder: ${folder.path}`);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete empty folder ${folder.path}:`, error);
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} items.`);
}

/**
 * Main cleanup handler that orchestrates the complete cleanup process.
 * Scans for cleanup opportunities, displays preview, and optionally performs cleanup operations.
 *
 * Cleanup operations include:
 * - Removing empty directories
 * - Deleting trash files from torrent folders (.torrent, .nfo, .txt, .jpg, etc.)
 * - Removing sample folders
 * - Preserving all video and subtitle files
 *
 * @async
 * @function handleCleanup
 * @param {string} scanPath - Directory path to scan for cleanup opportunities
 * @param {boolean} [autoConfirm=false] - Skip confirmation prompt and proceed automatically
 * @returns {Promise<void>}
 * @throws {Error} If scan path doesn't exist or cleanup operations fail
 *
 * @example
 * // Interactive cleanup with confirmation
 * await handleCleanup('/path/to/downloads');
 * // Scans, shows preview, asks for confirmation, then cleans
 *
 * @example
 * // Automatic cleanup without confirmation
 * await handleCleanup('/path/to/downloads', true);
 * // Scans and cleans automatically
 *
 * @example
 * // Edge case: No cleanup needed
 * await handleCleanup('/clean/directory');
 * // Output: ✨ No cleanup needed - scanned folder is already clean!
 *
 * @example
 * // Edge case: Non-existent directory
 * await handleCleanup('/non/existent/path');
 * // Throws error about invalid path
 */
export async function handleCleanup(scanPath: string, autoConfirm: boolean = false): Promise<void> {
  console.log('🧹 Scanning for cleanup opportunities...\n');

  const cleanupResult = scanForCleanup(scanPath);

  // Check if there's anything to clean
  const totalItems = cleanupResult.emptyFolders.length +
                    cleanupResult.trashFiles.length +
                    cleanupResult.sampleFolders.length;

  if (totalItems === 0) {
    console.log('✨ No cleanup needed - scanned folder is already clean!');
    return;
  }

  // Display preview
  displayCleanupPreview(cleanupResult);

  // Ask for confirmation unless auto-confirm is enabled
  if (!autoConfirm) {
    const { confirm } = await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to proceed with the cleanup?',
      default: false
    });

    if (!confirm) {
      console.log('🛑 Cleanup cancelled.');
      return;
    }
  }

  // Perform cleanup
  await performCleanup(cleanupResult);
}