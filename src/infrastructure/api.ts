import * as fs from 'fs-extra';
import * as path from 'path';
import { MediaMetadata, EnrichedMetadata } from '../core-data/parser';
import { loadConfig } from '../config/config';
import { getTVEpisode, saveTVEpisodeBatch, saveTVShow, saveMovie, getTVShowByImdbID, getMovieByImdbID } from './database';

const OMDB_BASE_URL = 'http://www.omdbapi.com/';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface OmdbRating {
  Source: string;
  Value: string;
}

interface OmdbResponse {
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Poster?: string;
  Ratings?: OmdbRating[];
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Type?: string;
  DVD?: string;
  BoxOffice?: string;
  Production?: string;
  Website?: string;
  Response: string;
  Error?: string;
  totalSeasons?: string;
}

interface EpisodeData {
  imdbID: string;
  seriesID: string;
  title: string;
  year: string;
  rated: string;
  released: string;
  season: number;
  episode: number;
  runtime: string;
  genre: string;
  director: string;
  writer: string;
  actors: string;
  plot: string;
  language: string;
  country: string;
  awards: string;
  poster: string;
  ratings: string;
  metascore: string;
  imdbRating: string;
  imdbVotes: string;
  type: string;
  response: string;
}

interface SeasonResponse {
  Title: string;
  Season: string;
  totalSeasons: string;
  Episodes: Array<{
    Title: string;
    Released: string;
    Episode: string;
    imdbRating: string;
    imdbID: string;
    Year?: string;
    Rated?: string;
    Runtime?: string;
    Genre?: string;
    Director?: string;
    Writer?: string;
    Actors?: string;
    Plot?: string;
    Language?: string;
    Country?: string;
    Awards?: string;
    Poster?: string;
    Ratings?: OmdbRating[];
    Metascore?: string;
    imdbVotes?: string;
    Type?: string;
    Response?: string;
  }>;
  Response: string;
  Error?: string;
}

// Session-based cache for search results and user selections
const searchCache = new Map<string, Record<string, unknown>>();
const selectionCache = new Map<string, string>();

/**
 * Retrieves the OMDB API key from configuration or environment variables.
 * Checks config file first, then environment variable, falls back to placeholder.
 *
 * @async
 * @function getOmdbApiKey
 * @returns {Promise<string>} OMDB API key or placeholder value
 *
 * @example
 * const apiKey = await getOmdbApiKey();
 * // Returns configured API key or 'your_api_key_here'
 *
 * @example
 * // Edge case: No config or env var
 * const apiKey = await getOmdbApiKey();
 * // Returns: 'your_api_key_here'
 */
async function getOmdbApiKey(): Promise<string> {
  const configResult = loadConfig();
  const apiKey = configResult.config.omdbApiKey || process.env.OMDB_API_KEY || 'your_api_key_here';
  return apiKey;
}

/**
 * Validates an OMDB API key by making a test request to the API.
 * Tests with a known movie title to verify the key works.
 *
 * @async
 * @function validateApiKey
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} True if API key is valid, false otherwise
 *
 * @example
 * const isValid = await validateApiKey('your_api_key');
 * // Returns: true if key is valid
 *
 * @example
 * // Edge case: Empty or placeholder key
 * const isValid = await validateApiKey('');
 * // Returns: false
 *
 * @example
 * // Edge case: Invalid key
 * const isValid = await validateApiKey('invalid_key');
 * // Returns: false
 *
 * @example
 * // Edge case: Network error
 * const isValid = await validateApiKey('valid_key');
 * // Returns: false (due to network issues)
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    return false;
  }
  try {
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('t', 'The Matrix'); // Test with a known movie
    url.searchParams.set('r', 'json');
    const response = await fetch(url);
    const data = await response.json() as Record<string, unknown>;
    return (data.Response as string) === 'True';
  } catch {
    return false;
  }
}

/**
 * Appends a timestamped message to the API enrichment log file.
 * Creates the log file if it doesn't exist, writes to current working directory.
 *
 * @async
 * @function logToFile
 * @param {string} message - Message to log
 * @returns {Promise<void>}
 *
 * @example
 * await logToFile('Starting metadata enrichment');
 * // Appends: [2023-12-01T10:00:00.000Z] Starting metadata enrichment
 *
 * @example
 * // Edge case: Write permission denied
 * await logToFile('Test message');
 * // Logs error to console, doesn't throw
 */
