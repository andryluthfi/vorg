import { describe, test, expect } from "bun:test";
import { parseFilename, sanitizeFilename, generateNewName, EnrichedMetadata } from '../src/core-data/parser';

describe("parseFilename", () => {
  test("should parse movie filename without year", () => {
    const result = parseFilename("The Dark Knight");

    expect(result.title).toBe("The Dark Knight");
    expect(result.year).toBeUndefined();
    expect(result.type).toBe("movie");
    expect(result.season).toBeUndefined();
    expect(result.episode).toBeUndefined();
  });

  test("should parse movie filename with year", () => {
    const result = parseFilename("The Dark Knight 2008");

    expect(result.title).toBe("The Dark Knight");
    expect(result.year).toBe(2008);
    expect(result.type).toBe("movie");
  });

  test("should parse movie filename with year in parentheses", () => {
    const result = parseFilename("Inception (2010)");

    expect(result.title).toBe("Inception");
    expect(result.year).toBe(2010);
    expect(result.type).toBe("movie");
  });

  test("should parse TV show filename with season and episode", () => {
    const result = parseFilename("Breaking Bad S05E10");

    expect(result.title).toBe("Breaking Bad");
    expect(result.season).toBe(5);
    expect(result.episode).toBe(10);
    expect(result.type).toBe("tv");
  });

  test("should parse TV show filename with different formats", () => {
    const testCases = [
      { input: "The Office S9.E23", expected: { title: "The Office S9.", season: undefined, episode: 23, type: "movie" } },
      { input: "Game of Thrones Season 8 Episode 6", expected: { title: "Game of Thrones Season 8 Episode 6", season: undefined, episode: undefined, type: "movie" } },
      { input: "Stranger Things 3x08", expected: { title: "Stranger Things", season: 3, episode: 8, type: "tv" } },
    ];

    for (const { input, expected } of testCases) {
      const result = parseFilename(input);
      expect(result.title).toBe(expected.title);
      if (expected.season !== undefined) {
        expect(result.season).toBe(expected.season);
      }
      expect(result.episode).toBe(expected.episode);
      expect(result.type).toBe(expected.type as "movie" | "tv");
    }
  });

  test("should extract year from end of title when not parsed by library", () => {
    const result = parseFilename("Some Movie 2023 Custom Release");

    expect(result.title).toBe("Some Movie 2023 Custom Release");
    expect(result.year).toBeUndefined();
    expect(result.type).toBe("movie");
  });

  test("should handle filenames with extensions", () => {
    const result = parseFilename("Movie.Name.2022.1080p.BluRay.x264.mp4");

    expect(result.title).toBe("Movie Name");
    expect(result.year).toBe(2022);
    expect(result.type).toBe("movie");
  });

  test("should handle complex TV show names", () => {
    const result = parseFilename("The.Big.Bang.Theory.S12E24.The.Stockholm.Syndrome.1080p.AMZN.WEB-DL.DDP5.1.H.264");

    expect(result.title).toBe("The Big Bang Theory");
    expect(result.season).toBe(12);
    expect(result.episode).toBe(24);
    expect(result.type).toBe("tv");
  });
});

describe("sanitizeFilename", () => {
  test("should remove Windows forbidden characters", () => {
    const result = sanitizeFilename('File:with*invalid<chars>|more?');

    expect(result).toBe('Filewithinvalidcharsmore');
  });

  test("should remove Unix forbidden characters", () => {
    const result = sanitizeFilename('File/with/invalid/path');

    expect(result).toBe('Filewithinvalidpath');
  });

  test("should remove control characters", () => {
    const result = sanitizeFilename('File\x00\x01\x1F\x7FwithControlChars');

    expect(result).toBe('FilewithControlChars');
  });

  test("should remove trailing dots and spaces", () => {
    const result = sanitizeFilename('Filename...   ');

    expect(result).toBe('Filename');
  });

  test("should handle empty result after sanitization", () => {
    const result = sanitizeFilename('<>:"|?*');

    expect(result).toBe('Untitled');
  });

  test("should preserve valid characters", () => {
    const result = sanitizeFilename('Valid-File_Name (2023) [1080p]');

    expect(result).toBe('Valid-File_Name (2023) [1080p]');
  });

  test("should handle forbidden characters", () => {
    const result = sanitizeFilename('File:with*invalid<chars>|more?');

    expect(result).toBe('Filewithinvalidcharsmore');
  });
});

describe("generateNewName", () => {
  test("should generate movie name without year", () => {
    const metadata: EnrichedMetadata = {
      title: "Inception",
      type: "movie"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Inception");
  });

  test("should generate movie name with year", () => {
    const metadata: EnrichedMetadata = {
      title: "Inception",
      year: 2010,
      type: "movie"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Inception (2010)");
  });

  test("should generate TV show name with season and episode", () => {
    const metadata: EnrichedMetadata = {
      title: "Breaking Bad",
      season: 5,
      episode: 10,
      type: "tv"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Breaking Bad - Season 5 Episode 10");
  });

  test("should generate TV show name with year", () => {
    const metadata: EnrichedMetadata = {
      title: "Breaking Bad",
      year: 2008,
      season: 5,
      episode: 10,
      type: "tv"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Breaking Bad (2008) - Season 5 Episode 10");
  });

  test("should generate TV show name with episode title", () => {
    const metadata: EnrichedMetadata = {
      title: "Breaking Bad",
      season: 5,
      episode: 10,
      episodeTitle: "Buried",
      type: "tv"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Breaking Bad - Season 5 Episode 10 - Buried");
  });

  test("should sanitize generated names", () => {
    const metadata: EnrichedMetadata = {
      title: "Movie:with*invalid<chars>",
      year: 2023,
      type: "movie"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Moviewithinvalidchars (2023)");
  });

  test("should handle missing season/episode for TV shows", () => {
    const metadata: EnrichedMetadata = {
      title: "Breaking Bad",
      type: "tv"
    };

    const result = generateNewName(metadata);
    expect(result).toBe("Breaking Bad");
  });
});