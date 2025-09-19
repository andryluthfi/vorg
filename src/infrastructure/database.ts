import { Database } from 'bun:sqlite';
import * as path from 'path';
import * as fs from 'fs';

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


// Save full OMDB TV show data
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

// Save full OMDB movie data
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

// Save full OMDB episode data
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

export function getMovieByTitle(title: string) {
  const stmt = db.prepare('SELECT * FROM movies WHERE title = ?');
  return stmt.get(title);
}

export function getMovieByImdbID(imdbID: string) {
  const stmt = db.prepare('SELECT * FROM movies WHERE imdbID = ?');
  return stmt.get(imdbID);
}

export function getTVShowByTitle(title: string) {
  const stmt = db.prepare('SELECT * FROM tv_show WHERE title = ?');
  return stmt.get(title);
}

export function getTVShowByImdbID(imdbID: string) {
  const stmt = db.prepare('SELECT * FROM tv_show WHERE imdbID = ?');
  return stmt.get(imdbID);
}

export function getTVEpisode(seriesImdbID: string, season: number, episode: number) {
  const stmt = db.prepare('SELECT * FROM tv_show_episode WHERE seriesID = ? AND season = ? AND episode = ?');
  return stmt.get(seriesImdbID, season, episode);
}

export function getTVShowEpisodes(seriesImdbID: string): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM tv_show_episode WHERE seriesID = ? ORDER BY season, episode');
  return stmt.all(seriesImdbID) as Record<string, unknown>[];
}

export function getTVShowSeasons(seriesImdbID: string): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT DISTINCT season FROM tv_show_episode WHERE seriesID = ? ORDER BY season');
  return stmt.all(seriesImdbID) as Record<string, unknown>[];
}

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

export function saveFileMove(originalPath: string, newPath: string): void {
  db.prepare(`
    INSERT INTO file_moves (original_path, new_path)
    VALUES (?, ?)
  `).run(originalPath, newPath);
}

export function getRecentMoves(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM file_moves ORDER BY timestamp DESC LIMIT 100');
  return stmt.all() as Record<string, unknown>[];
}

export function revertLastMoves(count: number = 10): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM file_moves ORDER BY timestamp DESC LIMIT ?');
  const moves = stmt.all(count) as Record<string, unknown>[];
  return moves;
}

export function getAllMovies(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM movies ORDER BY title');
  return stmt.all() as Record<string, unknown>[];
}

export function getAllTVShows(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM tv_show ORDER BY title');
  return stmt.all() as Record<string, unknown>[];
}

export function getAllTVEpisodes(): Record<string, unknown>[] {
  const stmt = db.prepare('SELECT * FROM tv_show_episode ORDER BY seriesID, season, episode');
  return stmt.all() as Record<string, unknown>[];
}

export function closeDatabase(): void {
  db.close();
}