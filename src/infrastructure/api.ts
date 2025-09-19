import * as fs from 'fs-extra';
import * as path from 'path';
import { MediaMetadata, EnrichedMetadata } from '../core-data/parser';
import { loadConfig } from '../config/config';
import { getTVEpisode, saveTVEpisodeBatch, saveTVShow, saveMovie, getTVShowByImdbID, getMovieByImdbID } from './database';

const OMDB_BASE_URL = 'http://www.omdbapi.com/';

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

async function getOmdbApiKey(): Promise<string> {
  const configResult = loadConfig();
  const apiKey = configResult.config.omdbApiKey || process.env.OMDB_API_KEY || 'your_api_key_here';
  return apiKey;
}

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
  } catch (error) {
    return false;
  }
}

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
            await logToFile(`Found existing episode data in database`);
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
