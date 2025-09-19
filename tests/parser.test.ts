import { describe, test, expect } from "bun:test";
import { parseFilename, generateNewName } from "../src/core-data/parser";

describe("parseFilename", () => {
  test("should parse movie filename", () => {
    const result = parseFilename("Inception (2010).mp4");
    expect(result.title).toBe("Inception");
    expect(result.year).toBe(2010);
    expect(result.type).toBe("movie");
  });

  test("should parse TV show filename", () => {
    const result = parseFilename("Breaking Bad S05E10.mp4");
    expect(result.title).toBe("Breaking Bad");
    expect(result.season).toBe(5);
    expect(result.episode).toBe(10);
    expect(result.type).toBe("tv");
  });

  test("should handle filename without extension", () => {
    const result = parseFilename("Movie Name");
    expect(result.title).toBe("Movie Name");
    expect(result.type).toBe("movie");
  });

  test("should handle complex TV filename", () => {
    const result = parseFilename("The.Walking.Dead.S10E05.720p.HDTV.x264.mp4");
    expect(result.title).toBe("The Walking Dead");
    expect(result.season).toBe(10);
    expect(result.episode).toBe(5);
    expect(result.type).toBe("tv");
  });
});

describe("generateNewName", () => {
  test("should generate movie name", () => {
    const metadata = {
      title: "Inception",
      year: 2010,
      type: "movie" as const
    };
    expect(generateNewName(metadata)).toBe("Inception (2010)");
  });

  test("should generate TV episode name", () => {
    const metadata = {
      title: "Breaking Bad",
      year: 2008,
      season: 5,
      episode: 10,
      episodeTitle: "Buried",
      type: "tv" as const
    };
    expect(generateNewName(metadata)).toBe("Breaking Bad (2008) - Season 5 Episode 10 - Buried");
  });

  test("should handle movie without year", () => {
    const metadata = {
      title: "Unknown Movie",
      type: "movie" as const
    };
    expect(generateNewName(metadata)).toBe("Unknown Movie");
  });

  test("should handle TV without episode title", () => {
    const metadata = {
      title: "Test Show",
      season: 1,
      episode: 1,
      type: "tv" as const
    };
    expect(generateNewName(metadata)).toBe("Test Show - Season 1 Episode 1");
  });
});