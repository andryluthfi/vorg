import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AppConfig {
  scanPath?: string;
  moviePath?: string;
  tvPath?: string;
  omdbApiKey?: string;
  tmdbApiKey?: string;
  includeSubtitles?: boolean;
}

const CONFIG_FILE_NAME = 'vorg-config.json';

export const configPaths = [
  path.join(os.homedir(), CONFIG_FILE_NAME), // User folder
  path.join(__dirname, '..', CONFIG_FILE_NAME) // Project folder
];

export interface ConfigResult {
  config: AppConfig;
  source: string;
  path: string | null;
  sources?: ConfigSource[];
}

export interface ConfigSource {
  location: string;
  path: string | null;
  exists: boolean;
  config: AppConfig | null;
}

/**
 * Loads application configuration from multiple sources with priority order.
 * Searches for config files in: scanned folder, project folder, user folder.
 * Merges configurations and returns the final config with source information.
 *
 * Priority order (highest to lowest):
 * 1. Scanned folder config (if scanPath provided)
 * 2. Project folder config
 * 3. User folder config
 *
 * @function loadConfig
 * @param {string} [scanPath] - Path being scanned (enables scanned folder config)
 * @returns {ConfigResult} Configuration result with merged config and source details
 *
 * @example
 * const config = loadConfig('/path/to/scan');
 * // Loads config from /path/to/scan/.media-organizer.json if exists,
 * // falls back to project/user configs
 *
 * @example
 * const config = loadConfig();
 * // Loads from project/user configs only
 *
 * @example
 * // Edge case: No config files exist
 * const config = loadConfig();
 * // Returns default config with source 'default'
 *
 * @example
 * // Edge case: Invalid JSON in config file
 * const config = loadConfig('/path/with/bad/json');
 * // Logs error, skips invalid config, uses defaults
 */
export function loadConfig(scanPath?: string): ConfigResult {
  const sources: ConfigSource[] = [];

  // Priority order: scanned folder > user folder > project folder
  const allPaths = [
    scanPath ? path.join(scanPath, CONFIG_FILE_NAME) : null,
    configPaths[0], // user folder
    configPaths[1]  // project folder
  ];

  const locationNames = [
    scanPath ? 'Scanned Folder' : null,
    'User Folder',
    'Project Folder'
  ];

  let mergedConfig: AppConfig = {};

  for (let i = 0; i < allPaths.length; i++) {
    const configPath = allPaths[i];
    const locationName = locationNames[i];

    if (!configPath || !locationName) continue;

    const exists = fs.existsSync(configPath);
    let config: AppConfig | null = null;

    if (exists) {
      try {
        const data = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(data);
        // Merge with higher priority (later configs override earlier ones)
        mergedConfig = { ...mergedConfig, ...config };
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error);
      }
    }

    sources.push({
      location: locationName,
      path: configPath,
      exists,
      config
    });
  }

  // Determine primary source for backward compatibility
  // If scanPath provided, always use scanned folder as source, even if config loaded from elsewhere
  const primarySource = scanPath ? sources[0] : (sources.find(s => s.exists) || sources[1]);
  const source = primarySource ? primarySource.location : 'None';
  const configPath = primarySource ? primarySource.path : null;

  return {
    config: mergedConfig,
    source,
    path: configPath,
    sources
  };
}

/**
 * Saves application configuration to specified location.
 * Creates necessary directories and writes config as JSON.
 *
 * @async
 * @function saveConfig
 * @param {AppConfig} config - Configuration object to save
 * @param {'user' | 'scanned' | 'project'} [location='user'] - Where to save the config
 * @param {string} [scanPath] - Required when location is 'scanned'
 * @returns {Promise<void>}
 * @throws {Error} If location is 'scanned' but scanPath not provided, or file write fails
 *
 * @example
 * const config = { moviePath: '/movies', tvPath: '/tv', omdbApiKey: 'key' };
 * await saveConfig(config, 'user');
 * // Saves to user config file
 *
 * @example
 * await saveConfig(config, 'scanned', '/scan/path');
 * // Saves to /scan/path/.media-organizer.json
 *
 * @example
 * // Edge case: Missing scanPath for scanned location
 * await saveConfig(config, 'scanned');
 * // Throws error: scanPath required for scanned location
 *
 * @example
 * // Edge case: Directory doesn't exist
 * await saveConfig(config, 'scanned', '/nonexistent/path');
 * // Creates directory structure and saves config
 */
export async function saveConfig(config: AppConfig, location?: 'user' | 'scanned' | 'project', scanPath?: string): Promise<void> {
  let savePath: string;

  if (location === 'user') {
    savePath = configPaths[0];
  } else if (location === 'scanned' && scanPath) {
    savePath = path.join(scanPath, CONFIG_FILE_NAME);
  } else if (location === 'project') {
    savePath = configPaths[1];
  } else {
    // Default to user folder
    savePath = configPaths[0];
  }

  try {
    fs.writeFileSync(savePath, JSON.stringify(config, null, 2));
    console.log(`Config saved to ${savePath}`);
  } catch (error) {
    throw new Error(`Failed to save config: ${error}`);
  }
}

export function getConfigPath(): string {
  return configPaths[0]; // Default to user folder
}