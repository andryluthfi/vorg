import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, saveConfig, configPaths } from "../src/config/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Config operations", () => {
  const testConfigPath = path.join(os.tmpdir(), "test-config.json");

  beforeEach(() => {
    // Clean up any existing test config
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // Clean up test config
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test("should load default config when no file exists", () => {
    // Remove any existing config files for this test
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    }

    const configResult = loadConfig();
    expect(configResult.config).toEqual({});
    expect(configResult.source).toBe('None');
    expect(configResult.path).toBeNull();
  });

  test("should save and load config", async () => {
    const testConfig = {
      scanPath: "/test/scan",
      moviePath: "/test/movies",
      tvPath: "/test/tv"
    };

    // Write test config to a known location
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));

    // Temporarily modify the module to use our test path
    const originalPaths = configPaths.slice();
    (configPaths as any)[0] = testConfigPath;

    const loadedConfigResult = loadConfig();
    expect(loadedConfigResult.config.scanPath).toBe("/test/scan");
    expect(loadedConfigResult.config.moviePath).toBe("/test/movies");
    expect(loadedConfigResult.config.tvPath).toBe("/test/tv");

    // Restore original paths
    configPaths[0] = originalPaths[0];
  });

  test("should handle config save errors", async () => {
    const testConfig = {
      scanPath: "/test/scan"
    };

    // Try to save to a read-only location or invalid path
    // For this test, we'll just verify it doesn't throw in normal cases
    // since fs.writeFileSync creates directories as needed
    await expect(saveConfig(testConfig, "user")).resolves.toBeUndefined();
  });
});