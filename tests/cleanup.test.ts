import { describe, test, expect, beforeEach, afterEach, jest } from "bun:test";
import * as fs from 'fs-extra';
import * as path from 'path';
import { scanForCleanup, displayCleanupPreview } from '../src/action/cleanup';

describe('Cleanup functionality', () => {
  const testDir = path.join(__dirname, 'test-cleanup');
  const torrentDir = path.join(testDir, 'torrent-downloads');
  const emptyDir = path.join(testDir, 'empty-folder');
  const sampleDir = path.join(torrentDir, 'Sample');

  beforeEach(async () => {
    // Create test directory structure
    await fs.ensureDir(testDir);
    await fs.ensureDir(torrentDir);
    await fs.ensureDir(emptyDir);
    await fs.ensureDir(sampleDir);

    // Create test files
    await fs.writeFile(path.join(torrentDir, 'movie.torrent'), 'torrent data');
    await fs.writeFile(path.join(torrentDir, 'info.nfo'), 'nfo data');
    await fs.writeFile(path.join(torrentDir, 'cover.jpg'), 'jpg data');
    await fs.writeFile(path.join(torrentDir, 'readme.txt'), 'txt data');
    await fs.writeFile(path.join(torrentDir, 'movie.mp4'), 'video data'); // Should not be deleted
    await fs.writeFile(path.join(torrentDir, 'movie.srt'), 'subtitle data'); // Should not be deleted
    await fs.writeFile(path.join(sampleDir, 'sample.avi'), 'sample video data');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should identify empty folders', async () => {
    const result = scanForCleanup(testDir);

    expect(result.emptyFolders.length).toBeGreaterThan(0);
    expect(result.emptyFolders.some(f => f.path.includes('empty-folder'))).toBe(true);
  });

  test('should identify trash files in torrent folders', async () => {
    const result = scanForCleanup(testDir);

    expect(result.trashFiles.length).toBeGreaterThan(0);
    expect(result.trashFiles.some(f => f.path.endsWith('.torrent'))).toBe(true);
    expect(result.trashFiles.some(f => f.path.endsWith('.nfo'))).toBe(true);
    expect(result.trashFiles.some(f => f.path.endsWith('.jpg'))).toBe(true);
    expect(result.trashFiles.some(f => f.path.endsWith('.txt'))).toBe(true);
  });

  test('should identify sample folders', async () => {
    const result = scanForCleanup(testDir);

    expect(result.sampleFolders.length).toBeGreaterThan(0);
    expect(result.sampleFolders.some(f => f.path.includes('Sample'))).toBe(true);
  });

  test('should not identify video files as trash', async () => {
    const result = scanForCleanup(testDir);

    expect(result.trashFiles.some(f => f.path.endsWith('.mp4'))).toBe(false);
  });

  test('should not identify subtitle files as trash', async () => {
    const result = scanForCleanup(testDir);

    expect(result.trashFiles.some(f => f.path.endsWith('.srt'))).toBe(false);
  });

  test('should detect torrent folders correctly', async () => {
    const result = scanForCleanup(testDir);

    // Should find trash files since torrentDir contains .torrent files
    expect(result.trashFiles.length).toBeGreaterThan(0);
  });

  test('displayCleanupPreview should not throw errors', async () => {
    const result = scanForCleanup(testDir);

    // Mock console.log to avoid output during tests
    const originalLog = console.log;
    console.log = jest.fn();

    expect(() => displayCleanupPreview(result)).not.toThrow();

    // Restore console.log
    console.log = originalLog;
  });

  test('should handle non-existent directories gracefully', async () => {
    const nonExistentDir = path.join(__dirname, 'non-existent');
    const result = scanForCleanup(nonExistentDir);

    expect(result.emptyFolders.length).toBe(0);
    expect(result.trashFiles.length).toBe(0);
    expect(result.sampleFolders.length).toBe(0);
  });
});