async function logToFile(message: string) {
  const logPath = path.join(process.cwd(), 'api_enrichment.log');
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  try {
    await fs.appendFile(logPath, logEntry);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}


/**
 * Searches OMDB API for a movie/TV show and returns its IMDb ID.
 * Uses caching to avoid repeated API calls for the same search.
 * Handles user selections for ambiguous results (though simplified here).
 *
 * @async
 * @function searchAndResolveImdbID
 * @param {string} title - Title to search for
 * @param {number} [year] - Optional release year for more accurate results
 * @returns {Promise<string | null>} IMDb ID if found, null if not found or failed
 *
 * @example
 * const imdbID = await searchAndResolveImdbID('The Matrix', 1999);
 * // Returns: 'tt0133093'
 *
 * @example
 * // Edge case: Title not found
 * const imdbID = await searchAndResolveImdbID('NonExistentMovie');
 * // Returns: null
 *
 * @example
 * // Edge case: Network error
 * const imdbID = await searchAndResolveImdbID('Movie Title');
 * // Returns: null, logs error
 */
async function searchAndResolveImdbID(title: string, year?: number): Promise<string | null> {
  const cacheKey = `${title}${year ? `_${year}` : ''}`;

  // Check if user has already selected a result for this search term
  if (selectionCache.has(cacheKey)) {
    await logToFile(`Using cached user selection for: ${title}`);
    return selectionCache.get(cacheKey)!;
  }

  // Check cache first
  if (searchCache.has(cacheKey)) {
    const cachedResult = searchCache.get(cacheKey)! as Record<string, unknown>;
    return cachedResult.imdbID as string;
  }

  // Not in cache, fetch from OMDB using title lookup
  const OMDB_API_KEY = await getOmdbApiKey();
  const searchUrl = new URL(OMDB_BASE_URL);
  searchUrl.searchParams.set('apikey', OMDB_API_KEY);
  searchUrl.searchParams.set('t', title);
  if (year) searchUrl.searchParams.set('y', year.toString());
  searchUrl.searchParams.set('r', 'json');

  await logToFile(`OMDB Title Lookup URL: ${searchUrl.toString()}`);
  const response = await fetch(searchUrl);
  const searchData = await response.json() as Record<string, unknown>;
  await logToFile(`OMDB Title Lookup Response: ${JSON.stringify(searchData)}`);

  if ((searchData.Response as string) === 'True') {
    searchCache.set(cacheKey, searchData);
    return searchData.imdbID as string;
  } else {
    await logToFile(`OMDB Title lookup failed: ${searchData.Error}`);
    return null;
  }
}


/**
 * Enriches basic media metadata with additional information from OMDB API and local database.
 * Resolves IMDb ID, fetches detailed information, and caches results in database.
 * Handles both movies and TV shows/episodes with appropriate data enrichment.
 *
 * Enrichment process:
 * 1. Resolve IMDb ID from title/year
 * 2. Check local database for existing data
 * 3. Fetch from OMDB API if not in database
 * 4. Store fetched data in database for future use
 * 5. Return enriched metadata with correct title casing and additional fields
 *
 * @async
 * @function enrichMetadata
 * @param {MediaMetadata} metadata - Basic metadata to enrich
 * @returns {Promise<EnrichedMetadata>} Enriched metadata with additional API data
 * @throws {Error} If API requests fail (logged but not thrown)
 *
 * @example
 * const basic = { type: 'movie', title: 'the matrix', year: 1999 };
 * const enriched = await enrichMetadata(basic);
 * // Returns: { ...basic, title: 'The Matrix', plot: '...', genre: 'Action, Sci-Fi', ... }
 *
 * @example
 * // Edge case: Title not found in OMDB
 * const enriched = await enrichMetadata({ type: 'movie', title: 'Unknown Movie' });
 * // Returns: original metadata unchanged
 *
 * @example
 * // Edge case: Network/API error
 * const enriched = await enrichMetadata(metadata);
 * // Returns: original metadata, logs error
 *
 * @example
 * // Edge case: TV episode enrichment
 * const episode = { type: 'tv', title: 'Breaking Bad', season: 1, episode: 1 };
 * const enriched = await enrichMetadata(episode);
 * // Returns: enriched with episode-specific data
 */
export async function enrichMetadata(metadata: MediaMetadata): Promise<EnrichedMetadata> {
  await logToFile(`Starting enrichment for: ${JSON.stringify(metadata)}`);

  const enriched: EnrichedMetadata = { ...metadata };

  try {
    // First, search to resolve IMDb ID
    const imdbID = await searchAndResolveImdbID(metadata.title, metadata.year);
    if (!imdbID) {
      await logToFile(`Could not resolve IMDb ID for: ${metadata.title}`);
      return enriched;
    }

    await logToFile(`Resolved IMDb ID: ${imdbID}`);

    // Check if data already exists in database
    if (metadata.type === 'movie') {
      const existingMovie = getMovieByImdbID(imdbID) as Record<string, unknown> | undefined;
      if (existingMovie) {
        await logToFile(`Found existing movie data in database for IMDb ID: ${imdbID}`);
        // Use database data for enrichment and correct title casing
        enriched.title = existingMovie.title as string; // Update with correct casing
        enriched.plot = existingMovie.plot as string;
        enriched.genre = existingMovie.genre as string;
        enriched.director = existingMovie.director as string;
        enriched.actors = existingMovie.actors as string;
        enriched.imdbRating = existingMovie.imdbRating as string;
        return enriched;
      }
    } else {
      // For TV shows, check series data and episode data
      const existingSeries = getTVShowByImdbID(imdbID) as Record<string, unknown> | undefined;
      if (existingSeries) {
        await logToFile(`Found existing series data in database for IMDb ID: ${imdbID}`);
        enriched.title = existingSeries.title as string; // Update with correct casing

        // For episodes, check if episode data exists
        if (metadata.season && metadata.episode) {
          const existingEpisode = getTVEpisode(imdbID, metadata.season, metadata.episode) as Record<string, unknown> | undefined;
          if (existingEpisode) {
            enriched.plot = existingEpisode.plot as string;
            enriched.genre = existingEpisode.genre as string;
            enriched.actors = existingEpisode.actors as string;
            enriched.imdbRating = existingEpisode.imdbRating as string;
            enriched.episodeTitle = existingEpisode.title as string; // Episode title
            return enriched;
          } else {
            // Series exists but episode doesn't, fetch episode data
            await logToFile(`Series exists but episode data missing, fetching season ${metadata.season}`);
            await fetchAndStoreTVSeason(imdbID, metadata.season, await getOmdbApiKey());
            const episodeData = getTVEpisode(imdbID, metadata.season, metadata.episode) as Record<string, unknown> | undefined;
            if (episodeData) {
              enriched.plot = episodeData.plot as string;
              enriched.genre = episodeData.genre as string;
              enriched.actors = episodeData.actors as string;
              enriched.imdbRating = episodeData.imdbRating as string;
              enriched.episodeTitle = episodeData.title as string;
            } else {
              // OMDB failed to fetch episode data, try TMDB as fallback
              await logToFile(`OMDB episode fetch failed, trying TMDB fallback for ${metadata.title} S${metadata.season}E${metadata.episode}`);
              const tmdbSeriesId = await searchTmdbTVShow(metadata.title, metadata.year);
              if (tmdbSeriesId) {
                await logToFile(`Found TMDB series ID: ${tmdbSeriesId}`);
                const tmdbEpisodeData = await fetchTmdbEpisode(tmdbSeriesId, metadata.season, metadata.episode);
                if (tmdbEpisodeData) {
                  // Save TMDB episode data to database
                  saveTVEpisodeBatch([tmdbEpisodeData as unknown as Record<string, unknown>]);
                  await logToFile(`Saved TMDB episode data to database`);

                  // Use the TMDB data for enrichment
                  enriched.plot = tmdbEpisodeData.plot;
                  enriched.genre = tmdbEpisodeData.genre;
                  enriched.actors = tmdbEpisodeData.actors;
                  enriched.imdbRating = tmdbEpisodeData.imdbRating;
                  enriched.episodeTitle = tmdbEpisodeData.title;
                } else {
                  await logToFile(`TMDB episode fetch also failed`);
                }
              } else {
                await logToFile(`Could not find TMDB series ID for ${metadata.title}`);
              }
            }
            return enriched;
          }
        } else {
          // Just series info, no specific episode
          enriched.plot = existingSeries.plot as string;
          enriched.genre = existingSeries.genre as string;
          enriched.actors = existingSeries.actors as string;
          enriched.imdbRating = existingSeries.imdbRating as string;
          return enriched;
        }
      }
    }

    // Data not in database, fetch from OMDB
    const OMDB_API_KEY = await getOmdbApiKey();
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', OMDB_API_KEY);
    url.searchParams.set('i', imdbID);
    url.searchParams.set('plot', 'short');
    url.searchParams.set('r', 'json');

    await logToFile(`OMDB Fetch URL: ${url.toString()}`);
    const response = await fetch(url);
    const data = await response.json() as OmdbResponse;
    await logToFile(`OMDB Fetch Response: ${JSON.stringify(data)}`);

    if ((data.Response as string) === 'True') {
      if (data.Type === 'movie') {
        await logToFile(`Original movie title: "${data.Title}", Year: "${data.Year}"`);
        // Clean title: remove year based on data.Year and trim
        if (data.Year && data.Title) {
          const yearPattern = new RegExp(`\\s*\\(${data.Year}\\)\\s*$`);
          await logToFile(`Attempting to match pattern: "${yearPattern.source}" against title: "${data.Title}"`);
          const originalTitle = data.Title;
          data.Title = data.Title.replace(yearPattern, '').trim();
          if (data.Title !== originalTitle) {
            await logToFile(`Cleaned movie title (parentheses): "${data.Title}"`);
          } else {
            await logToFile(`Parentheses pattern didn't match, trying space-separated year pattern`);
            // Try to match year at the end with spaces
            const spaceYearPattern = new RegExp(`\\s+${data.Year}\\s*$`);
            await logToFile(`Attempting to match space pattern: "${spaceYearPattern.source}" against title: "${data.Title}"`);
            data.Title = data.Title.replace(spaceYearPattern, '').trim();
            if (data.Title !== originalTitle) {
              await logToFile(`Cleaned movie title (space-separated): "${data.Title}"`);
            } else {
              await logToFile(`No year pattern matched, title unchanged: "${data.Title}"`);
            }
          }
        } else {
          await logToFile(`No Year field found, skipping title cleaning`);
        }
        // Store full movie data in database
        saveMovie(data as unknown as Record<string, unknown>);
        await logToFile(`Movie data stored in database: ${data.imdbID} with title: "${data.Title}"`);

        // Verify what was actually stored in database
        const savedMovie = getMovieByImdbID(data.imdbID as string) as Record<string, unknown> | undefined;
        await logToFile(`Database verification - stored title: "${savedMovie?.title as string}"`);

        // Enrich metadata with correct title casing
        enriched.title = data.Title || enriched.title; // Update with correct casing
        enriched.plot = data.Plot;
        enriched.genre = data.Genre;
        enriched.director = data.Director;
        enriched.actors = data.Actors;
        enriched.imdbRating = data.imdbRating;
      } else if (data.Type === 'series') {
        // Store full series data in database
        saveTVShow(data as unknown as Record<string, unknown>);
        await logToFile(`TV Show data stored in database: ${data.imdbID}`);

        // Update title with correct casing
        enriched.title = data.Title || enriched.title;

        // For series, we need episode data too
        if (metadata.season && metadata.episode) {
          await fetchAndStoreTVSeason(imdbID, metadata.season, OMDB_API_KEY);
          const episodeData: EpisodeData | undefined = getTVEpisode(imdbID, metadata.season, metadata.episode) as EpisodeData | undefined;
          if (episodeData) {
            enriched.plot = episodeData.plot;
            enriched.genre = episodeData.genre;
            enriched.actors = episodeData.actors;
            enriched.imdbRating = episodeData.imdbRating;
            enriched.episodeTitle = episodeData.title;
          }
        } else {
          // Just series info
          enriched.plot = data.Plot;
          enriched.genre = data.Genre;
          enriched.actors = data.Actors;
          enriched.imdbRating = data.imdbRating;
        }
      }
      await logToFile(`Enrichment successful: ${JSON.stringify(enriched)}`);
    } else {
      await logToFile(`OMDB fetch failed: ${data.Error}`);
    }
  } catch (error) {
    await logToFile(`Enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return enriched;
}


/**
 * Fetches all episodes for a TV season from OMDB API and stores them in the database.
 * Retrieves season data, processes each episode, and batches them for database storage.
 * Uses series data from database to fill in missing episode information.
 *
 * @async
 * @function fetchAndStoreTVSeason
 * @param {string} seriesImdbID - IMDb ID of the TV series
 * @param {number} season - Season number to fetch
 * @param {string} apiKey - OMDB API key for requests
 * @returns {Promise<void>}
 * @throws {Error} If API requests fail (logged but not thrown)
 *
 * @example
 * await fetchAndStoreTVSeason('tt0903747', 1, 'your_api_key');
 * // Fetches and stores all episodes of Breaking Bad Season 1
 *
 * @example
 * // Edge case: Series not in database
 * await fetchAndStoreTVSeason('tt1234567', 1, 'api_key');
 * // Logs error and returns without storing
 *
 * @example
 * // Edge case: Invalid season number
 * await fetchAndStoreTVSeason('tt0903747', 99, 'api_key');
 * // OMDB returns error, logs failure
 *
 * @example
 * // Edge case: Network error
 * await fetchAndStoreTVSeason('tt0903747', 1, 'api_key');
 * // Logs error, doesn't store data
 */
async function fetchAndStoreTVSeason(seriesImdbID: string, season: number, apiKey: string): Promise<void> {
  try {
    await logToFile(`Fetching whole season ${season} for series IMDb ID: ${seriesImdbID}`);

    // Get series data first to get genre/actors
    const seriesData = getTVShowByImdbID(seriesImdbID) as Record<string, unknown> | undefined;
    if (!seriesData) {
      await logToFile(`Series data not found in database for IMDb ID: ${seriesImdbID}`);
      return;
    }

    // Get all episodes for the season
    const seasonUrl = new URL(OMDB_BASE_URL);
    seasonUrl.searchParams.set('apikey', apiKey);
    seasonUrl.searchParams.set('i', seriesImdbID);
    seasonUrl.searchParams.set('Season', season.toString());
    seasonUrl.searchParams.set('r', 'json');

    const seasonResponse = await fetch(seasonUrl);
    const seasonData = await seasonResponse.json() as SeasonResponse;

    if (seasonData.Response === 'True' && seasonData.Episodes) {
      const episodes = seasonData.Episodes.map((ep) => ({
        imdbID: ep.imdbID,
        seriesID: seriesImdbID,
        Title: ep.Title,
        Year: ep.Year,
        Rated: ep.Rated,
        Released: ep.Released,
        Season: season,
        Episode: parseInt(ep.Episode),
        Runtime: ep.Runtime,
        Genre: seriesData.Genre,
        Director: ep.Director,
        Writer: ep.Writer,
        Actors: seriesData.Actors,
        Plot: ep.Plot,
        Language: ep.Language,
        Country: ep.Country,
        Awards: ep.Awards,
        Poster: ep.Poster,
        Ratings: ep.Ratings || [],
        Metascore: ep.Metascore,
        imdbRating: ep.imdbRating,
        imdbVotes: ep.imdbVotes,
        Type: ep.Type,
        Response: ep.Response
      }));

      saveTVEpisodeBatch(episodes);
      await logToFile(`Stored ${episodes.length} episodes for season ${season} of series ${seriesImdbID}`);
    } else {
      await logToFile(`Failed to get season data: ${seasonData.Error}`);
    }
  } catch (error) {
    await logToFile(`Error fetching season: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieves the TMDB API key from configuration or environment variables.
 * Checks config file first, then environment variable, falls back to placeholder.
 *
 * @async
 * @function getTmdbApiKey
 * @returns {Promise<string>} TMDB API key or placeholder value
 *
 * @example
 * const apiKey = await getTmdbApiKey();
 * // Returns configured API key or 'your_tmdb_api_key_here'
 */
async function getTmdbApiKey(): Promise<string> {
  const configResult = loadConfig();
  const apiKey = configResult.config.tmdbApiKey || process.env.TMDB_API_KEY || 'your_tmdb_api_key_here';
  return apiKey;
}

/**
 * Validates a TMDB API key by making a test request to the API.
 * Tests with a known movie to verify the key works.
 *
 * @async
 * @function validateTmdbApiKey
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} True if API key is valid, false otherwise
 *
 * @example
 * const isValid = await validateTmdbApiKey('your_api_key');
 * // Returns: true if key is valid
 */
export async function validateTmdbApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_tmdb_api_key_here') {
    return false;
  }
  try {
    const url = new URL(`${TMDB_BASE_URL}/movie/550`); // Test with Fight Club
    url.searchParams.set('api_key', apiKey);
    const response = await fetch(url);
    const data = await response.json() as Record<string, unknown>;
    return !data.status_code || data.status_code !== 7; // 7 = invalid API key
  } catch {
    return false;
  }
}

/**
 * Searches TMDB API for a TV show and returns its TMDB ID.
 * Used to find the TMDB ID for a series before fetching episode data.
 *
 * @async
 * @function searchTmdbTVShow
 * @param {string} title - Title to search for
 * @param {number} [year] - Optional release year for more accurate results
 * @returns {Promise<number | null>} TMDB ID if found, null if not found or failed
 *
 * @example
 * const tmdbId = await searchTmdbTVShow('Breaking Bad', 2008);
 * // Returns: 1396
 */
async function searchTmdbTVShow(title: string, year?: number): Promise<number | null> {
  try {
    const TMDB_API_KEY = await getTmdbApiKey();
    const searchUrl = new URL(`${TMDB_BASE_URL}/search/tv`);
    searchUrl.searchParams.set('api_key', TMDB_API_KEY);
    searchUrl.searchParams.set('query', title);
    if (year) searchUrl.searchParams.set('first_air_date_year', year.toString());

    await logToFile(`TMDB TV Search URL: ${searchUrl.toString()}`);
    const response = await fetch(searchUrl);
    const data = await response.json() as Record<string, unknown>;
    await logToFile(`TMDB TV Search Response: ${JSON.stringify(data)}`);

    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      const firstResult = data.results[0] as Record<string, unknown>;
      return firstResult.id as number;
    }

    return null;
  } catch (error) {
    await logToFile(`TMDB TV search failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Fetches episode data from TMDB API and converts it to OMDB-compatible format.
 * Retrieves specific episode details and transforms them to match existing database schema.
 *
 * @async
 * @function fetchTmdbEpisode
 * @param {number} seriesTmdbId - TMDB ID of the TV series
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @returns {Promise<EpisodeData | null>} Episode data in OMDB format, or null if failed
 *
 * @example
 * const episodeData = await fetchTmdbEpisode(1396, 1, 1);
 * // Returns: episode data in OMDB-compatible format
 */
async function fetchTmdbEpisode(seriesTmdbId: number, season: number, episode: number): Promise<EpisodeData | null> {
  try {
    const TMDB_API_KEY = await getTmdbApiKey();
    const episodeUrl = new URL(`${TMDB_BASE_URL}/tv/${seriesTmdbId}/season/${season}/episode/${episode}`);
    episodeUrl.searchParams.set('api_key', TMDB_API_KEY);

    await logToFile(`TMDB Episode Fetch URL: ${episodeUrl.toString()}`);
    const response = await fetch(episodeUrl);
    const data = await response.json() as Record<string, unknown>;
    await logToFile(`TMDB Episode Fetch Response: ${JSON.stringify(data)}`);

    if (data.id) {
      // Convert TMDB format to OMDB-compatible format
      const episodeData: EpisodeData = {
        imdbID: `tmdb_${data.id}`, // Use TMDB ID with prefix since we don't have IMDb ID
        seriesID: `tmdb_${seriesTmdbId}`, // Use TMDB series ID with prefix
        title: String(data.name || ''),
        year: data.air_date ? new Date(String(data.air_date)).getFullYear().toString() : '',
        rated: '', // TMDB doesn't provide rating info like OMDB
        released: String(data.air_date || ''),
        season: season,
        episode: episode,
        runtime: data.runtime ? String(data.runtime) : '',
        genre: '', // Would need series data for this
        director: '', // TMDB has crew info but not in simple format
        writer: '',
        actors: '',
        plot: String(data.overview || ''),
        language: '',
        country: '',
        awards: '',
        poster: data.still_path ? `https://image.tmdb.org/t/p/w500${data.still_path}` : '',
        ratings: '[]',
        metascore: '',
        imdbRating: data.vote_average ? String(data.vote_average) : '',
        imdbVotes: data.vote_count ? String(data.vote_count) : '',
        type: 'episode',
        response: 'True'
      };

      return episodeData;
    }

    return null;
  } catch (error) {
    await logToFile(`TMDB episode fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
