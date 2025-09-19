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
      title: "The Dark Knight",
      year: 2008,
      type: "movie" as const
    };

    // Mock fetch to return proper casing
    const mockFetch = async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.includes('t=The+Dark+Knight')) {
        // Title lookup response
        return {
          json: async () => ({
            Response: 'True',
            Title: 'The Dark Knight',
            Year: '2008',
            imdbID: 'tt0468569',
            Type: 'movie'
          })
        } as Response;
      } else if (urlString.includes('i=tt0468569')) {
        // Full movie data response
        return {
          json: async () => ({
            Response: 'True',
            Title: 'The Dark Knight',
            Year: '2008',
            Plot: 'Test plot',
            Genre: 'Action',
            Director: 'Christopher Nolan',
            Actors: 'Christian Bale',
            imdbRating: '9.0',
            Type: 'movie'
          })
        } as Response;
      }
      return { json: async () => ({ Response: 'False' }) } as Response;
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should use API's proper casing as standard
    expect(result.title).toBe("The Dark Knight");
    expect(result.plot).toBe("Test plot");
    expect(result.genre).toBe("Action");
    expect(result.director).toBe("Christopher Nolan");
    expect(result.actors).toBe("Christian Bale");
    expect(result.imdbRating).toBe("9.0");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  test("should handle API errors gracefully", async () => {
    const metadata = {
      title: "Test Movie",
      year: 2020,
      type: "movie" as const
    };

    // Mock fetch to simulate API error
    const mockFetch = async (url: RequestInfo | URL) => {
      return {
        json: async () => ({
          Response: 'False',
          Error: 'Movie not found!'
        })
      } as Response;
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should return original metadata when API fails
    expect(result.title).toBe("Test Movie");
    expect(result.year).toBe(2020);
    expect(result.type).toBe("movie");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  test("should handle network errors gracefully", async () => {
    const metadata = {
      title: "Test Movie",
      year: 2020,
      type: "movie" as const
    };

    // Mock fetch to throw network error
    const mockFetch = async (url: RequestInfo | URL) => {
      throw new Error('Network error');
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should return original metadata when network fails
    expect(result.title).toBe("Test Movie");
    expect(result.year).toBe(2020);
    expect(result.type).toBe("movie");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  test("should enrich TV show series information", async () => {
    const metadata = {
      title: "Breaking Bad",
      type: "tv" as const
    };

    // Mock fetch for series lookup and full data
    const mockFetch = async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.includes('t=Breaking+Bad')) {
        // Series lookup response
        return {
          json: async () => ({
            Response: 'True',
            Title: 'Breaking Bad',
            Year: '2008–2013',
            imdbID: 'tt0903747',
            Type: 'series'
          })
        } as Response;
      } else if (urlString.includes('i=tt0903747')) {
        // Full series data response
        return {
          json: async () => ({
            Response: 'True',
            Title: 'Breaking Bad',
            Year: '2008–2013',
            Plot: 'A high school chemistry teacher turned methamphetamine manufacturer',
            Genre: 'Crime, Drama, Thriller',
            Actors: 'Bryan Cranston, Aaron Paul, Anna Gunn',
            imdbRating: '9.5',
            Type: 'series'
          })
        } as Response;
      }
      return { json: async () => ({ Response: 'False' }) } as Response;
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should use API's proper casing and add enrichment data
    expect(result.title).toBe("Breaking Bad");
    expect(result.plot).toBe("A high school chemistry teacher turned methamphetamine manufacturer");
    expect(result.genre).toBe("Crime, Drama, Thriller");
    expect(result.actors).toBe("Bryan Cranston, Aaron Paul, Anna Gunn");
    expect(result.imdbRating).toBe("9.5");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  test("should handle API lookup failure", async () => {
    const metadata = {
      title: "NonExistentMovie12345",
      year: 2020,
      type: "movie" as const
    };

    // Mock fetch to simulate movie not found
    const mockFetch = async (url: RequestInfo | URL) => {
      return {
        json: async () => ({
          Response: 'False',
          Error: 'Movie not found!'
        })
      } as Response;
    };

    // Temporarily replace fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    const result = await enrichMetadata(metadata);

    // Should return original metadata when API lookup fails
    expect(result.title).toBe("NonExistentMovie12345");
    expect(result.year).toBe(2020);
    expect(result.type).toBe("movie");

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });
});