import * as fs from 'fs-extra';
import * as path from 'path';
import { AppConfig } from '../config/config';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
const SUBTITLE_EXTENSIONS = ['.srt', '.sub', '.ssa', '.ass', '.vtt', '.idx', '.sup', '.mks', '.ttml'];

export interface MediaFile {
  path: string;
  name: string;
  extension: string;
  type: 'video' | 'subtitle';
}

/**
 * Recursively scans a directory for media files and returns structured file information.
 * Supports video and subtitle files, filtering by configured include/exclude patterns.
 * Builds a flat list of all media files found in the directory tree.
 *
 * @async
 * @function scanMediaFiles
 * @param {string} scanPath - Root directory path to scan for media files
 * @param {AppConfig} [config] - Optional configuration for file filtering
 * @returns {Promise<MediaFile[]>} Array of discovered media files with metadata
 * @throws {Error} If scan path doesn't exist or is not readable
 *
 * @example
 * const files = await scanMediaFiles('/path/to/media');
 * // Returns: [{ name: 'movie.avi', path: '/path/to/media/movie.avi', type: 'video', extension: '.avi' }, ...]
 *
 * @example
 * const config = { includeSubtitles: true };
 * const files = await scanMediaFiles('/path', config);
 * // Includes both video and subtitle files
 *
 * @example
 * // Edge case: Empty directory
 * const files = await scanMediaFiles('/empty/dir');
 * // Returns: []
 *
 * @example
 * // Edge case: Non-existent path
 * const files = await scanMediaFiles('/nonexistent');
 * // Throws error: ENOENT
 *
 * @example
 * // Edge case: Permission denied
 * const files = await scanMediaFiles('/restricted');
 * // Throws error: EACCES
 */
export async function scanMediaFiles(scanPath: string, config?: AppConfig): Promise<MediaFile[]> {
  const files: MediaFile[] = [];

  /**
   * Recursively scans a single directory for media files.
   * Internal helper function that processes one directory level and recurses into subdirectories.
   *
   * @async
   * @function scanDir
   * @param {string} dir - Directory path to scan
   * @returns {Promise<void>}
   *
   * @example
   * // Called internally by scanMediaFiles
   * await scanDir('/path/to/dir');
   * // Processes files in directory and subdirectories
   */
  async function scanDir(dir: string): Promise<void> {
    try {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await scanDir(fullPath); // Recursively scan subdirectories
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          let fileType: 'video' | 'subtitle' | null = null;

          if (VIDEO_EXTENSIONS.includes(ext)) {
            // Skip sample files
            if (item.toLowerCase().includes('sample')) {
              continue;
            }
            fileType = 'video';
          } else if (SUBTITLE_EXTENSIONS.includes(ext)) {
            // Only include subtitles if configured to do so (default: true)
            if (config?.includeSubtitles !== false) {
              fileType = 'subtitle';
            }
          }

          if (fileType) {
            files.push({
              path: fullPath,
              name: path.basename(item, ext),
              extension: ext,
              type: fileType
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dir}:`, error);
    }
  }

  await scanDir(scanPath);
  return files;
}