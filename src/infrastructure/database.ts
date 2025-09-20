import { Database } from 'bun:sqlite';
import * as path from 'path';
import * as fs from 'fs';

interface FileMove {
  id: number;
  original_path: string;
  new_path: string;
  timestamp: string;
}

// Use executable directory for database path instead of __dirname
const exeDir = path.dirname(process.execPath);
const DB_PATH = path.join(exeDir, 'media.db');

console.log('🔍 Database path:', DB_PATH);
console.log('🔍 __dirname:', __dirname);
console.log('🔍 Executable path:', process.execPath);
console.log('🔍 Executable directory:', exeDir);
console.log('🔍 Current working directory:', process.cwd());

const dbDir = path.dirname(DB_PATH);
console.log('🔍 Database directory:', dbDir);

try {
  if (!fs.existsSync(dbDir)) {
    console.log('❌ Database directory does not exist, creating...');
    fs.mkdirSync(dbDir, { recursive: true });
  } else {
    console.log('✅ Database directory exists');
  }

  // Check write permissions
  fs.accessSync(dbDir, fs.constants.W_OK);
  console.log('✅ Database directory is writable');
} catch (error) {
  console.error('❌ Database directory access error:', error);
}

console.log('🔍 Checking if media.db exists before opening:', fs.existsSync(DB_PATH));

let db: Database;

try {
  db = new Database(DB_PATH);
  console.log('✅ Database opened successfully');
} catch (error) {
  console.error('❌ Failed to open database:', error);
  throw error;
}

console.log('🔍 Checking if media.db exists after opening:', fs.existsSync(DB_PATH));

export { db };

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tv_show (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imdbID TEXT UNIQUE,
    title TEXT,
    year TEXT,
    rated TEXT,
    released TEXT,
    runtime TEXT,
    genre TEXT,
    director TEXT,
    writer TEXT,
    actors TEXT,
    plot TEXT,
    language TEXT,
    country TEXT,
    awards TEXT,
    poster TEXT,
    ratings TEXT,
    metascore TEXT,
    imdbRating TEXT,
    imdbVotes TEXT,
    type TEXT,
    totalSeasons TEXT,
    response TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tv_show_episode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imdbID TEXT UNIQUE,
    seriesID TEXT,
    title TEXT,
    year TEXT,
    rated TEXT,
    released TEXT,
    season INTEGER,
    episode INTEGER,
    runtime TEXT,
    genre TEXT,
    director TEXT,
    writer TEXT,
    actors TEXT,
    plot TEXT,
    language TEXT,
    country TEXT,
    awards TEXT,
    poster TEXT,
    ratings TEXT,
    metascore TEXT,
    imdbRating TEXT,
    imdbVotes TEXT,
    type TEXT,
    response TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imdbID TEXT UNIQUE,
    title TEXT,
    year TEXT,
    rated TEXT,
    released TEXT,
    runtime TEXT,
    genre TEXT,
    director TEXT,
    writer TEXT,
    actors TEXT,
    plot TEXT,
    language TEXT,
    country TEXT,
    awards TEXT,
    poster TEXT,
    ratings TEXT,
    metascore TEXT,
    imdbRating TEXT,
    imdbVotes TEXT,
    type TEXT,
    dvd TEXT,
    boxOffice TEXT,
    production TEXT,
    website TEXT,
    response TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS file_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_path TEXT NOT NULL,
    new_path TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parsing_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    filename TEXT,
    normalized_filename TEXT,
    parse_torrent_name_result TEXT,
    initial_metadata TEXT,
    folder_metadata TEXT,
    final_metadata TEXT,
    full_path TEXT,
    root_scan_path TEXT,
    folder_parses TEXT
  );
`);

// Prepared statements
const insertTVShow = db.prepare(`
  INSERT OR REPLACE INTO tv_show (imdbID, title, year, rated, released, runtime, genre, director, writer, actors, plot, language, country, awards, poster, ratings, metascore, imdbRating, imdbVotes, type, totalSeasons, response)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTVShowEpisode = db.prepare(`
  INSERT OR REPLACE INTO tv_show_episode (imdbID, seriesID, title, year, rated, released, season, episode, runtime, genre, director, writer, actors, plot, language, country, awards, poster, ratings, metascore, imdbRating, imdbVotes, type, response)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMovie = db.prepare(`
  INSERT OR REPLACE INTO movies (imdbID, title, year, rated, released, runtime, genre, director, writer, actors, plot, language, country, awards, poster, ratings, metascore, imdbRating, imdbVotes, type, dvd, boxOffice, production, website, response)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);


