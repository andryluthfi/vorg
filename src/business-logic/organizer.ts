import * as fs from 'fs-extra';
import * as path from 'path';
import { MediaFile } from '../core-data/scanner';
import { EnrichedMetadata, generateNewName, parseFilename, sanitizeFilename } from '../core-data/parser';
import { saveFileMove } from '../infrastructure/database';

export interface ProcessedFile {
  originalPath: string;
  newPath: string;
  metadata: EnrichedMetadata;
  action: 'move' | 'skip' | 'overwrite' | 'preview';
}

/**
 * Organizes media files into proper directory structure based on enriched metadata.
 * Processes video files and attempts to match subtitle files to corresponding videos.
 * Handles file conflicts through callback and supports preview mode.
 *
 * Organization rules:
 * - Movies: /moviePath/MovieTitle (Year)/MovieTitle (Year).ext
 * - TV Shows: /tvPath/ShowTitle (Year)/Season X/ShowTitle - Season X Episode Y.ext
 * - Subtitles: Placed in same directory as matching video file
 *
 * @async
 * @function organizeFiles
 * @param {MediaFile[]} files - Array of media files to organize
 * @param {EnrichedMetadata[]} metadatas - Corresponding enriched metadata for video files
 * @param {string} moviePath - Destination root path for movies
 * @param {string} tvPath - Destination root path for TV shows
 * @param {(original: string, newPath: string) => Promise<'skip' | 'overwrite'>} onConflict - Callback for handling file conflicts
 * @param {boolean} [preview=false] - If true, only preview changes without moving files
 * @returns {Promise<ProcessedFile[]>} Array of processed files with their actions and paths
 * @throws {Error} If file move operations fail (logged but continues with other files)
 *
 * @example
 * const files = [{ name: 'Movie.2020.avi', path: '/old/Movie.2020.avi', type: 'video' }];
 * const metadatas = [{ type: 'movie', title: 'Movie', year: 2020 }];
 * const results = await organizeFiles(files, metadatas, '/movies', '/tv', async () => 'overwrite');
 * // Moves file to /movies/Movie (2020)/Movie (2020).avi
 *
 * @example
 * // Preview mode
 * const results = await organizeFiles(files, metadatas, '/movies', '/tv', async () => 'skip', true);
 * // Returns preview results without moving files
 *
 * @example
 * // Edge case: Subtitle without matching video
 * const subtitleFiles = [{ name: 'Movie.srt', path: '/old/Movie.srt', type: 'subtitle' }];
 * const results = await organizeFiles(subtitleFiles, [], '/movies', '/tv', async () => 'skip');
 * // Subtitle marked as skipped
 *
 * @example
 * // Edge case: File conflict
 * const results = await organizeFiles(files, metadatas, '/movies', '/tv',
 *   async (orig, newPath) => { console.log('Conflict!'); return 'overwrite'; });
 * // Calls onConflict callback for resolution
 */
