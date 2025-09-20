# Vorg

**Repository:** [https://github.com/andryluthfi/vorg](https://github.com/andryluthfi/vorg)

[![Test Status](https://github.com/andryluthfi/vorg/actions/workflows/test.yml/badge.svg)](https://github.com/andryluthfi/vorg/actions/workflows/test.yml)
[![Test Coverage](https://img.shields.io/badge/tests-72%20✅-brightgreen)](TEST_RESULTS.md)
[![Bun](https://img.shields.io/badge/runtime-bun-orange)](https://bun.sh)

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
- **Dual API Support**: OMDB API with TMDB fallback for enhanced metadata retrieval
- **File Verification**: Verify and fix misplaced media files with `--verify-target` flag
- **Enhanced Logging**: Comprehensive API enrichment logging and parsing debug information

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
├── action/             # CLI action handlers
│   ├── apply.ts
│   ├── revert.ts
│   ├── verify.ts
│   └── db.ts
└── index.ts            # Main CLI entry point

tests/                  # Comprehensive test suite (72 tests)
├── api.test.ts         # API integration tests (8 tests)
├── config.test.ts      # Configuration tests (8 tests)
├── organizer.test.ts   # Business logic tests (11 tests)
├── parser.test.ts      # Data parsing tests (22 tests)
├── revert.test.ts      # File reversion tests (10 tests)
└── scanner.test.ts     # File scanning tests (13 tests)

.github/
└── workflows/
    └── test.yml        # GitHub Actions CI/CD pipeline

TEST_RESULTS.md         # Detailed test documentation
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
- `--verify-target`: Verify and fix misplaced TV shows in movie folders and vice versa
- `--help`: Show help information

**Examples:**
```bash
# Scan specific folder with verbose output
bun run dev --scan-path /path/to/media --verbose

# Set custom destination paths
bun run dev -m /movies -t /tv-shows

# Interactive mode
bun run dev --interactive

# Verify and fix misplaced files
bun run dev --verify-target

# Verify with custom paths
bun run dev /path/to/check --movie-path /my/movies --tv-path /my/shows --verify-target
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

### File Verification and Organization
The application includes a powerful verification system to ensure your media files are properly organized:

#### Verify Command
Use the `--verify-target` flag to scan existing organized folders and identify misplaced files:

```bash
# Verify files in current directory
bun run dev --verify-target

# Verify specific path
bun run dev /path/to/organized/files --verify-target

# Combine with custom paths
bun run dev --movie-path /my/movies --tv-path /my/tv --verify-target
```

**What it does:**
- 🔍 **Scans organized folders** for misplaced media files
- 🎯 **Identifies movies in TV folders** and vice versa
- 📋 **Shows detailed report** of files that need to be moved
- 🔄 **Automatically moves files** to correct locations
- 🗂️ **Removes empty folders** left behind
- ✅ **Preserves file integrity** with conflict resolution

**Example output:**
```
🔍 Media Target Verification

📁 Scanning: /path/to/media
🎥 Movies: /movies
📺 TV Shows: /tv

Found 150 media file(s).

📋 Verification Results:

🚨 Found 3 misplaced file(s):

📄 Movie.In.Wrong.Place.2020.avi
   Current: /tv/Movie.In.Wrong.Place.2020.avi
   Should be: /movies/Movie In Wrong Place (2020)/Movie In Wrong Place (2020).avi
   Reason: Movie file found in TV shows directory

🗂️ Found 2 empty folder(s) that will be removed:
   /old/empty/folder1
   /old/empty/folder2

Do you want to proceed with these changes? (y/N)
```

#### Enhanced Logging and Debugging
The application provides comprehensive logging for troubleshooting and monitoring:

- **API Enrichment Logs**: Detailed logs of all API calls and responses (`api_enrichment.log`)
- **Parsing Debug Info**: Database-stored parsing steps for filename analysis
- **Verbose Configuration**: Detailed config source information with `--verbose` flag
- **Progress Tracking**: Real-time progress bars for metadata enrichment
- **Error Recovery**: Graceful handling of API failures with fallback mechanisms

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

#### TMDB API Integration
The application includes TMDB (The Movie Database) API as a fallback when OMDB API fails or is unavailable:

- **Automatic Fallback**: When OMDB API requests fail, the system automatically tries TMDB API
- **Seamless Integration**: TMDB data is converted to OMDB-compatible format for consistent processing
- **Enhanced Reliability**: Dual API support ensures better metadata retrieval success rates
- **Free API Access**: TMDB provides generous free tier access (4 requests per second, 50,000 requests per day)

To use TMDB API for enhanced reliability:
1. Get a free API key from [TMDB API](https://www.themoviedb.org/settings/api)
2. Add the API key to your configuration file (`vorg-config.json`):
   ```json
   {
     "omdbApiKey": "your_omdb_key_here",
     "tmdbApiKey": "your_tmdb_key_here"
   }
   ```
3. Alternatively, set the environment variable: `TMDB_API_KEY=your_key_here`

**Fallback Flow:**
1. Primary: OMDB API (most accurate for movies and TV shows)
2. Fallback: TMDB API (when OMDB fails)
3. Final Fallback: Web scraping (when both APIs fail)

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
- OMDB API (Primary metadata source)
- TMDB API (Fallback metadata source)

## Testing

This project includes a comprehensive test suite with 72 automated tests covering all major functionality.

### Test Coverage

| Component | Tests | Status |
|-----------|-------|--------|
| **API Integration** | 8 tests | ✅ Complete |
| **Configuration Management** | 8 tests | ✅ Complete |
| **Business Logic** | 11 tests | ✅ Complete |
| **Data Parsing** | 22 tests | ✅ Complete |
| **File Reversion** | 10 tests | ✅ Complete |
| **File Scanning** | 13 tests | ✅ Complete |
| **TOTAL** | **72 tests** | **✅ 100% Coverage** |

**Test Results**: [📊 View Detailed Test Results](TEST_RESULTS.md)

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/parser.test.ts

# Run tests with verbose output
bun test --verbose

# Run tests in watch mode
bun test --watch
```

### Test Structure

The test suite covers:
- ✅ **Unit Tests**: Individual function testing
- ✅ **Integration Tests**: Component interaction testing
- ✅ **Error Handling**: Failure scenario validation
- ✅ **Edge Cases**: Boundary condition testing
- ✅ **File System Operations**: Real file operation testing
- ✅ **API Integration**: OMDB API testing with mocks
- ✅ **Database Operations**: SQLite interaction testing

### CI/CD Testing

The project uses GitHub Actions for automated testing:

- **Triggers**: Every push and pull request to `main` and `develop` branches
- **Matrix Testing**: Tests across Node.js 18.x and 20.x
- **Test Results**: Uploaded as artifacts for review
- **Build Validation**: Ensures code builds successfully

### Test Documentation

Detailed test results and coverage information is available in:
- [`TEST_RESULTS.md`](TEST_RESULTS.md) - Comprehensive test documentation
- GitHub Actions artifacts - Test execution reports

### Writing Tests

When adding new features, follow these testing guidelines:

1. **Create corresponding test files** in the `tests/` directory
2. **Use descriptive test names** that explain the expected behavior
3. **Test both success and failure scenarios**
4. **Include edge cases** and boundary conditions
5. **Mock external dependencies** (API calls, file system when appropriate)
6. **Use realistic test data** that matches actual usage patterns

**Example test structure:**
```typescript
describe("newFeature", () => {
  test("should handle normal case", () => {
    // Test implementation
  });

  test("should handle edge case", () => {
    // Test edge conditions
  });

  test("should handle error case", () => {
    // Test error scenarios
  });
});
```

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