import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import * as fs from "fs";
import * as path from "path";
import { saveMetadata, getMovieByTitle, getTVEpisode, saveFileMove, getRecentMoves, closeDatabase, db } from "../src/infrastructure/database";

describe("Database operations", () => {
  let testDb: Database;
  const testDbPath = ":memory:"; // Use in-memory database for tests

  beforeEach(() => {
    // Create a new in-memory database for each test
    testDb = new Database(testDbPath);

    // Create tables
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        year INTEGER,
        plot TEXT,
        genre TEXT,
        director TEXT,
        actors TEXT,
        imdb_rating TEXT,
        file_path TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS tv_episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        year INTEGER,
        season INTEGER,
        episode INTEGER,
        episode_title TEXT,
        plot TEXT,
        genre TEXT,
        actors TEXT,
        imdb_rating TEXT,
        file_path TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS file_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_path TEXT NOT NULL,
        new_path TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterEach(() => {
    testDb.close();
  });

  test("should save movie metadata", () => {
    const metadata = {
      title: "Test Movie",
      year: 2020,
      plot: "A test plot",
      genre: "Action",
      director: "Test Director",
      actors: "Test Actor",
      imdbRating: "8.0",
      type: "movie" as const
    };

    saveMetadata(metadata, "/path/to/movie.mp4", testDb);

    const result = testDb.prepare("SELECT * FROM movies WHERE title = ?").get("Test Movie") as any;
    expect(result.title).toBe("Test Movie");
    expect(result.year).toBe(2020);
    expect(result.plot).toBe("A test plot");
  });

  test("should save TV episode metadata", () => {
    const metadata = {
      title: "Test Show",
      year: 2020,
      season: 1,
      episode: 1,
      episodeTitle: "Pilot",
      plot: "A test episode",
      genre: "Drama",
      actors: "Test Actor",
      imdbRating: "8.5",
      type: "tv" as const
    };

    saveMetadata(metadata, "/path/to/episode.mp4", testDb);

    const result = testDb.prepare("SELECT * FROM tv_episodes WHERE title = ?").get("Test Show") as any;
    expect(result.title).toBe("Test Show");
    expect(result.season).toBe(1);
    expect(result.episode).toBe(1);
    expect(result.episode_title).toBe("Pilot");
  });

  test("should retrieve movie by title", () => {
    testDb.prepare("INSERT INTO movies (title, year) VALUES (?, ?)").run("Test Movie", 2020);

    const result = getMovieByTitle("Test Movie") as any;
    expect(result.title).toBe("Test Movie");
    expect(result.year).toBe(2020);
  });

  test("should retrieve TV episode", () => {
    testDb.prepare("INSERT INTO tv_episodes (title, season, episode) VALUES (?, ?, ?)").run("Test Show", 1, 1);

    const result = getTVEpisode("Test Show", 1, 1) as any;
    expect(result.title).toBe("Test Show");
    expect(result.season).toBe(1);
    expect(result.episode).toBe(1);
  });

  test("should save file move", () => {
    saveFileMove("/old/path.mp4", "/new/path.mp4", testDb);

    const result = testDb.prepare("SELECT * FROM file_moves").get() as any;
    expect(result.original_path).toBe("/old/path.mp4");
    expect(result.new_path).toBe("/new/path.mp4");
  });

  test("should get recent moves", () => {
    // Insert with explicit timestamps to ensure ordering
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();

    testDb.prepare("INSERT INTO file_moves (original_path, new_path, timestamp) VALUES (?, ?, ?)").run("/old1.mp4", "/new1.mp4", now);
    testDb.prepare("INSERT INTO file_moves (original_path, new_path, timestamp) VALUES (?, ?, ?)").run("/old2.mp4", "/new2.mp4", later);

    const moves = getRecentMoves(testDb);
    expect(moves.length).toBe(2);
    // Should be ordered by timestamp DESC (newest first)
    expect(moves[0].original_path).toBe("/old2.mp4");
    expect(moves[1].original_path).toBe("/old1.mp4");
  });
});