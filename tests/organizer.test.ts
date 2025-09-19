import { describe, test, expect } from "bun:test";
import { organizeFiles } from "../src/business-logic/organizer";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";

describe("organizeFiles", () => {
  test("should organize movie files", async () => {
    const tempDir = path.join(os.tmpdir(), "organizer-test-" + Date.now());
    const movieDir = path.join(tempDir, "Movies");
    await fs.ensureDir(movieDir);

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4"
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true);

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("preview");
    expect(results[0].newPath).toContain("Test Movie (2020).mp4");

    await fs.remove(tempDir);
  });

  test("should organize TV show files", async () => {
    const tempDir = path.join(os.tmpdir(), "organizer-test-" + Date.now());
    const tvDir = path.join(tempDir, "TV");
    await fs.ensureDir(tvDir);

    const files = [
      {
        path: "/fake/path/episode.mp4",
        name: "Test Show S01E01",
        extension: ".mp4"
      }
    ];

    const metadatas = [
      {
        title: "Test Show",
        season: 1,
        episode: 1,
        type: "tv" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, "/fake/movies", tvDir, async () => "skip", true);

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("preview");
    expect(results[0].newPath).toContain("Test Show");
    expect(results[0].newPath).toContain("Season 1");

    await fs.remove(tempDir);
  });

  test("should handle conflict resolution", async () => {
    const tempDir = path.join(os.tmpdir(), "organizer-test-" + Date.now());
    const movieDir = path.join(tempDir, "Movies");
    await fs.ensureDir(movieDir);

    // Create a file that would conflict
    const destDir = path.join(movieDir, "Test Movie (2020)");
    await fs.ensureDir(destDir);
    const conflictFile = path.join(destDir, "Test Movie (2020).mp4");
    await fs.writeFile(conflictFile, "existing content");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4"
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true);

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("overwrite"); // In preview mode, conflicts are marked as overwrite

    await fs.remove(tempDir);
  });
});