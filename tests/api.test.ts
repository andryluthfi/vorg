import { describe, test, expect } from "bun:test";
import { enrichMetadata } from "../src/infrastructure/api";

describe("enrichMetadata", () => {
  test("should return enriched metadata with original data", async () => {
    const metadata = {
      title: "Test Movie",
      year: 2020,
      type: "movie" as const
    };

    // Since we don't have API key, it should fallback to scraping
    // and return the original metadata
    const result = await enrichMetadata(metadata);

    expect(result.title).toBe("Test Movie");
    expect(result.year).toBe(2020);
    expect(result.type).toBe("movie");
  });

  test("should handle TV show metadata", async () => {
    const metadata = {
      title: "Test Show",
      season: 1,
      episode: 1,
      type: "tv" as const
    };

    const result = await enrichMetadata(metadata);

    expect(result.title).toBe("Test Show");
    expect(result.season).toBe(1);
    expect(result.episode).toBe(1);
    expect(result.type).toBe("tv");
  });

  test("should preserve existing metadata", async () => {
    const metadata = {
      title: "Existing Movie",
      year: 2015,
      type: "movie" as const
    };

    const result = await enrichMetadata(metadata);

    expect(result.title).toBe("Existing Movie");
    expect(result.year).toBe(2015);
  });

  test("should use proper casing from API when available", async () => {
    const metadata = {
      title: "the dark knight",
      year: 2008,
      type: "movie" as const
    };

    // Mock fetch to return proper casing
    const mockFetch = async (url: RequestInfo | URL) => {
      return {
        json: async () => ({
          Response: 'True',
          Title: 'The Dark Knight',
          Plot: 'Test plot',
          Genre: 'Action',
          Director: 'Christopher Nolan',
          Actors: 'Christian Bale',
          imdbRating: '9.0'
        })
      } as Response;
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should preserve original casing
    expect(result.title).toBe("the dark knight");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  test("should use proper casing for TV shows from API", async () => {
    const metadata = {
      title: "breaking bad",
      season: 1,
      episode: 1,
      type: "tv" as const
    };

    // Mock fetch for series
    const mockFetch = async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.includes('type=series')) {
        // Series call
        return {
          json: async () => ({
            Response: 'True',
            Title: 'Breaking Bad',
            Plot: 'Test plot',
            Genre: 'Crime',
            Actors: 'Bryan Cranston',
            imdbRating: '9.5'
          })
        } as Response;
      } else {
        // Episode call
        return {
          json: async () => ({
            Response: 'True',
            Title: 'Pilot'
          })
        } as Response;
      }
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should preserve original casing
    expect(result.title).toBe("breaking bad");
    expect(result.episodeTitle).toBe("Pilot");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });
});