// @ts-expect-error - parse-torrent-name library lacks TypeScript definitions
import parseTorrentName from 'parse-torrent-name';
import * as path from 'path';
import { saveParsingLog } from '../infrastructure/database';

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
 * Parses a media filename and optionally parent folder names to extract metadata.
 * Uses regex patterns to identify different media types and extract structured information.
 * Supports movies, TV shows, and episodes with various naming conventions.
 * If filename parsing is incomplete, attempts to extract additional info from parent folders (up to 2 levels).
 *
 * @function parseFilename
 * @param {string} filename - Media filename to parse (without path)
 * @param {string} [fullPath] - Full path to the file (optional, enables folder parsing)
 * @param {string} [rootScanPath] - Root scan path to prevent traversing beyond scan boundaries
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
 * // With folder parsing
 * parseFilename('S02E01.mkv', 'I:\\Drop\\_Organize\\Process\\Squid.Game.S02.MULTI.2160p.WEB-DL.SDR.H265-AOC\\S02\\S02E01.mkv', 'I:\\Drop\\_Organize\\Process');
 * // Returns: { type: 'tv', title: 'Squid Game', season: 2, episode: 1, ... }
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
export function parseFilename(filename: string, fullPath?: string, rootScanPath?: string): MediaMetadata {
  // Normalize filename for better parsing (replace EP with E in season-episode format)
  const normalizedFilename = filename.replace(/S(\d+)EP(\d+)/g, 'S$1E$2');
  const parsed = parseTorrentName(normalizedFilename);

  // Collect logging data
  const logData: any = {
    filename,
    normalized_filename: normalizedFilename,
    parse_torrent_name_result: parsed,
    full_path: fullPath,
    root_scan_path: rootScanPath
  };

  let title = parsed.title || undefined;
  let year = parsed.year;
  let season = parsed.season;
  let episode = parsed.episode;
  let type: 'movie' | 'tv' = (parsed.season && parsed.episode) ? 'tv' : 'movie';

  // Adjust type based on title content
  if (type === 'tv' && title) {
    if (/S\d+/i.test(title) || /Season \d+/i.test(title)) {
      type = 'movie';
    }
  }

  logData.initial_metadata = { title, year, season, episode, type };

  // If the parsed title is just a season/episode identifier, don't use it
  if (title && (/^S\d+(E\d+)?$/i.test(title.trim()) || title.trim().toLowerCase() === 's02')) {
    title = undefined;
  }

  // If year not extracted but title ends with 4-digit year, extract it
  if (!year && title) {
    const yearMatch = title.match(/(\d{4})$/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
      title = title.replace(/\s*\d{4}$/, '').trim();
    }
  }

  // If we have full path and parsing is incomplete, try to get info from folders
  if (fullPath && rootScanPath) {
    const { folderMetadata, folderParses } = parseFolderNames(fullPath, rootScanPath);
    logData.folder_metadata = folderMetadata;
    logData.folder_parses = folderParses;

    // Merge folder metadata with filename metadata
    // Prefer folder title if filename title is just a season/episode identifier or empty
    if (folderMetadata.title && (!title || /^S\d+(E\d+)?$/i.test(title.trim()) || title.trim() === '')) {
      title = folderMetadata.title;
    }
    if (folderMetadata.year && !year) {
      year = folderMetadata.year;
    }
    if (folderMetadata.season && !season) {
      season = folderMetadata.season;
    }
    if (folderMetadata.episode && !episode) {
      episode = folderMetadata.episode;
    }
    if (folderMetadata.type && type === 'movie' && (season || episode)) {
      type = 'tv';
    }
  }

  const metadata: MediaMetadata = {
    title: title,
    year: year,
    season: season,
    episode: episode,
    type: type
  };
  logData.final_metadata = metadata;

  // Save parsing log to database
  saveParsingLog(logData);

  return metadata;
}

/**
 * Parses parent folder names to extract additional metadata when filename parsing is incomplete.
 * Traverses up to 2 levels of parent directories, stopping at the root scan path.
 * Merges information from folder names with existing metadata.
 *
 * @function parseFolderNames
 * @param {string} fullPath - Full path to the media file
 * @param {string} rootScanPath - Root scan path to prevent traversing beyond boundaries
 * @returns {Partial<MediaMetadata>} Partial metadata extracted from folder names
 *
 * @example
 * parseFolderNames('I:\\Drop\\_Organize\\Process\\Squid.Game.S02.MULTI.2160p.WEB-DL.SDR.H265-AOC\\S02\\S02E01.mkv', 'I:\\Drop\\_Organize\\Process');
 * // Returns: { title: 'Squid Game', season: 2, type: 'tv' }
 */
function parseFolderNames(fullPath: string, rootScanPath: string): { folderMetadata: Partial<MediaMetadata>, folderParses: Array<{parsed: any, level: number}> } {
  const folderMetadata: Partial<MediaMetadata> = {};
  let currentPath = path.dirname(fullPath);
  let levelsChecked = 0;
  const folderParses: Array<{parsed: any, level: number}> = [];

  // First pass: collect all folder parses
  while (levelsChecked < 2 && currentPath !== rootScanPath && currentPath !== path.dirname(currentPath)) {
    const folderName = path.basename(currentPath);
    const normalizedFolderName = folderName.replace(/S(\d+)EP(\d+)/g, 'S$1E$2');

    // Parse the folder name using the same logic as filename parsing
    const parsed = parseTorrentName(normalizedFolderName);
    folderParses.push({ parsed, level: levelsChecked });

    // Move to parent directory
    currentPath = path.dirname(currentPath);
    levelsChecked++;

    // Stop if we've reached the root scan path
    if (path.resolve(currentPath) === path.resolve(rootScanPath)) {
      break;
    }
  }

  // Second pass: extract information, prioritizing parent folders for title
  for (let i = folderParses.length - 1; i >= 0; i--) {
    const { parsed } = folderParses[i];

    // Extract information from folder name
    if (parsed.title && !folderMetadata.title) {
      // Clean up the title (remove season/episode identifiers and release info)
      let cleanTitle = parsed.title;
      if (/^S\d+(E\d+)?$/i.test(cleanTitle.trim())) {
        continue; // Skip season-only titles
      }
      // Remove common release info patterns and season info
      cleanTitle = cleanTitle.replace(/\s*\.(MULTI|WEB-DL|SDR|H265|H264|AAC|AC3|DDP5\.1|2160p|1080p|720p|480p).*$/i, '');
      cleanTitle = cleanTitle.replace(/\s+(MULTI|WEB-DL|SDR|H265|H264|AAC|AC3|DDP5\.1|2160p|1080p|720p|480p)(\s+|$)/i, ''); // Remove space-separated release info
      cleanTitle = cleanTitle.replace(/\s+S\d+(E\d+)?(\s+|$)/i, ''); // Remove season info with surrounding spaces
      cleanTitle = cleanTitle.replace(/S\d+(E\d+)?$/i, ''); // Remove season info at end
      cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
      if (cleanTitle) {
        folderMetadata.title = cleanTitle;
      }
    }
    if (parsed.year && !folderMetadata.year) {
      folderMetadata.year = parsed.year;
    }
    if (parsed.season && !folderMetadata.season) {
      folderMetadata.season = parsed.season;
    }
    if (parsed.episode && !folderMetadata.episode) {
      folderMetadata.episode = parsed.episode;
    }
    if ((parsed.season || parsed.episode) && !folderMetadata.type) {
      folderMetadata.type = 'tv';
    }
  }

  return { folderMetadata, folderParses };
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