/**
 * Saves complete TV show data from OMDB API to the database.
 * Inserts or replaces TV show information including metadata, ratings, and series details.
 *
 * @function saveTVShow
 * @param {Record<string, unknown>} showData - TV show data from OMDB API
 * @returns {void}
 *
 * @example
 * const showData = {
 *   imdbID: 'tt0903747',
 *   Title: 'Breaking Bad',
 *   Year: '2008-2013',
 *   Genre: 'Crime, Drama, Thriller',
 *   // ... other OMDB fields
 * };
 * saveTVShow(showData);
 * // Saves TV show to database
 *
 * @example
 * // Edge case: Missing fields
 * const incompleteData = { imdbID: 'tt123', Title: 'Test Show' };
 * saveTVShow(incompleteData);
 * // Saves with empty strings for missing fields
 */
export function saveTVShow(showData: Record<string, unknown>): void {
  insertTVShow.run(
    String(showData.imdbID || ''),
    String(showData.Title || ''),
    String(showData.Year || ''),
    String(showData.Rated || ''),
    String(showData.Released || ''),
    String(showData.Runtime || ''),
    String(showData.Genre || ''),
    String(showData.Director || ''),
    String(showData.Writer || ''),
    String(showData.Actors || ''),
    String(showData.Plot || ''),
    String(showData.Language || ''),
    String(showData.Country || ''),
    String(showData.Awards || ''),
    String(showData.Poster || ''),
    JSON.stringify(showData.Ratings || []),
    String(showData.Metascore || ''),
    String(showData.imdbRating || ''),
    String(showData.imdbVotes || ''),
    String(showData.Type || ''),
    String(showData.totalSeasons || ''),
    String(showData.Response || '')
  );
}

/**
 * Saves complete movie data from OMDB API to the database.
 * Inserts or replaces movie information including metadata, ratings, and production details.
 *
 * @function saveMovie
 * @param {Record<string, unknown>} movieData - Movie data from OMDB API
 * @returns {void}
 *
 * @example
 * const movieData = {
 *   imdbID: 'tt0133093',
 *   Title: 'The Matrix',
 *   Year: '1999',
 *   Genre: 'Action, Sci-Fi',
 *   // ... other OMDB fields
 * };
 * saveMovie(movieData);
 * // Saves movie to database
 *
 * @example
 * // Edge case: Missing fields
 * const incompleteData = { imdbID: 'tt123', Title: 'Test Movie' };
 * saveMovie(incompleteData);
 * // Saves with empty strings for missing fields
 */
export function saveMovie(movieData: Record<string, unknown>): void {
  insertMovie.run(
    String(movieData.imdbID || ''),
    String(movieData.Title || ''),
    String(movieData.Year || ''),
    String(movieData.Rated || ''),
    String(movieData.Released || ''),
    String(movieData.Runtime || ''),
    String(movieData.Genre || ''),
    String(movieData.Director || ''),
    String(movieData.Writer || ''),
    String(movieData.Actors || ''),
    String(movieData.Plot || ''),
    String(movieData.Language || ''),
    String(movieData.Country || ''),
    String(movieData.Awards || ''),
    String(movieData.Poster || ''),
    JSON.stringify(movieData.Ratings || []),
    String(movieData.Metascore || ''),
    String(movieData.imdbRating || ''),
    String(movieData.imdbVotes || ''),
    String(movieData.Type || ''),
    String(movieData.DVD || ''),
    String(movieData.BoxOffice || ''),
    String(movieData.Production || ''),
    String(movieData.Website || ''),
    String(movieData.Response || '')
  );
}

/**
 * Saves complete TV episode data from OMDB API to the database.
 * Inserts or replaces episode information including metadata and series association.
 *
 * @function saveTVShowEpisode
 * @param {Record<string, unknown>} episodeData - Episode data from OMDB API
 * @returns {void}
 *
 * @example
 * const episodeData = {
 *   imdbID: 'tt1234567',
 *   seriesID: 'tt0903747',
 *   Title: 'Pilot',
 *   Season: 1,
 *   Episode: 1,
 *   // ... other OMDB fields
 * };
 * saveTVShowEpisode(episodeData);
 * // Saves episode to database
 *
 * @example
 * // Edge case: Missing fields
 * const incompleteData = { imdbID: 'tt123', seriesID: 'tt456', Title: 'Test Episode' };
 * saveTVShowEpisode(incompleteData);
 * // Saves with defaults for missing numeric fields
 */
