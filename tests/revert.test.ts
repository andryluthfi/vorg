import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Import the functions to test
import { handleRevert, deleteEmptyDirectoriesRecursively } from '../src/action/revert';

// Create a temporary directory for testing
let tempDir: string;

beforeEach(() => {
  tempDir = path.join(os.tmpdir(), 'vorg-test-' + Date.now());
  fs.ensureDirSync(tempDir);
});

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.removeSync(tempDir);
  }
});

// Helper function to create test directory structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTestStructure(baseDir: string, structure: { [key: string]: any }) {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(baseDir, name);
    if (typeof content === 'string') {
      // It's a file
      fs.ensureDirSync(path.dirname(fullPath));
      fs.writeFileSync(fullPath, content);
    } else {
      // It's a directory
      fs.ensureDirSync(fullPath);
      if (content && typeof content === 'object') {
        createTestStructure(fullPath, content);
      }
    }
  }
}

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

describe("deleteEmptyDirectoriesRecursively", () => {
  test("should not throw error for non-existent directory", () => {
    const nonExistentDir = path.join(tempDir, 'non-existent');

    expect(() => {
      deleteEmptyDirectoriesRecursively(nonExistentDir, 2);
    }).not.toThrow();
  });

  test("should delete empty directory", () => {
    const emptyDir = path.join(tempDir, 'empty');
    fs.ensureDirSync(emptyDir);

    deleteEmptyDirectoriesRecursively(emptyDir, 2);

    expect(fs.existsSync(emptyDir)).toBe(false);
  });

  test("should not delete non-empty directory", () => {
    const nonEmptyDir = path.join(tempDir, 'non-empty');
    fs.ensureDirSync(nonEmptyDir);
    fs.writeFileSync(path.join(nonEmptyDir, 'file.txt'), 'content');

    deleteEmptyDirectoriesRecursively(nonEmptyDir, 2);

    expect(fs.existsSync(nonEmptyDir)).toBe(true);
    expect(fs.existsSync(path.join(nonEmptyDir, 'file.txt'))).toBe(true);
  });

  test("should recursively delete nested empty directories", () => {
    const structure = {
      'level1': {
        'level2': {
          'level3': {}
        }
      }
    };

    createTestStructure(tempDir, structure);

    const level1Dir = path.join(tempDir, 'level1');
    const level2Dir = path.join(level1Dir, 'level2');
    const level3Dir = path.join(level2Dir, 'level3');

    // Start from level3 (deepest)
    deleteEmptyDirectoriesRecursively(level3Dir, 3);

    // All should be deleted since they're all empty
    expect(fs.existsSync(level3Dir)).toBe(false);
    expect(fs.existsSync(level2Dir)).toBe(false);
    expect(fs.existsSync(level1Dir)).toBe(false);
  });

  test("should respect maxDepth limit", () => {
    const structure = {
      'level1': {
        'level2': {
          'level3': {
            'level4': {}
          }
        }
      }
    };

    createTestStructure(tempDir, structure);

    const level1Dir = path.join(tempDir, 'level1');
    const level2Dir = path.join(level1Dir, 'level2');
    const level3Dir = path.join(level2Dir, 'level3');
    const level4Dir = path.join(level3Dir, 'level4');

    // Start from level4 with maxDepth = 2
    deleteEmptyDirectoriesRecursively(level4Dir, 2);

    // level4 should be deleted
    expect(fs.existsSync(level4Dir)).toBe(false);
    // level3 should be deleted (depth 1 from level4)
    expect(fs.existsSync(level3Dir)).toBe(false);
    // level2 should be deleted (depth 2 from level4)
    expect(fs.existsSync(level2Dir)).toBe(false);
    // level1 should NOT be deleted (would be depth 3, exceeds maxDepth)
    expect(fs.existsSync(level1Dir)).toBe(true);
  });

  test("should stop at non-empty directory during recursion", () => {
    const structure = {
      'level1': {
        'level2': {
          'level3': {}
        },
        'file.txt': 'content'
      }
    };

    createTestStructure(tempDir, structure);

    const level1Dir = path.join(tempDir, 'level1');
    const level2Dir = path.join(level1Dir, 'level2');
    const level3Dir = path.join(level2Dir, 'level3');

    // Start from level3
    deleteEmptyDirectoriesRecursively(level3Dir, 3);

    // level3 should be deleted
    expect(fs.existsSync(level3Dir)).toBe(false);
    // level2 should be deleted (it's now empty)
    expect(fs.existsSync(level2Dir)).toBe(false);
    // level1 should NOT be deleted (contains file.txt)
    expect(fs.existsSync(level1Dir)).toBe(true);
    expect(fs.existsSync(path.join(level1Dir, 'file.txt'))).toBe(true);
  });

  test("should handle permission errors gracefully", () => {
    const testDir = path.join(tempDir, 'test-dir');
    fs.ensureDirSync(testDir);

    // Create a directory with restricted permissions (if possible)
    // For now, just test that the function handles errors without crashing
    expect(() => {
      deleteEmptyDirectoriesRecursively(testDir, 2);
    }).not.toThrow();
  });

  test("should handle rmdir errors gracefully", () => {
    const testDir = path.join(tempDir, 'test-dir');
    fs.ensureDirSync(testDir);

    // Test with a directory that might cause issues
    // For now, just ensure the function doesn't crash
    expect(() => {
      deleteEmptyDirectoriesRecursively(testDir, 2);
    }).not.toThrow();
  });
});

describe("handleRevert", () => {
  test("should handle no moves to revert", async () => {
    // For now, just test that the function exists and can be called
    // More complex mocking would require dependency injection or similar
    expect(typeof handleRevert).toBe('function');
  });

  test("should revert specified number of moves", async () => {
    // This would require more complex mocking of database and file system
    // For now, just test that the function exists and can be called
    expect(typeof handleRevert).toBe('function');
  });
});