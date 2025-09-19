import { describe, test, expect } from "bun:test";
import { scanMediaFiles } from "../src/core-data/scanner";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";

describe("scanMediaFiles", () => {
  test("should scan directory and find media files", async () => {
    // Create a temporary directory
    const tempDir = path.join(os.tmpdir(), "media-test-" + Date.now());
    await fs.ensureDir(tempDir);

    // Create some test files
    await fs.writeFile(path.join(tempDir, "movie.mp4"), "fake content");
    await fs.writeFile(path.join(tempDir, "tv.mkv"), "fake content");
    await fs.writeFile(path.join(tempDir, "not-media.txt"), "fake content");

    const files = await scanMediaFiles(tempDir);

    expect(files.length).toBe(2);
    expect(files.some(f => f.name === "movie")).toBe(true);
    expect(files.some(f => f.name === "tv")).toBe(true);

    // Cleanup
    await fs.remove(tempDir);
  });

  test("should return empty array for empty directory", async () => {
    const tempDir = path.join(os.tmpdir(), "empty-test-" + Date.now());
    await fs.ensureDir(tempDir);

    const files = await scanMediaFiles(tempDir);

    expect(files.length).toBe(0);

    // Cleanup
    await fs.remove(tempDir);
  });

  test("should handle subdirectories", async () => {
    const tempDir = path.join(os.tmpdir(), "subdir-test-" + Date.now());
    const subDir = path.join(tempDir, "subdir");
    await fs.ensureDir(subDir);

    await fs.writeFile(path.join(subDir, "nested.avi"), "fake content");

    const files = await scanMediaFiles(tempDir);

    expect(files.length).toBe(1);
    expect(files[0].name).toBe("nested");

    // Cleanup
    await fs.remove(tempDir);
  });
});