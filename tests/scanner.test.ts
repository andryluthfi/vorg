import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { scanMediaFiles, MediaFile } from '../src/core-data/scanner';
import { AppConfig } from '../src/config/config';

// Create a temporary directory for testing
let tempDir: string;

beforeEach(() => {
  tempDir = path.join(os.tmpdir(), 'vorg-scanner-test-' + Date.now());
  fs.ensureDirSync(tempDir);
});

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.removeSync(tempDir);
  }
});

// Mock console methods to avoid cluttering test output
const originalConsole = { ...console };
beforeEach(() => {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

describe("scanMediaFiles", () => {
  test("should return empty array for empty directory", async () => {
    const result = await scanMediaFiles(tempDir);
    expect(result).toEqual([]);
  });

  test("should scan video files", async () => {
    // Create test video files
    const videoFiles = [
      'movie.mp4',
      'show.mkv',
      'film.avi',
      'video.mov',
      'clip.wmv',
      'stream.flv',
      'web.webm'
    ];

    for (const file of videoFiles) {
      fs.writeFileSync(path.join(tempDir, file), 'fake video content');
    }

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(videoFiles.length);
    for (const file of result) {
      expect(file.type).toBe('video');
      expect(videoFiles).toContain(file.name + file.extension);
    }
  });

  test("should scan subtitle files", async () => {
    // Create test subtitle files
    const subtitleFiles = [
      'movie.srt',
      'show.sub',
      'film.ssa',
      'video.ass',
      'clip.vtt',
      'stream.idx',
      'web.sup',
      'other.mks',
      'final.ttml'
    ];

    for (const file of subtitleFiles) {
      fs.writeFileSync(path.join(tempDir, file), 'fake subtitle content');
    }

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(subtitleFiles.length);
    for (const file of result) {
      expect(file.type).toBe('subtitle');
      expect(subtitleFiles).toContain(file.name + file.extension);
    }
  });

  test("should ignore sample files", async () => {
    // Create regular video and sample video
    fs.writeFileSync(path.join(tempDir, 'movie.mp4'), 'regular video');
    fs.writeFileSync(path.join(tempDir, 'sample.mp4'), 'sample video');

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('movie');
    expect(result[0].type).toBe('video');
  });

  test("should scan mixed video and subtitle files", async () => {
    // Create mixed files
    const files = [
      'movie.mp4',
      'movie.srt',
      'show.mkv',
      'show.eng.srt',
      'document.pdf', // Should be ignored
      'readme.txt'    // Should be ignored
    ];

    for (const file of files) {
      fs.writeFileSync(path.join(tempDir, file), 'content');
    }

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(4); // Only media files

    const videoFiles = result.filter(f => f.type === 'video');
    const subtitleFiles = result.filter(f => f.type === 'subtitle');

    expect(videoFiles).toHaveLength(2);
    expect(subtitleFiles).toHaveLength(2);
  });

  test("should scan recursively in subdirectories", async () => {
    // Create nested structure
    const subDir1 = path.join(tempDir, 'movies');
    const subDir2 = path.join(tempDir, 'tv-shows', 'season1');
    fs.ensureDirSync(subDir1);
    fs.ensureDirSync(subDir2);

    fs.writeFileSync(path.join(tempDir, 'root.mp4'), 'root video');
    fs.writeFileSync(path.join(subDir1, 'movie.mp4'), 'movie video');
    fs.writeFileSync(path.join(subDir2, 'episode.mkv'), 'episode video');

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(3);
    const paths = result.map(f => f.path);
    expect(paths).toContain(path.join(tempDir, 'root.mp4'));
    expect(paths).toContain(path.join(subDir1, 'movie.mp4'));
    expect(paths).toContain(path.join(subDir2, 'episode.mkv'));
  });

  test("should respect includeSubtitles config", async () => {
    // Create video and subtitle files
    fs.writeFileSync(path.join(tempDir, 'movie.mp4'), 'video');
    fs.writeFileSync(path.join(tempDir, 'movie.srt'), 'subtitle');

    const config: AppConfig = { includeSubtitles: false };
    const result = await scanMediaFiles(tempDir, config);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('video');
    expect(result[0].name).toBe('movie');
  });

  test("should include subtitles by default", async () => {
    // Create video and subtitle files
    fs.writeFileSync(path.join(tempDir, 'movie.mp4'), 'video');
    fs.writeFileSync(path.join(tempDir, 'movie.srt'), 'subtitle');

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(2);
    const types = result.map(f => f.type);
    expect(types).toContain('video');
    expect(types).toContain('subtitle');
  });

  test("should handle files with multiple extensions correctly", async () => {
    // Create files with complex extensions
    fs.writeFileSync(path.join(tempDir, 'movie.2023.1080p.mp4'), 'video');
    fs.writeFileSync(path.join(tempDir, 'movie.eng.forced.srt'), 'subtitle');

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(2);
    const videoFile = result.find(f => f.type === 'video');
    const subtitleFile = result.find(f => f.type === 'subtitle');

    expect(videoFile?.name).toBe('movie.2023.1080p');
    expect(videoFile?.extension).toBe('.mp4');
    expect(subtitleFile?.name).toBe('movie.eng.forced');
    expect(subtitleFile?.extension).toBe('.srt');
  });

  test("should handle case insensitive extensions", async () => {
    // Create files with mixed case extensions
    fs.writeFileSync(path.join(tempDir, 'movie.MP4'), 'video');
    fs.writeFileSync(path.join(tempDir, 'movie.SRT'), 'subtitle');

    const result = await scanMediaFiles(tempDir);

    expect(result).toHaveLength(2);
    const types = result.map(f => f.type);
    expect(types).toContain('video');
    expect(types).toContain('subtitle');
  });

  test("should ignore non-media files", async () => {
    const nonMediaFiles = [
      'document.pdf',
      'readme.txt',
      'image.jpg',
      'music.mp3',
      'archive.zip',
      'executable.exe'
    ];

    for (const file of nonMediaFiles) {
      fs.writeFileSync(path.join(tempDir, file), 'content');
    }

    const result = await scanMediaFiles(tempDir);
    expect(result).toHaveLength(0);
  });

  test("should handle directories with many files efficiently", async () => {
    // Create many files to test performance
    const fileCount = 100;
    for (let i = 0; i < fileCount; i++) {
      fs.writeFileSync(path.join(tempDir, `movie${i}.mp4`), 'video content');
      fs.writeFileSync(path.join(tempDir, `movie${i}.srt`), 'subtitle content');
    }

    const result = await scanMediaFiles(tempDir);
    expect(result).toHaveLength(fileCount * 2); // video + subtitle for each
  });

  test("should handle scan errors gracefully", async () => {
    // Create a directory that might cause issues
    const problematicDir = path.join(tempDir, 'problematic');
    fs.ensureDirSync(problematicDir);

    // Create a file that exists
    fs.writeFileSync(path.join(tempDir, 'good.mp4'), 'content');

    const result = await scanMediaFiles(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('good');
  });
});