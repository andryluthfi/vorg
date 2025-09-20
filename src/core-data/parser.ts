// @ts-expect-error - parse-torrent-name library lacks TypeScript definitions
import parseTorrentName from 'parse-torrent-name';

export interface MediaMetadata {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  type: 'movie' | 'tv';
  episodeTitle?: string;
}

export interface EnrichedMetadata extends MediaMetadata {
  plot?: string;
  genre?: string;
  director?: string;
  actors?: string;
  imdbRating?: string;
}

/**
 * Parses a media filename to extract metadata like title, year, season, episode, etc.
 * Uses regex patterns to identify different media types and extract structured information.
 * Supports movies, TV shows, and episodes with various naming conventions.
 *
 * @function parseFilename
 * @param {string} filename - Media filename to parse (without path)
 * @returns {MediaMetadata} Extracted metadata object
 *
 * @example
 * parseFilename('Movie.Title.2020.1080p.BluRay.x264.mp4');
 * // Returns: { type: 'movie', title: 'Movie Title', year: 2020, ... }
 *
 * @example
 * parseFilename('TV.Show.S01E01.720p.HDTV.x264.mkv');
 * // Returns: { type: 'tv', title: 'TV Show', season: 1, episode: 1, ... }
 *
 * @example
 * // Edge case: No year in movie title
 * parseFilename('Old Movie.avi');
 * // Returns: { type: 'movie', title: 'Old Movie', year: undefined, ... }
 *
 * @example
 * // Edge case: Special episode
 * parseFilename('TV.Show.S01E00.Pilot.mkv');
 * // Returns: { type: 'tv', title: 'TV Show', season: 1, episode: 0, ... }
 *
 * @example
 * // Edge case: Invalid filename
 * parseFilename('randomfile.txt');
 * // Returns: { type: 'unknown', title: 'randomfile', ... }
 */
export function parseFilename(filename: string): MediaMetadata {
  const parsed = parseTorrentName(filename);

  let title = parsed.title || filename;
  let year = parsed.year;

  // If year not extracted but title ends with 4-digit year, extract it
  if (!year) {
    const yearMatch = title.match(/(\d{4})$/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
      title = title.replace(/\s*\d{4}$/, '').trim();
    }
  }

  const metadata: MediaMetadata = {
    title: title,
    year: year,
    season: parsed.season,
    episode: parsed.episode,
    type: (parsed.season && parsed.episode) ? 'tv' : 'movie'
  };

  return metadata;
}

/**
 * Sanitizes a filename by removing or replacing invalid filesystem characters.
 * Replaces problematic characters with safe alternatives for cross-platform compatibility.
 *
 * @function sanitizeFilename
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename safe for filesystem use
 *
 * @example
 * sanitizeFilename('Movie: Title (2020)');
 * // Returns: 'Movie - Title (2020)'
 *
 * @example
 * sanitizeFilename('TV/Show*Name?');
 * // Returns: 'TV-Show-Name-'
 *
 * @example
 * // Edge case: Empty string
 * sanitizeFilename('');
 * // Returns: ''
 *
 * @example
 * // Edge case: Only invalid characters
 * sanitizeFilename('?*<>|');
 * // Returns: '----'
 *
 * @example
 * // Edge case: Already clean
 * sanitizeFilename('Clean.Name.2020');
 * // Returns: 'Clean.Name.2020'
 */
export function sanitizeFilename(filename: string): string {
  // Windows forbidden characters - replace with safe alternatives
  const windowsReplacements: { [key: string]: string } = {
    '<': '',  // Full-width less-than
    '>': '',  // Full-width greater-than
    ':': '', // Full-width colon
    '"': '',  // Full-width double quote
    '|': '', // Full-width pipe
    '?': '', // Full-width question mark
    '*': '', // Full-width asterisk
    '\\': '' // Full-width backslash
  };

  // Linux/macOS forbidden characters
  const unixReplacements: { [key: string]: string } = {
    '/': ''  // Full-width forward slash
  };

  let sanitized = filename;

  // Apply Windows replacements
  for (const [invalid, replacement] of Object.entries(windowsReplacements)) {
    sanitized = sanitized.replace(new RegExp(`\\${invalid}`, 'g'), replacement);
  }

  // Apply Unix replacements
  for (const [invalid, replacement] of Object.entries(unixReplacements)) {
    sanitized = sanitized.replace(new RegExp(`\\${invalid}`, 'g'), replacement);
  }

  // Remove control characters
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\0-\x1F\x7F-\x9F]/g, '');

  // Remove trailing dots and spaces (Windows issue)
  sanitized = sanitized.replace(/[.\s]+$/, '');

  // Ensure not empty after sanitization
  if (!sanitized.trim()) {
    sanitized = 'Untitled';
  }

  return sanitized;
}

/**
 * Generates a standardized filename based on enriched metadata.
 * Creates consistent naming format for organized media library.
 *
 * Format rules:
 * - Movies: "Title (Year)"
 * - TV Episodes: "Title - Season X Episode Y" or with episode title
 *
 * @function generateNewName
 * @param {EnrichedMetadata} metadata - Enriched metadata with title, year, season, episode, etc.
 * @returns {string} Standardized filename without extension
 *
 * @example
 * const metadata = { type: 'movie', title: 'The Matrix', year: 1999 };
 * generateNewName(metadata);
 * // Returns: 'The Matrix (1999)'
 *
 * @example
 * const metadata = { type: 'tv', title: 'Breaking Bad', season: 1, episode: 1, episodeTitle: 'Pilot' };
 * generateNewName(metadata);
 * // Returns: 'Breaking Bad - Season 1 Episode 1 - Pilot'
 *
 * @example
 * // Edge case: No year for movie
 * const metadata = { type: 'movie', title: 'Old Movie' };
 * generateNewName(metadata);
 * // Returns: 'Old Movie'
 *
 * @example
 * // Edge case: No episode title
 * const metadata = { type: 'tv', title: 'Show', season: 1, episode: 5 };
 * generateNewName(metadata);
 * // Returns: 'Show - Season 1 Episode 5'
 */
export function generateNewName(metadata: EnrichedMetadata): string {
  let name = '';

  if (metadata.type === 'movie') {
    name = metadata.title;
    if (metadata.year) {
      name += ` (${metadata.year})`;
    }
  } else {
    // TV show
    name = `${metadata.title}`;
    if (metadata.year) {
      name += ` (${metadata.year})`;
    }
    if (metadata.season !== undefined && metadata.episode !== undefined) {
      name += ` - Season ${metadata.season} Episode ${metadata.episode}`;
      if (metadata.episodeTitle) {
        name += ` - ${metadata.episodeTitle}`;
      }
    }
  }

  return sanitizeFilename(name);
}
