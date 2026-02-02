import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import type { CliResolverConfig, ResolvedCliPaths } from '../types.js';

/**
 * Get OpenCode package name and platform-specific binary name.
 *
 * On Windows: The binary is in a platform-specific package (opencode-windows-x64)
 * On macOS/Linux: The binary is in the main opencode-ai package
 */
function getOpenCodePlatformInfo(): { packageName: string; binaryName: string } {
  if (process.platform === 'win32') {
    // On Windows, use the platform-specific package
    return {
      packageName: 'opencode-windows-x64',
      binaryName: 'opencode.exe',
    };
  }
  return {
    packageName: 'opencode-ai',
    binaryName: 'opencode',
  };
}

/**
 * Get all possible nvm OpenCode CLI paths by scanning the nvm versions directory
 */
function getNvmOpenCodePaths(): string[] {
  const homeDir = process.env.HOME || '';
  const nvmVersionsDir = path.join(homeDir, '.nvm/versions/node');
  const paths: string[] = [];

  try {
    if (fs.existsSync(nvmVersionsDir)) {
      const versions = fs.readdirSync(nvmVersionsDir);
      for (const version of versions) {
        const opencodePath = path.join(nvmVersionsDir, version, 'bin', 'opencode');
        if (fs.existsSync(opencodePath)) {
          paths.push(opencodePath);
        }
      }
    }
  } catch {
    // Ignore errors scanning nvm directory
  }

  return paths;
}

/**
 * Check if opencode is available on the system PATH
 */
function isOpenCodeOnPath(): boolean {
  try {
    const command = process.platform === 'win32' ? 'where opencode' : 'which opencode';
    execSync(command, { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the OpenCode CLI path from multiple locations.
 *
 * Search order:
 * 1. Bundled in packaged app (resources/app.asar.unpacked/node_modules)
 * 2. Local node_modules/.bin
 * 3. NVM installations
 * 4. Global npm installations
 * 5. Homebrew (macOS)
 * 6. System PATH
 *
 * @param config - Configuration for CLI path resolution
 * @returns Resolved CLI paths or null if not found
 */
export function resolveCliPath(config: CliResolverConfig): ResolvedCliPaths | null {
  const { isPackaged, resourcesPath, appPath } = config;

  if (isPackaged && resourcesPath) {
    // In packaged app, OpenCode is in unpacked asar
    const { packageName, binaryName } = getOpenCodePlatformInfo();

    const cliPath = path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      packageName,
      'bin',
      binaryName
    );

    if (fs.existsSync(cliPath)) {
      return {
        cliPath,
        cliDir: path.dirname(cliPath),
        source: 'bundled',
      };
    }

    // Bundled CLI not found in packaged app
    return null;
  }

  // Development mode - search multiple locations
  const preferGlobal = process.env.ACCOMPLISH_USE_GLOBAL_OPENCODE === '1';

  // Try bundled CLI in node_modules first (unless preferGlobal)
  if (appPath && !preferGlobal) {
    const binName = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
    const devCliPath = path.join(appPath, 'node_modules', '.bin', binName);
    if (fs.existsSync(devCliPath)) {
      console.log('[CLI Resolver] Using bundled CLI:', devCliPath);
      return {
        cliPath: devCliPath,
        cliDir: path.dirname(devCliPath),
        source: 'local',
      };
    }
  }

  // Check nvm installations (dynamically scan all versions)
  const nvmPaths = getNvmOpenCodePaths();
  for (const opencodePath of nvmPaths) {
    console.log('[CLI Resolver] Using nvm OpenCode CLI:', opencodePath);
    return {
      cliPath: opencodePath,
      cliDir: path.dirname(opencodePath),
      source: 'global',
    };
  }

  // Check other global installations (platform-specific)
  const globalOpenCodePaths = process.platform === 'win32'
    ? [
        // Windows: npm global installs
        path.join(process.env.APPDATA || '', 'npm', 'opencode.cmd'),
        path.join(process.env.LOCALAPPDATA || '', 'npm', 'opencode.cmd'),
      ]
    : [
        // macOS/Linux: Global npm
        '/usr/local/bin/opencode',
        // Homebrew
        '/opt/homebrew/bin/opencode',
      ];

  for (const opencodePath of globalOpenCodePaths) {
    if (fs.existsSync(opencodePath)) {
      console.log('[CLI Resolver] Using global OpenCode CLI:', opencodePath);
      return {
        cliPath: opencodePath,
        cliDir: path.dirname(opencodePath),
        source: 'global',
      };
    }
  }

  // Try bundled CLI in node_modules as a fallback (when preferGlobal is true)
  if (appPath) {
    const binName = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
    const devCliPath = path.join(appPath, 'node_modules', '.bin', binName);
    if (fs.existsSync(devCliPath)) {
      console.log('[CLI Resolver] Using bundled CLI:', devCliPath);
      return {
        cliPath: devCliPath,
        cliDir: path.dirname(devCliPath),
        source: 'local',
      };
    }
  }

  // Final fallback: check if opencode is available on PATH
  if (isOpenCodeOnPath()) {
    console.log('[CLI Resolver] Using opencode command on PATH');
    return {
      cliPath: 'opencode',
      cliDir: '',
      source: 'global',
    };
  }

  // No CLI found
  return null;
}

/**
 * Check if OpenCode CLI is available.
 *
 * @param config - Configuration for CLI path resolution
 * @returns true if CLI is available
 */
export function isCliAvailable(config: CliResolverConfig): boolean {
  return resolveCliPath(config) !== null;
}

/**
 * Get the version of the OpenCode CLI.
 *
 * @param cliPath - Path to the CLI executable
 * @returns Version string or null if unable to determine
 */
export async function getCliVersion(cliPath: string): Promise<string | null> {
  try {
    // If cliPath is a directory path ending in bin, try to read package.json
    if (cliPath.includes('node_modules')) {
      const { packageName } = getOpenCodePlatformInfo();
      const packageJsonPath = path.join(
        path.dirname(path.dirname(cliPath)),
        packageName,
        'package.json'
      );

      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return pkg.version;
      }
    }

    // Run the CLI to get version
    const fullCommand = `"${cliPath}" --version`;

    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    // Parse version from output (e.g., "opencode 1.0.0" or just "1.0.0")
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : output;
  } catch {
    return null;
  }
}
