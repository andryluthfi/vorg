import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AppConfig {
  scanPath?: string;
  moviePath?: string;
  tvPath?: string;
  omdbApiKey?: string;
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
  const primarySource = sources.find(s => s.exists) || sources[0];
  const source = primarySource ? primarySource.location : 'None';
  const configPath = primarySource ? primarySource.path : null;

  return {
    config: mergedConfig,
    source,
    path: configPath,
    sources
  };
}

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