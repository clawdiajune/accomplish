/**
 * MCP Server Health Checker
 *
 * Verifies bundled MCP servers can start and stay alive.
 * Used during app initialization to detect corruption or missing dependencies.
 *
 * @module services/app-init/checkers/mcp-checker
 */

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import type { ComponentHealth, InitError } from '@accomplish/shared';
import { getNodePath, buildNodeEnv } from '../../../utils/bundled-node';

export interface MCPCheckResult {
  status: 'healthy' | 'failed';
  error: InitError | null;
}

const MCP_STARTUP_TIMEOUT = 2000; // 2 seconds to verify server starts

/**
 * Check if an MCP server can start and stay alive.
 *
 * @param mcpName - Internal name of the MCP server (e.g., 'dev-browser-mcp')
 * @param entryPath - Absolute path to the MCP server entry point
 * @returns Health check result with detailed error information if failed
 */
export async function checkMCPServer(
  mcpName: string,
  entryPath: string
): Promise<MCPCheckResult> {
  // Check entry point exists
  if (!fs.existsSync(entryPath)) {
    return {
      status: 'failed',
      error: {
        code: 'MCP_ENTRY_NOT_FOUND',
        component: `mcp:${mcpName}`,
        message: `MCP server entry point not found: ${mcpName}`,
        guidance: 'The app installation may be incomplete. Try reinstalling the app.',
        debugInfo: {
          platform: `${process.platform}-${process.arch}`,
          expectedPath: entryPath,
          actualPath: null,
        },
      },
    };
  }

  const nodePath = getNodePath();
  const env = buildNodeEnv(process.env);

  return new Promise((resolve) => {
    let stderr = '';
    let resolved = false;
    let proc: ChildProcess | null = null;

    const cleanup = () => {
      if (proc && !proc.killed) {
        try {
          proc.kill('SIGTERM');
        } catch {
          // Ignore kill errors
        }
      }
    };

    const fail = (exitCode: number | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({
        status: 'failed',
        error: {
          code: 'MCP_SPAWN_FAILED',
          component: `mcp:${mcpName}`,
          message: `Failed to start MCP server: ${mcpName}`,
          guidance: 'Bundled Node.js may be corrupted or missing dependencies. Try reinstalling the app.',
          debugInfo: {
            platform: `${process.platform}-${process.arch}`,
            expectedPath: entryPath,
            actualPath: nodePath,
            stderr: stderr.slice(0, 1000), // Limit stderr length
            exitCode,
            env: {
              PATH: env.PATH || '',
              NODE_BIN_PATH: env.NODE_BIN_PATH || '',
            },
          },
        },
      });
    };

    try {
      proc = spawn(nodePath, [entryPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        stderr += err.message;
        fail(null);
      });

      proc.on('exit', (code) => {
        fail(code);
      });

      // If still running after timeout, consider it healthy
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ status: 'healthy', error: null });
      }, MCP_STARTUP_TIMEOUT);
    } catch (err) {
      stderr += (err as Error).message;
      fail(null);
    }
  });
}

/**
 * Convert MCP check result to ComponentHealth format.
 *
 * @param mcpName - Internal name of the MCP server
 * @param displayName - Human-readable name for UI display
 * @param result - Result from checkMCPServer
 * @returns ComponentHealth object for system health tracking
 */
export function toComponentHealth(
  mcpName: string,
  displayName: string,
  result: MCPCheckResult
): ComponentHealth {
  return {
    name: `mcp:${mcpName}`,
    displayName,
    status: result.status,
    lastCheck: Date.now(),
    error: result.error,
    retryCount: 0,
  };
}