export function saveTVShowEpisode(episodeData: Record<string, unknown>): void {
  insertTVShowEpisode.run(
    String(episodeData.imdbID || ''),
    String(episodeData.seriesID || ''),
    String(episodeData.Title || ''),
    String(episodeData.Year || ''),
    String(episodeData.Rated || ''),
    String(episodeData.Released || ''),
    Number(episodeData.Season || 0),
    Number(episodeData.Episode || 0),
    String(episodeData.Runtime || ''),
    String(episodeData.Genre || ''),
    String(episodeData.Director || ''),
    String(episodeData.Writer || ''),
    String(episodeData.Actors || ''),
    String(episodeData.Plot || ''),
    String(episodeData.Language || ''),
    String(episodeData.Country || ''),
    String(episodeData.Awards || ''),
    String(episodeData.Poster || ''),
    JSON.stringify(episodeData.Ratings || []),
    String(episodeData.Metascore || ''),
    String(episodeData.imdbRating || ''),
    String(episodeData.imdbVotes || ''),
    String(episodeData.Type || ''),
    String(episodeData.Response || '')
  );
}

/**
 * Retrieves a movie from the database by its title.
 * Returns the complete movie record if found, null otherwise.
 *
 * @function getMovieByTitle
 * @param {string} title - Movie title to search for
 * @returns {Record<string, unknown> | null} Movie data or null if not found
 *
 * @example
 * const movie = getMovieByTitle('The Matrix');
 * // Returns: { imdbID: 'tt0133093', title: 'The Matrix', ... } or null
 *
 * @example
 * // Edge case: Title not found
 * const movie = getMovieByTitle('NonExistent Movie');
 * // Returns: null
 *
 * @example
 * // Edge case: Empty title
 * const movie = getMovieByTitle('');
 * // Returns: null
 */
export function getMovieByTitle(title: string) {
  const stmt = db.prepare('SELECT * FROM movies WHERE title = ?');
  return stmt.get(title);
}

/**
 * Retrieves a movie from the database by its IMDb ID.
 * Returns the complete movie record if found, null otherwise.
 *
 * @function getMovieByImdbID
 * @param {string} imdbID - IMDb ID to search for
 * @returns {Record<string, unknown> | null} Movie data or null if not found
 *
 * @example
 * const movie = getMovieByImdbID('tt0133093');
 * // Returns: { imdbID: 'tt0133093', title: 'The Matrix', ... } or null
 *
 * @example
 * // Edge case: Invalid IMDb ID
 * const movie = getMovieByImdbID('invalid');
 * // Returns: null
 */
export function getMovieByImdbID(imdbID: string) {
  const stmt = db.prepare('SELECT * FROM movies WHERE imdbID = ?');
  return stmt.get(imdbID);
}

/**
 * Retrieves a TV show from the database by its title.
 * Returns the complete TV show record if found, null otherwise.
 *
 * @function getTVShowByTitle
 * @param {string} title - TV show title to search for
 * @returns {Record<string, unknown> | null} TV show data or null if not found
 *
 * @example
 * const show = getTVShowByTitle('Breaking Bad');
 * // Returns: { imdbID: 'tt0903747', title: 'Breaking Bad', ... } or null
 *
 * @example
 * // Edge case: Title not found
 * const show = getTVShowByTitle('NonExistent Show');
 * // Returns: null
 */
export function getTVShowByTitle(title: string) {
  const stmt = db.prepare('SELECT * FROM tv_show WHERE title = ?');
  return stmt.get(title);
}

/**
 * Retrieves a TV show from the database by its IMDb ID.
 * Returns the complete TV show record if found, null otherwise.
 *
 * @function getTVShowByImdbID
 * @param {string} imdbID - IMDb ID to search for
 * @returns {Record<string, unknown> | null} TV show data or null if not found
 *
 * @example
 * const show = getTVShowByImdbID('tt0903747');
 * // Returns: { imdbID: 'tt0903747', title: 'Breaking Bad', ... } or null
 *
 * @example
 * // Edge case: Invalid IMDb ID
 * const show = getTVShowByImdbID('invalid');
 * // Returns: null
 */