export async function organizeFiles(
  files: MediaFile[],
  metadatas: EnrichedMetadata[],
  moviePath: string,
  tvPath: string,
  onConflict: (original: string, newPath: string) => Promise<'skip' | 'overwrite'>,
  preview: boolean = false
): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  // Separate video and subtitle files
  const videoFiles: { file: MediaFile; metadata: EnrichedMetadata }[] = [];
  const subtitleFiles: { file: MediaFile }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type === 'video') {
      videoFiles.push({ file, metadata: metadatas[i] });
    } else if (file.type === 'subtitle') {
      subtitleFiles.push({ file });
    }
  }

  // Process video files first
  for (const { file, metadata } of videoFiles) {
    let destDir: string;
    let baseName: string;

    if (metadata.type === 'movie') {
      destDir = path.join(moviePath, generateNewName(metadata));
      baseName = generateNewName(metadata); // For movies, filename is same as folder name
    } else {
      // TV show
      destDir = path.join(tvPath, sanitizeFilename(metadata.title), `Season ${metadata.season}`);
      baseName = generateNewName(metadata);
    }

    if (!preview) {
      await fs.ensureDir(destDir);
    }

    const newName = `${baseName}${file.extension}`;
    const newPath = path.join(destDir, newName);

    let action: 'move' | 'skip' | 'overwrite' | 'preview' = preview ? 'preview' : 'move';

    if (await fs.pathExists(newPath)) {
      if (preview) {
        action = 'overwrite'; // In preview, indicate it would overwrite
      } else {
        const conflictAction = await onConflict(file.path, newPath);
        if (conflictAction === 'skip') {
          action = 'skip';
        } else {
          action = 'overwrite';
        }
      }
    }

    if (!preview && action !== 'skip') {
      try {
        await fs.move(file.path, newPath, { overwrite: action === 'overwrite' });
        saveFileMove(file.path, newPath);
      } catch (error) {
        console.error(`Failed to move ${file.path} to ${newPath}:`, error);
        continue;
      }
    }

    results.push({
      originalPath: file.path,
      newPath,
      metadata,
      action
    });
  }

  // Process subtitle files
  for (const { file } of subtitleFiles) {
    // Try to find matching video file
    const subtitleMetadata = parseFilename(file.name);
    let matchedVideo: { file: MediaFile; metadata: EnrichedMetadata } | null = null;

    // Look for video files with similar names
    for (const video of videoFiles) {
      if (isSimilarName(file.name, video.file.name)) {
        matchedVideo = video;
        break;
      }
    }

    if (matchedVideo) {
      // Use the same destination as the matched video
      let destDir: string;
      let baseName: string;

      if (matchedVideo.metadata.type === 'movie') {
        destDir = path.join(moviePath, generateNewName(matchedVideo.metadata));
        baseName = generateNewName(matchedVideo.metadata);
      } else {
        destDir = path.join(tvPath, sanitizeFilename(matchedVideo.metadata.title), `Season ${matchedVideo.metadata.season}`);
        baseName = generateNewName(matchedVideo.metadata);
      }

      if (!preview) {
        if (!preview) {
          await fs.ensureDir(destDir);
        }
      }

      const newName = `${baseName}${file.extension}`;
      const newPath = path.join(destDir, newName);

      let action: 'move' | 'skip' | 'overwrite' | 'preview' = preview ? 'preview' : 'move';

      if (await fs.pathExists(newPath)) {
        if (preview) {
          action = 'overwrite';
        } else {
          const conflictAction = await onConflict(file.path, newPath);
          if (conflictAction === 'skip') {
            action = 'skip';
          } else {
            action = 'overwrite';
          }
        }
      }

      if (!preview && action !== 'skip') {
        try {
          await fs.move(file.path, newPath, { overwrite: action === 'overwrite' });
          saveFileMove(file.path, newPath);
        } catch (error) {
          console.error(`Failed to move ${file.path} to ${newPath}:`, error);
          continue;
        }
      }

      results.push({
        originalPath: file.path,
        newPath,
        metadata: matchedVideo.metadata, // Use video's metadata for subtitles
        action
      });
    } else {
      // No matching video found, skip subtitle
      results.push({
        originalPath: file.path,
        newPath: file.path, // Keep original path
        metadata: subtitleMetadata,
        action: 'skip'
      });
    }
  }

  return results;
}

/**
 * Determines if a subtitle filename is similar to a video filename for matching purposes.
 * Removes common subtitle language codes and compares cleaned names.
 * Used to associate subtitle files with their corresponding video files.
 *
 * @function isSimilarName
 * @param {string} subtitleName - Subtitle filename to compare
 * @param {string} videoName - Video filename to compare against
 * @returns {boolean} True if names are considered similar
 *
 * @example
 * isSimilarName('Movie.2020.eng.srt', 'Movie.2020.avi'); // true
 * isSimilarName('Different.eng.srt', 'Movie.2020.avi'); // false
 *
 * @example
 * // Edge case: Language codes removed
 * isSimilarName('Movie.2020.english.srt', 'Movie.2020.avi'); // true
 *
 * @example
 * // Edge case: Special characters normalized
 * isSimilarName('Movie-2020.eng.srt', 'Movie.2020.avi'); // true
 *
 * @example
 * // Edge case: Empty strings
 * isSimilarName('', 'Movie.avi'); // false
 */
function isSimilarName(subtitleName: string, videoName: string): boolean {
  // Remove common subtitle suffixes and compare
  const cleanSubtitle = subtitleName
    .toLowerCase()
    .replace(/\.(eng|english|spa|spanish|fre|french|ger|german|ita|italian|por|portuguese|rus|russian|jpn|japanese|kor|korean|chi|chinese|ara|arabic|hin|hindi)(\..*)?$/, '')
    .replace(/\.(sdh|forced|cc)(\..*)?$/, '')
    .trim();

  const cleanVideo = videoName.toLowerCase().trim();

  // Check if subtitle name contains video name or vice versa
  return cleanSubtitle.includes(cleanVideo) || cleanVideo.includes(cleanSubtitle) ||
         // Check for common variations
         cleanSubtitle.replace(/[\s.-]/g, '').includes(cleanVideo.replace(/[\s.-]/g, '')) ||
         cleanVideo.replace(/[\s.-]/g, '').includes(cleanSubtitle.replace(/[\s.-]/g, ''));
}