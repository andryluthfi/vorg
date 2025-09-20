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
function isTrashFile(filePath: string, parentDir: string): boolean {
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
 * Recursively scans a directory for cleanup candidates.
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
 * Displays a preview of what will be cleaned up.
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
 * Main cleanup handler that scans, previews, and optionally performs cleanup.
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