export function getTVShowByImdbID(imdbID: string) {
  const stmt = db.prepare('SELECT * FROM tv_show WHERE imdbID = ?');
  return stmt.get(imdbID);
}

/**
 * Retrieves a specific TV episode from the database by series IMDb ID, season, and episode number.
 * Returns the complete episode record if found, null otherwise.
 *
 * @function getTVEpisode
 * @param {string} seriesImdbID - IMDb ID of the TV series
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @returns {Record<string, unknown> | null} Episode data or null if not found
 *
 * @example
 * const episode = getTVEpisode('tt0903747', 1, 1);
 * // Returns: { imdbID: 'tt1234567', title: 'Pilot', season: 1, episode: 1, ... } or null
 *
 * @example
 * // Edge case: Episode not found
 * const episode = getTVEpisode('tt0903747', 99, 99);
 * // Returns: null
 *
 * @example
 * // Edge case: Invalid series ID
 * const episode = getTVEpisode('invalid', 1, 1);
 * // Returns: null
 */
export function getTVEpisode(seriesImdbID: string, season: number, episode: number) {
  const stmt = db.prepare('SELECT * FROM tv_show_episode WHERE seriesID = ? AND season = ? AND episode = ?');
  const result = stmt.get(seriesImdbID, season, episode);
  return result;
}

/**
 * Retrieves all episodes for a TV series from the database.
 * Returns episodes ordered by season and episode number.
 *
 * @function getTVShowEpisodes
 * @param {string} seriesImdbID - IMDb ID of the TV series
 * @returns {Record<string, unknown>[]} Array of episode records
 *
 * @example
 * const episodes = getTVShowEpisodes('tt0903747');
 * // Returns: [{ season: 1, episode: 1, title: 'Pilot', ... }, ...]
 *
 * @example
 * // Edge case: Series with no episodes
 * const episodes = getTVShowEpisodes('tt0000000');
 * // Returns: []
 *
 * @example
 * // Edge case: Invalid series ID
 * const episodes = getTVShowEpisodes('invalid');
 * // Returns: []
 */
export function getTVShowEpisodes(seriesImdbID: string): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM tv_show_episode WHERE seriesID = ? ORDER BY season, episode');
  return stmt.all(seriesImdbID) as Record<string, unknown>[];
}

/**
 * Retrieves all available seasons for a TV series from the database.
 * Returns distinct season numbers ordered numerically.
 *
 * @function getTVShowSeasons
 * @param {string} seriesImdbID - IMDb ID of the TV series
 * @returns {Record<string, unknown>[]} Array of season records with season numbers
 *
 * @example
 * const seasons = getTVShowSeasons('tt0903747');
 * // Returns: [{ season: 1 }, { season: 2 }, ...]
 *
 * @example
 * // Edge case: Series with no seasons
 * const seasons = getTVShowSeasons('tt0000000');
 * // Returns: []
 */
export function getTVShowSeasons(seriesImdbID: string): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT DISTINCT season FROM tv_show_episode WHERE seriesID = ? ORDER BY season');
  return stmt.all(seriesImdbID) as Record<string, unknown>[];
}

/**
 * Saves multiple TV episodes to the database in a batch operation.
 * Efficiently inserts or replaces multiple episodes for a season.
 *
 * @function saveTVEpisodeBatch
 * @param {Record<string, unknown>[]} episodes - Array of episode data from OMDB API
 * @returns {void}
 *
 * @example
 * const episodes = [
 *   { imdbID: 'tt123', seriesID: 'tt456', Title: 'Episode 1', Season: 1, Episode: 1 },
 *   { imdbID: 'tt124', seriesID: 'tt456', Title: 'Episode 2', Season: 1, Episode: 2 }
 * ];
 * saveTVEpisodeBatch(episodes);
 * // Saves all episodes to database
 *
 * @example
 * // Edge case: Empty array
 * saveTVEpisodeBatch([]);
 * // Does nothing
 *
 * @example
 * // Edge case: Episodes with missing data
 * const incompleteEpisodes = [
 *   { imdbID: 'tt123', Title: 'Episode' } // Missing seriesID, season, episode
 * ];
 * saveTVEpisodeBatch(incompleteEpisodes);
 * // Saves with empty/default values
 */
