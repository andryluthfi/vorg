import { Database } from 'bun:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import { EnrichedMetadata } from '../core-data/parser';

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

const insertFileMove = db.prepare(`
  INSERT INTO file_moves (original_path, new_path)
  VALUES (?, ?)
`);

// Save full OMDB TV show data
export function saveTVShow(showData: any, testDb?: Database): void {
  const targetDb = testDb || db;
  insertTVShow.run(
    showData.imdbID,
    showData.Title,
    showData.Year,
    showData.Rated,
    showData.Released,
    showData.Runtime,
    showData.Genre,
    showData.Director,
    showData.Writer,
    showData.Actors,
    showData.Plot,
    showData.Language,
    showData.Country,
    showData.Awards,
    showData.Poster,
    JSON.stringify(showData.Ratings || []),
    showData.Metascore,
    showData.imdbRating,
    showData.imdbVotes,
    showData.Type,
    showData.totalSeasons,
    showData.Response
  );
}

// Save full OMDB movie data
export function saveMovie(movieData: any, testDb?: Database): void {
  const targetDb = testDb || db;
  insertMovie.run(
    movieData.imdbID,
    movieData.Title,
    movieData.Year,
    movieData.Rated,
    movieData.Released,
    movieData.Runtime,
    movieData.Genre,
    movieData.Director,
    movieData.Writer,
    movieData.Actors,
    movieData.Plot,
    movieData.Language,
    movieData.Country,
    movieData.Awards,
    movieData.Poster,
    JSON.stringify(movieData.Ratings || []),
    movieData.Metascore,
    movieData.imdbRating,
    movieData.imdbVotes,
    movieData.Type,
    movieData.DVD,
    movieData.BoxOffice,
    movieData.Production,
    movieData.Website,
    movieData.Response
  );
}

// Save full OMDB episode data
export function saveTVShowEpisode(episodeData: any, testDb?: Database): void {
  const targetDb = testDb || db;
  insertTVShowEpisode.run(
    episodeData.imdbID,
    episodeData.seriesID,
    episodeData.Title,
    episodeData.Year,
    episodeData.Rated,
    episodeData.Released,
    episodeData.Season,
    episodeData.Episode,
    episodeData.Runtime,
    episodeData.Genre,
    episodeData.Director,
    episodeData.Writer,
    episodeData.Actors,
    episodeData.Plot,
    episodeData.Language,
    episodeData.Country,
    episodeData.Awards,
    episodeData.Poster,
    JSON.stringify(episodeData.Ratings || []),
    episodeData.Metascore,
    episodeData.imdbRating,
    episodeData.imdbVotes,
    episodeData.Type,
    episodeData.Response
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

export function getTVShowEpisodes(seriesImdbID: string) {
  const stmt = db.prepare('SELECT * FROM tv_show_episode WHERE seriesID = ? ORDER BY season, episode');
  return stmt.all(seriesImdbID) as any[];
}

export function getTVShowSeasons(seriesImdbID: string) {
  const stmt = db.prepare('SELECT DISTINCT season FROM tv_show_episode WHERE seriesID = ? ORDER BY season');
  return stmt.all(seriesImdbID) as any[];
}

export function saveTVEpisodeBatch(episodes: any[], testDb?: Database): void {
  const targetDb = testDb || db;
  const insertStmt = targetDb.prepare(`
    INSERT OR REPLACE INTO tv_show_episode (imdbID, seriesID, title, year, rated, released, season, episode, runtime, genre, director, writer, actors, plot, language, country, awards, poster, ratings, metascore, imdbRating, imdbVotes, type, response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const episode of episodes) {
    insertStmt.run(
      episode.imdbID,
      episode.seriesID,
      episode.Title,
      episode.Year,
      episode.Rated,
      episode.Released,
      episode.Season,
      episode.Episode,
      episode.Runtime,
      episode.Genre,
      episode.Director,
      episode.Writer,
      episode.Actors,
      episode.Plot,
      episode.Language,
      episode.Country,
      episode.Awards,
      episode.Poster,
      JSON.stringify(episode.Ratings || []),
      episode.Metascore,
      episode.imdbRating,
      episode.imdbVotes,
      episode.Type,
      episode.Response
    );
  }
}

export function saveFileMove(originalPath: string, newPath: string, testDb?: Database): void {
  const targetDb = testDb || db;
  targetDb.prepare(`
    INSERT INTO file_moves (original_path, new_path)
    VALUES (?, ?)
  `).run(originalPath, newPath);
}

export function getRecentMoves(testDb?: Database): any[] {
  const targetDb = testDb || db;
  const stmt = targetDb.prepare('SELECT * FROM file_moves ORDER BY timestamp DESC LIMIT 100');
  return stmt.all() as any[];
}

export function revertLastMoves(count: number = 10): any[] {
  const stmt = db.prepare('SELECT * FROM file_moves ORDER BY timestamp DESC LIMIT ?');
  const moves = stmt.all(count) as any[];
  return moves;
}

export function getAllMovies(): any[] {
  const stmt = db.prepare('SELECT * FROM movies ORDER BY title');
  return stmt.all() as any[];
}

export function getAllTVShows(): any[] {
  const stmt = db.prepare('SELECT * FROM tv_show ORDER BY title');
  return stmt.all() as any[];
}

export function getAllTVEpisodes(): any[] {
  const stmt = db.prepare('SELECT * FROM tv_show_episode ORDER BY seriesID, season, episode');
  return stmt.all() as any[];
}

export function closeDatabase(): void {
  db.close();
}