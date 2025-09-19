# Vorg

**Repository:** [https://github.com/andryluthfi/vorg](https://github.com/andryluthfi/vorg)

A console application to scan, organize, and rename movie and TV series files. It recognizes metadata from filenames, fills missing information using APIs or web scraping, renames files with standardized formats, and organizes them into personalized folders.

## Features

- **File Scanning**: Recursively scans specified folders for media files (mp4, mkv, avi, etc.)
- **Metadata Parsing**: Extracts title, year, season, episode, and type from filenames
- **API Integration**: Fetches additional metadata from OMDB API or falls back to web scraping
- **Database-First TV Metadata**: Checks local SQLite database before API calls for TV episodes
- **Whole Season Caching**: Fetches and caches entire TV seasons to reduce API calls
- **File Renaming**: Renames files to standardized formats:
  - Movies: `Movie Name (Year).ext`
  - TV Shows: `TV Show Name (Year) - Season X Episode Y - Episode Title.ext`
- **Organization**: Moves files to user-specified destination folders
- **Conflict Resolution**: Handles duplicate files with skip/overwrite options
- **Database Storage**: Stores metadata in SQLite database
- **TUI Interface**: Interactive prompts using Inquirer.js
- **Config Merging**: Merges configuration from multiple sources with priority order
- **Verbose Mode**: Shows detailed configuration information and final merged config

## Project Structure

The codebase is organized using a layered architecture for better maintainability:

```
src/
├── core-data/          # Data processing modules (scanning, parsing)
│   ├── scanner.ts
│   └── parser.ts
├── business-logic/     # Business logic (file organization)
│   └── organizer.ts
├── infrastructure/     # External dependencies (database, API)
│   ├── database.ts
│   └── api.ts
├── config/             # Configuration management
│   └── config.ts
└── index.ts            # Main CLI entry point

tests/                  # All test files
├── scanner.test.ts
├── parser.test.ts
├── api.test.ts
├── config.test.ts
├── database.test.ts
└── organizer.test.ts
```

### Architecture Layers
- **Core Data**: Handles file scanning and metadata parsing
- **Business Logic**: Implements file organization and renaming logic
- **Infrastructure**: Manages external services (database, API calls)
- **Config**: Handles application configuration
- **Main**: Orchestrates the application flow

## Coding Standards

- **Folder Naming**: Kebab-case for directories (e.g., `core-data`, `business-logic`)
- **File Naming**: camelCase for TypeScript files (e.g., `scanner.ts`, `organizer.ts`)
- **TypeScript Best Practices**: Strict mode enabled, explicit types, ESLint configuration
- **Code Quality**: Consistent formatting, JSDoc comments for public APIs
- **Testing**: Unit tests alongside functionality, using Bun test runner
- **Linting**: ESLint with TypeScript rules (`bun run lint`)

## Installation

### From Source
```bash
bun install
bun run build
bun run pkg  # Builds executables
```

### Using Executable
Download the appropriate executable for your platform from the `dist` folder:
- `vorg-win.exe` (Windows)
- `vorg-linux` (Linux)
- `vorg-macos` (macOS)

## Usage

### Running the Application
```bash
# From source
bun run dev

# Using executable
./vorg-win.exe
```

### Command Line Options
- `--scan-path, -s <path>`: Specify the folder path to scan for media files
- `--movie-path, -m <path>`: Specify destination folder for movies
- `--tv-path, -t <path>`: Specify destination folder for TV shows
- `--interactive, -i`: Enable interactive mode to prompt for missing inputs
- `--no-save-config`: Do not save configuration to disk
- `--verbose, -v`: Show detailed config information and final merged config
- `--help`: Show help information

**Examples:**
```bash
# Scan specific folder with verbose output
bun run dev --scan-path /path/to/media --verbose

# Set custom destination paths
bun run dev -m /movies -t /tv-shows

# Interactive mode
bun run dev --interactive
```

### Configuration
The app will prompt for configuration on first run:
- Scan folder path (defaults to current directory)
- Destination folders for Movies and TV Shows
- Where to save configuration (user folder, current directory, or project folder)

Configuration is stored in `vorg-config.json` in the chosen location.

#### Configuration Merging
The application supports configuration merging from multiple sources with the following priority order (highest to lowest):

1. **Scanned Folder** (`<scan-path>/vorg-config.json`)
2. **User Folder** (`C:\Users\<username>\vorg-config.json` on Windows, `~/.vorg-config.json` on Unix)
3. **Project Folder** (`<project-root>/vorg-config.json`)

When running the application, it will:
- Load configuration from all available sources
- Merge them with the priority order above (higher priority configs override lower priority ones)
- Use the merged configuration for the session

**Example:**
- User folder config: `{"omdbApiKey": "xxxxxxxxxxxxxxxxx"}`
- Scanned folder config: `{"moviePath": "I:\\Video\\Movie", "tvPath": "I:\\Video\\TV Show"}`
- Merged result: `{"moviePath": "I:\\Video\\Movie", "tvPath": "I:\\Video\\TV Show", "omdbApiKey": "xxxxxxxxxxxxxxxxxx"}`

#### Verbose Mode
Use the `--verbose` or `-v` flag to see detailed configuration information:

```bash
bun run dev --verbose
# or
./vorg-win.exe --verbose
```

This will display:
- A table showing config availability in each possible folder
- The final merged configuration used by the application

### OMDB API Key
To use OMDB API for better metadata:
1. Get a free API key from [OMDB API](http://www.omdbapi.com/apikey.aspx)
2. Add the API key to your configuration file (`vorg-config.json`):
   ```json
   {
     "scanPath": "/path/to/scan",
     "moviePath": "/path/to/movies",
     "tvPath": "/path/to/tv",
     "omdbApiKey": "your_api_key_here"
   }
   ```
3. Alternatively, set the environment variable: `OMDB_API_KEY=your_key_here`

Without an API key, the app falls back to web scraping.

#### TV Show Database Caching
The application implements an intelligent caching system for TV show metadata:

- **Database-First Lookup**: Before making API calls, the app checks the local SQLite database for existing episode information
- **Whole Season Caching**: When an episode is not found in the database, the entire season is fetched from the API and stored locally
- **Reduced API Usage**: Subsequent episodes from the same season are served from the local cache, reducing API calls and improving performance

This approach significantly reduces API usage and improves processing speed for TV shows with multiple episodes.

**Database Schema:**
- `tv_episodes` table stores episode metadata including title, season, episode number, plot, genre, actors, and IMDB rating
- Episodes are uniquely identified by TV show name, season number, and episode number

## File Formats Supported
- .mp4, .mkv, .avi, .mov, .wmv, .flv, .webm

## Dependencies
- Bun (Runtime, SQLite, Fetch)
- TypeScript
- Inquirer.js (TUI)
- Cheerio (Web scraping)
- Parse Torrent Name (Filename parsing)
- FS Extra (File operations)

## Development

**Important**: Always use `bun` instead of `npm` for package management commands in this project.

```bash
bun install
bun run build
bun run dev    # Run in development mode
bun run test   # Run tests
bun run lint   # Run ESLint
```

## License
MIT