export function saveTVEpisodeBatch(episodes: Record<string, unknown>[]): void {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO tv_show_episode (imdbID, seriesID, title, year, rated, released, season, episode, runtime, genre, director, writer, actors, plot, language, country, awards, poster, ratings, metascore, imdbRating, imdbVotes, type, response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const episode of episodes) {
    insertStmt.run(
      String(episode.imdbID || ''),
      String(episode.seriesID || ''),
      String(episode.Title || ''),
      String(episode.Year || ''),
      String(episode.Rated || ''),
      String(episode.Released || ''),
      Number(episode.Season || 0),
      Number(episode.Episode || 0),
      String(episode.Runtime || ''),
      String(episode.Genre || ''),
      String(episode.Director || ''),
      String(episode.Writer || ''),
      String(episode.Actors || ''),
      String(episode.Plot || ''),
      String(episode.Language || ''),
      String(episode.Country || ''),
      String(episode.Awards || ''),
      String(episode.Poster || ''),
      JSON.stringify(episode.Ratings || []),
      String(episode.Metascore || ''),
      String(episode.imdbRating || ''),
      String(episode.imdbVotes || ''),
      String(episode.Type || ''),
      String(episode.Response || '')
    );
  }
}

/**
 * Records a file move operation in the database for tracking and potential reversion.
 * Stores original and new paths with timestamp for audit trail.
 *
 * @function saveFileMove
 * @param {string} originalPath - Original file path before move
 * @param {string} newPath - New file path after move
 * @returns {void}
 *
 * @example
 * saveFileMove('/old/path/movie.avi', '/new/path/movie.avi');
 * // Records the move in database
 *
 * @example
 * // Edge case: Same paths
 * saveFileMove('/same/path/file.avi', '/same/path/file.avi');
 * // Still records the operation
 */
export function saveFileMove(originalPath: string, newPath: string): void {
  db.prepare(`
    INSERT INTO file_moves (original_path, new_path)
    VALUES (?, ?)
  `).run(originalPath, newPath);
}

/**
 * Retrieves the most recent file move operations from the database.
 * Returns up to 100 most recent moves ordered by timestamp descending.
 *
 * @function getRecentMoves
 * @returns {FileMove[]} Array of recent file move records
 *
 * @example
 * const moves = getRecentMoves();
 * // Returns: [{ id: 1, original_path: '...', new_path: '...', timestamp: '...' }, ...]
 *
 * @example
 * // Edge case: No moves in database
 * const moves = getRecentMoves();
 * // Returns: []
 */
export function getRecentMoves(): FileMove[] {
  const stmt = db.prepare('SELECT * FROM file_moves ORDER BY timestamp DESC LIMIT 100');
  return stmt.all() as FileMove[];
}

/**
 * Retrieves the most recent file move operations for potential reversion.
 * Returns specified number of moves ordered by timestamp descending.
 *
 * @function revertLastMoves
 * @param {number} [count=10] - Number of recent moves to retrieve
 * @returns {FileMove[]} Array of recent file move records
 *
 * @example
 * const moves = revertLastMoves(5);
 * // Returns last 5 moves for potential reversion
 *
 * @example
 * // Edge case: Count exceeds available moves
 * const moves = revertLastMoves(1000);
 * // Returns all available moves
 *
 * @example
 * // Edge case: Count is 0
 * const moves = revertLastMoves(0);
 * // Returns: []
 */
export function revertLastMoves(count: number = 10): FileMove[] {
  const stmt = db.prepare('SELECT * FROM file_moves ORDER BY timestamp DESC LIMIT ?');
  const moves = stmt.all(count) as FileMove[];
  return moves;
}

/**
 * Retrieves all movies from the database ordered by title.
 * Returns complete movie records for all stored movies.
 *
 * @function getAllMovies
 * @returns {Record<string, unknown>[]} Array of all movie records
 *
 * @example
 * const movies = getAllMovies();
 * // Returns: [{ title: 'A Movie', ... }, { title: 'B Movie', ... }, ...]
 *
 * @example
 * // Edge case: No movies in database
 * const movies = getAllMovies();
 * // Returns: []
 */
export function getAllMovies(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM movies ORDER BY title');
  return stmt.all() as Record<string, unknown>[];
}

/**
 * Retrieves all TV shows from the database ordered by title.
 * Returns complete TV show records for all stored series.
 *
 * @function getAllTVShows
 * @returns {Record<string, unknown>[]} Array of all TV show records
 *
 * @example
 * const shows = getAllTVShows();
 * // Returns: [{ title: 'Breaking Bad', ... }, { title: 'Game of Thrones', ... }, ...]
 *
 * @example
 * // Edge case: No TV shows in database
 * const shows = getAllTVShows();
 * // Returns: []
 */
