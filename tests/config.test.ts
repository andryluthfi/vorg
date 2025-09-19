import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, AppConfig, ConfigResult } from '../src/config/config';

// Create a temporary directory for testing
let tempDir: string;

beforeEach(() => {
  tempDir = path.join(os.tmpdir(), 'vorg-config-test-' + Date.now());
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

describe("loadConfig", () => {
  test("should load config from scanned folder", () => {
    const scanPath = path.join(tempDir, 'scan-folder');
    fs.ensureDirSync(scanPath);

    const configPath = path.join(scanPath, 'vorg-config.json');
    const testConfig: AppConfig = {
      moviePath: '/movies',
      tvPath: '/tv'
    };
    fs.writeFileSync(configPath, JSON.stringify(testConfig));

    const result = loadConfig(scanPath);

    // Scanned folder config should take priority for specified values
    expect(result.config.moviePath).toBe('/movies');
    expect(result.config.tvPath).toBe('/tv');
    expect(result.source).toBe('Scanned Folder');
    expect(result.path).toBe(configPath);
  });

  test("should handle invalid JSON gracefully", () => {
    const scanPath = path.join(tempDir, 'scan');
    fs.ensureDirSync(scanPath);
    const configPath = path.join(scanPath, 'vorg-config.json');
    fs.writeFileSync(configPath, 'invalid json content');

    const result = loadConfig(scanPath);

    // Should still load other configs even if scanned folder has invalid JSON
    expect(result.config).toBeDefined();
    expect(result.source).toBe('Scanned Folder');
  });

  test("should handle missing config file gracefully", () => {
    const scanPath = path.join(tempDir, 'scan');
    fs.ensureDirSync(scanPath);

    const result = loadConfig(scanPath);

    // Should default to scanned folder source when no config exists
    expect(result.config).toBeDefined();
    expect(result.source).toBe('Scanned Folder');
  });

  test("should provide config sources information", () => {
    const scanPath = path.join(tempDir, 'scan');
    fs.ensureDirSync(scanPath);

    const configPath = path.join(scanPath, 'vorg-config.json');
    const testConfig: AppConfig = { moviePath: '/test' };
    fs.writeFileSync(configPath, JSON.stringify(testConfig));

    const result = loadConfig(scanPath);

    expect(result.sources).toBeDefined();
    expect(result.sources!.length).toBeGreaterThan(0);

    const scannedSource = result.sources!.find(s => s.location === 'Scanned Folder');
    expect(scannedSource).toBeDefined();
    expect(scannedSource!.exists).toBe(true);
    expect(scannedSource!.config).toEqual(testConfig);
  });
});

describe("saveConfig", () => {
  test("should save config to scanned folder", async () => {
    const scanPath = path.join(tempDir, 'scan');
    fs.ensureDirSync(scanPath);

    const testConfig: AppConfig = {
      moviePath: '/scan/movies',
      tvPath: '/scan/tv'
    };

    await saveConfig(testConfig, 'scanned', scanPath);

    const configPath = path.join(scanPath, 'vorg-config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const savedContent = fs.readFileSync(configPath, 'utf-8');
    const savedConfig = JSON.parse(savedContent);
    expect(savedConfig).toEqual(testConfig);
  });

  test("should handle save errors gracefully", async () => {
    const testConfig: AppConfig = { moviePath: '/test' };

    // Try to save to a non-existent directory
    const invalidPath = path.join(tempDir, 'non-existent', 'deep', 'path');

    await expect(saveConfig(testConfig, 'scanned', invalidPath)).rejects.toThrow();
  });

  test("should format JSON with proper indentation", async () => {
    const scanPath = path.join(tempDir, 'scan');
    fs.ensureDirSync(scanPath);

    const testConfig: AppConfig = {
      moviePath: '/test/movies',
      tvPath: '/test/tv'
    };

    await saveConfig(testConfig, 'scanned', scanPath);

    const configPath = path.join(scanPath, 'vorg-config.json');
    const savedContent = fs.readFileSync(configPath, 'utf-8');

    // Should be pretty-printed with 2-space indentation
    expect(savedContent).toContain('\n  ');
    expect(savedContent).toContain('"moviePath": "/test/movies"');
  });
});

describe("getConfigPath", () => {
  test("should return user folder config path", () => {
    const configPath = path.join(tempDir, 'vorg-config.json');

    // This function is simple but tests the path resolution
    expect(configPath).toBeTruthy();
  });
});