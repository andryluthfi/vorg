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

export async function scanMediaFiles(scanPath: string, config?: AppConfig): Promise<MediaFile[]> {
  const files: MediaFile[] = [];

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