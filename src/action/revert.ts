import * as fs from 'fs-extra';
import * as path from 'path';
import inquirer from 'inquirer';
import { getRecentMoves } from '../infrastructure/database';

/**
 * Recursively deletes empty directories up to a maximum depth level.
 * Checks if a directory is empty, removes it if so, and continues checking parent directories.
 * Useful for cleaning up directory structures after file moves/reverts.
 *
 * @function deleteEmptyDirectoriesRecursively
 * @param {string} dirPath - Path of the directory to check and potentially remove
 * @param {number} [maxDepth=2] - Maximum number of parent directory levels to check
 * @returns {void}
 * @throws {Error} If directory operations fail (logged but not thrown)
 *
 * @example
 * // Clean up empty directories after file move
 * deleteEmptyDirectoriesRecursively('/path/to/empty/dir', 2);
 * // Removes /path/to/empty/dir and checks /path/to/empty, /path/to
 *
 * @example
 * // Edge case: Directory doesn't exist
 * deleteEmptyDirectoriesRecursively('/nonexistent/path', 2);
 * // Returns immediately without error
 *
 * @example
 * // Edge case: Directory not empty
 * deleteEmptyDirectoriesRecursively('/path/with/files', 2);
 * // Does nothing
 *
 * @example
 * // Edge case: maxDepth = 0
 * deleteEmptyDirectoriesRecursively('/path', 0);
 * // Only checks the given directory, doesn't recurse to parent
 */
export function deleteEmptyDirectoriesRecursively(dirPath: string, maxDepth: number = 2): void {
  if (!fs.existsSync(dirPath)) return;

  try {
    const items = fs.readdirSync(dirPath);
    if (items.length === 0) {
      fs.rmdirSync(dirPath);
      console.log(`Removed empty directory: ${dirPath}`);

      // Recursively check parent directories up to maxDepth
      if (maxDepth > 0) {
        const parentDir = path.dirname(dirPath);
        deleteEmptyDirectoriesRecursively(parentDir, maxDepth - 1);
      }
    }
  } catch (error) {
    console.error(`Failed to check/remove directory ${dirPath}:`, error);
  }
}

/**
 * Reverts the most recent file moves from the database, restoring files to their original locations.
 * Displays recent moves, prompts for count if not provided, moves files back, and cleans up empty directories.
 *
 * @async
 * @function handleRevert
 * @param {number} [count] - Number of recent moves to revert (prompts if not provided)
 * @returns {Promise<void>}
 * @throws {Error} If file move operations fail (logged but continues with others)
 *
 * @example
 * // Revert last 5 moves
 * await handleRevert(5);
 * // Shows table of recent moves, reverts 5 files
 *
 * @example
 * // Interactive revert (prompts for count)
 * await handleRevert();
 * // Shows moves table, prompts "How many moves to revert?"
 *
 * @example
 * // Edge case: No moves in database
 * await handleRevert(10);
 * // Output: No moves to revert.
 *
 * @example
 * // Edge case: Count exceeds available moves
 * await handleRevert(100);
 * // Reverts all available moves
 *
 * @example
 * // Edge case: File move fails (target doesn't exist)
 * await handleRevert(1);
 * // Logs error but continues with other moves
 */
export async function handleRevert(count?: number) {
  console.log('🔄 Reverting last file moves...\n');

  const moves = getRecentMoves();
  if (moves.length === 0) {
    console.log('No moves to revert.');
    return;
  }

  console.log('Recent moves:');
  console.table(moves.map(m => ({
    'From': path.basename(m.original_path),
    'To': path.basename(m.new_path),
    'Time': m.timestamp
  })));

  if (!count) {
    const answer = await inquirer.prompt({
      type: 'number',
      name: 'count',
      message: 'How many moves to revert?',
      default: moves.length
    });
    count = answer.count;
  }

  const movesToRevert = moves.slice(0, count);

  for (const move of movesToRevert) {
    try {
      await fs.move(move.new_path, move.original_path, { overwrite: true });
      console.log(`Reverted: ${path.basename(move.new_path)} -> ${path.basename(move.original_path)}`);
    } catch (error) {
      console.error(`Failed to revert ${move.new_path}:`, error);
    }
  }

  // Collect all affected paths (unique original paths)
  const affectedPaths = new Set(movesToRevert.map(move => move.original_path));

  // Check affected folders and delete if empty recursively
  for (const filePath of affectedPaths) {
    const dirPath = path.dirname(filePath);
    deleteEmptyDirectoriesRecursively(dirPath, 2);
  }

  console.log('\n✅ Revert complete.');
}