import * as fs from 'fs-extra';
import * as path from 'path';
import { MediaFile } from '../core-data/scanner';
import { MediaMetadata, EnrichedMetadata, generateNewName, parseFilename, sanitizeFilename } from '../core-data/parser';
import { saveFileMove } from '../infrastructure/database';

export interface ProcessedFile {
  originalPath: string;
  newPath: string;
  metadata: EnrichedMetadata;
  action: 'move' | 'skip' | 'overwrite' | 'preview';
}

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
  const videoFiles: { file: MediaFile; metadata: EnrichedMetadata; index: number }[] = [];
  const subtitleFiles: { file: MediaFile; index: number }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type === 'video') {
      videoFiles.push({ file, metadata: metadatas[i], index: i });
    } else if (file.type === 'subtitle') {
      subtitleFiles.push({ file, index: i });
    }
  }

  // Process video files first
  for (const { file, metadata, index } of videoFiles) {
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
  for (const { file, index } of subtitleFiles) {
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

// Helper function to check if subtitle name is similar to video name
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
         cleanSubtitle.replace(/[\.\-\s]/g, '').includes(cleanVideo.replace(/[\.\-\s]/g, '')) ||
         cleanVideo.replace(/[\.\-\s]/g, '').includes(cleanSubtitle.replace(/[\.\-\s]/g, ''));
}