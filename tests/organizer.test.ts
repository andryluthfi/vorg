import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { organizeFiles } from "../src/business-logic/organizer";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";

// Create a temporary directory for testing
let tempDir: string;

beforeEach(() => {
  tempDir = path.join(os.tmpdir(), 'vorg-organizer-test-' + Date.now());
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
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

describe("organizeFiles", () => {
  test("should organize movie files with proper folder structure", async () => {
    const movieDir = path.join(tempDir, "Movies");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("preview");
    expect(results[0].newPath).toContain("Test Movie (2020)");
    expect(results[0].newPath).toContain("Test Movie (2020).mp4");
    expect(results[0].originalPath).toBe("/fake/path/movie.mp4");
  });

  test("should organize TV show files with season folder structure", async () => {
    const tvDir = path.join(tempDir, "TV");

    const files = [
      {
        path: "/fake/path/episode.mp4",
        name: "Test Show S01E01",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Show",
        season: 1,
        episode: 1,
        episodeTitle: "Pilot",
        type: "tv" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, "/fake/movies", tvDir, async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("preview");
    expect(results[0].newPath).toContain("Test Show");
    expect(results[0].newPath).toContain("Season 1");
    expect(results[0].newPath).toContain("Test Show - Season 1 Episode 1 - Pilot.mp4");
  });

  test("should match subtitle files with video files", async () => {
    const movieDir = path.join(tempDir, "Movies");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4",
        type: "video" as const
      },
      {
        path: "/fake/path/movie.eng.srt",
        name: "Test Movie.eng",
        extension: ".srt",
        type: "subtitle" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      },
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(2);

    // Video file result
    const videoResult = results.find(r => r.originalPath.includes('.mp4'));
    expect(videoResult?.action).toBe("preview");
    expect(videoResult?.newPath).toContain("Test Movie (2020).mp4");

    // Subtitle file result
    const subtitleResult = results.find(r => r.originalPath.includes('.srt'));
    expect(subtitleResult?.action).toBe("preview");
    expect(subtitleResult?.newPath).toContain("Test Movie (2020).srt");
  });

  test("should skip subtitle files without matching video", async () => {
    const movieDir = path.join(tempDir, "Movies");

    const files = [
      {
        path: "/fake/path/subtitle.eng.srt",
        name: "subtitle.eng",
        extension: ".srt",
        type: "subtitle" as const
      }
    ];

    const metadatas = [
      {
        title: "Unrelated Subtitle",
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("skip");
    expect(results[0].newPath).toBe("/fake/path/subtitle.eng.srt"); // Should keep original path
  });

  test("should handle conflict resolution in preview mode", async () => {
    const movieDir = path.join(tempDir, "Movies");

    // Create a file that would conflict
    const destDir = path.join(movieDir, "Test Movie (2020)");
    fs.ensureDirSync(destDir);
    const conflictFile = path.join(destDir, "Test Movie (2020).mp4");
    fs.writeFileSync(conflictFile, "existing content");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("overwrite"); // In preview mode, conflicts are marked as overwrite
  });

  test("should handle conflict resolution with skip action", async () => {
    const movieDir = path.join(tempDir, "Movies");

    // Create a file that would conflict
    const destDir = path.join(movieDir, "Test Movie (2020)");
    fs.ensureDirSync(destDir);
    const conflictFile = path.join(destDir, "Test Movie (2020).mp4");
    fs.writeFileSync(conflictFile, "existing content");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", false, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("skip");
  });

  test("should handle conflict resolution with overwrite action", async () => {
    const movieDir = path.join(tempDir, "Movies");

    // Create a file that would conflict
    const destDir = path.join(movieDir, "Test Movie (2020)");
    fs.ensureDirSync(destDir);
    const conflictFile = path.join(destDir, "Test Movie (2020).mp4");
    fs.writeFileSync(conflictFile, "existing content");

    // Create a real source file
    const sourceDir = path.join(tempDir, "source");
    fs.ensureDirSync(sourceDir);
    const sourceFile = path.join(sourceDir, "movie.mp4");
    fs.writeFileSync(sourceFile, "test movie content");

    const files = [
      {
        path: sourceFile,
        name: "Test Movie",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "overwrite", false, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("overwrite");

    // Verify the file was actually moved and overwrote the existing one
    const finalFile = path.join(destDir, "Test Movie (2020).mp4");
    expect(fs.existsSync(finalFile)).toBe(true);
    expect(fs.readFileSync(finalFile, 'utf-8')).toBe("test movie content");
  });

  test("should process multiple files of different types", async () => {
    const movieDir = path.join(tempDir, "Movies");
    const tvDir = path.join(tempDir, "TV");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test Movie",
        extension: ".mp4",
        type: "video" as const
      },
      {
        path: "/fake/path/movie.eng.srt",
        name: "Test Movie.eng",
        extension: ".srt",
        type: "subtitle" as const
      },
      {
        path: "/fake/path/episode.mp4",
        name: "Test Show S01E01",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      },
      {
        title: "Test Movie",
        year: 2020,
        type: "movie" as const
      },
      {
        title: "Test Show",
        season: 1,
        episode: 1,
        episodeTitle: "Test Episode",
        type: "tv" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, tvDir, async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(3);

    // Check movie video file
    const movieVideo = results.find(r => r.originalPath.includes('movie.mp4'));
    expect(movieVideo?.action).toBe("preview");
    expect(movieVideo?.newPath).toContain("Test Movie (2020).mp4");

    // Check movie subtitle file
    const movieSubtitle = results.find(r => r.originalPath.includes('.srt'));
    expect(movieSubtitle?.action).toBe("preview");
    expect(movieSubtitle?.newPath).toContain("Test Movie (2020).srt");

    // Check TV episode file
    const tvEpisode = results.find(r => r.originalPath.includes('episode.mp4'));
    expect(tvEpisode?.action).toBe("preview");
    expect(tvEpisode?.newPath).toContain("Test Show");
    expect(tvEpisode?.newPath).toContain("Season 1");
  });

  test("should handle TV shows with episode titles", async () => {
    const tvDir = path.join(tempDir, "TV");

    const files = [
      {
        path: "/fake/path/episode.mp4",
        name: "Test Show S01E01",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test Show",
        season: 1,
        episode: 1,
        episodeTitle: "Pilot",
        type: "tv" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, "/fake/movies", tvDir, async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("preview");
    expect(results[0].newPath).toContain("Test Show - Season 1 Episode 1 - Pilot.mp4");
  });

  test("should handle empty file arrays", async () => {
    const results = await organizeFiles([], [], "/fake/movies", "/fake/tv", async () => "skip", true, "/fake/scan");

    expect(results).toEqual([]);
  });

  test("should handle files with special characters in names", async () => {
    const movieDir = path.join(tempDir, "Movies");

    const files = [
      {
        path: "/fake/path/movie.mp4",
        name: "Test:Movie*With<Special>Chars?",
        extension: ".mp4",
        type: "video" as const
      }
    ];

    const metadatas = [
      {
        title: "Test:Movie*With<Special>Chars?",
        year: 2020,
        type: "movie" as const
      }
    ];

    const results = await organizeFiles(files, metadatas, movieDir, "/fake/tv", async () => "skip", true, "/fake/scan");

    expect(results.length).toBe(1);
    expect(results[0].action).toBe("preview");
    // Special characters should be sanitized
    expect(results[0].newPath).toContain("TestMovieWithSpecialChars (2020).mp4");
  });
});