export function getAllTVShows(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM tv_show ORDER BY title');
  return stmt.all() as Record<string, unknown>[];
}

/**
 * Retrieves all TV episodes from the database ordered by series, season, and episode.
 * Returns complete episode records for all stored episodes.
 *
 * @function getAllTVEpisodes
 * @returns {Record<string, unknown>[]} Array of all TV episode records
 *
 * @example
 * const episodes = getAllTVEpisodes();
 * // Returns: [{ seriesID: 'tt123', season: 1, episode: 1, ... }, ...]
 *
 * @example
 * // Edge case: No episodes in database
 * const episodes = getAllTVEpisodes();
 * // Returns: []
 */
export function getAllTVEpisodes(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM tv_show_episode ORDER BY seriesID, season, episode');
  return stmt.all() as Record<string, unknown>[];
}

/**
 * Saves parsing debug information to the database for troubleshooting.
 * Stores filename parsing steps and intermediate results.
 *
 * @function saveParsingLog
 * @param {object} logData - Parsing log data
 * @param {string} logData.filename - Original filename
 * @param {string} logData.normalized_filename - Normalized filename
 * @param {any} logData.parse_torrent_name_result - Result from parse-torrent-name library
 * @param {any} logData.initial_metadata - Initial metadata after parsing
 * @param {any} logData.folder_metadata - Metadata from folder parsing
 * @param {any} logData.final_metadata - Final metadata result
 * @param {string} [logData.full_path] - Full file path
 * @param {string} [logData.root_scan_path] - Root scan path
 * @param {any[]} [logData.folder_parses] - Array of folder parse results
 * @returns {void}
 *
 * @example
 * saveParsingLog({
 *   filename: "Show.S01E01.mkv",
 *   normalized_filename: "Show.S01E01.mkv",
 *   parse_torrent_name_result: { title: "Show", season: 1, episode: 1 },
 *   initial_metadata: { title: "Show", season: 1, episode: 1, type: "tv" },
 *   folder_metadata: {},
 *   final_metadata: { title: "Show", season: 1, episode: 1, type: "tv" }
 * });
 * // Saves parsing log to database
 */
export function saveParsingLog(logData: {
  filename: string;
  normalized_filename: string;
  parse_torrent_name_result: any;
  initial_metadata: any;
  folder_metadata: any;
  final_metadata: any;
  full_path?: string;
  root_scan_path?: string;
  folder_parses?: any[];
}): void {
  if (process.env.ENABLE_PARSER_LOGGING !== 'true') {
    return; // Skip logging if not enabled
  }

  db.prepare(`
    INSERT INTO parsing_logs (
      filename, normalized_filename, parse_torrent_name_result,
      initial_metadata, folder_metadata, final_metadata,
      full_path, root_scan_path, folder_parses
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    logData.filename,
    logData.normalized_filename,
    JSON.stringify(logData.parse_torrent_name_result),
    JSON.stringify(logData.initial_metadata),
    JSON.stringify(logData.folder_metadata),
    JSON.stringify(logData.final_metadata),
    logData.full_path || null,
    logData.root_scan_path || null,
    logData.folder_parses ? JSON.stringify(logData.folder_parses) : null
  );
}

/**
 * Retrieves recent parsing logs from the database for debugging.
 * Returns logs ordered by timestamp descending.
 *
 * @function getRecentParsingLogs
 * @param {number} [limit=50] - Maximum number of logs to retrieve
 * @returns {any[]} Array of parsing log records
 *
 * @example
 * const logs = getRecentParsingLogs(10);
 * // Returns last 10 parsing logs
 *
 * @example
 * // Get all recent logs
 * const logs = getRecentParsingLogs();
 * // Returns last 50 parsing logs
 */
export function getRecentParsingLogs(limit: number = 50): any[] {
  const stmt = db.prepare('SELECT * FROM parsing_logs ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(limit) as any[];
}

/**
 * Closes the database connection and releases resources.
 * Should be called when the application is shutting down.
 *
 * @function closeDatabase
 * @returns {void}
 *
 * @example
 * // At application shutdown
 * process.on('exit', () => {
 *   closeDatabase();
 * });
 *
 * @example
 * // Manual cleanup
 * closeDatabase();
 * // Database connection closed
 */
export function closeDatabase(): void {
  db.close();
}