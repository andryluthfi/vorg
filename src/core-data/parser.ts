const parseTorrentName = require('parse-torrent-name') as any;

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
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Remove trailing dots and spaces (Windows issue)
  sanitized = sanitized.replace(/[.\s]+$/, '');

  // Ensure not empty after sanitization
  if (!sanitized.trim()) {
    sanitized = 'Untitled';
  }

  return sanitized;
}

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
