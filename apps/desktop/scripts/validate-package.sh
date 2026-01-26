#!/bin/bash
set -e

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
  echo "Usage: $0 <path-to-app>"
  echo "  macOS: $0 /path/to/Openwork.app"
  echo "  Linux: $0 /path/to/openwork-linux-unpacked"
  exit 1
fi

echo "=== Package Validation ==="
echo "App path: $APP_PATH"
echo "Platform: $(uname -s)"
echo "Architecture: $(uname -m)"
echo ""

# Strip system Node from PATH to simulate clean environment
export PATH="/usr/bin:/bin:/usr/sbin:/sbin"
echo "Stripped PATH to: $PATH"
echo ""

# Determine paths based on platform
if [ "$(uname -s)" = "Darwin" ]; then
  RESOURCES_DIR="$APP_PATH/Contents/Resources"
else
  RESOURCES_DIR="$APP_PATH/resources"
fi

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  NODE_ARCH="arm64"
else
  NODE_ARCH="x64"
fi

NODE_DIR="$RESOURCES_DIR/nodejs/$NODE_ARCH"
NODE_BIN="$NODE_DIR/bin/node"
SKILLS_DIR="$RESOURCES_DIR/skills"

# === Check 1: Bundled Node exists ===
echo "=== Check 1: Bundled Node exists ==="
if [ ! -f "$NODE_BIN" ]; then
  echo "ERROR: Bundled Node not found"
  echo "  Expected: $NODE_BIN"
  echo "  Platform: $(uname -s)-$ARCH"
  echo "  Contents of nodejs dir:"
  ls -la "$RESOURCES_DIR/nodejs/" 2>/dev/null || echo "  (nodejs dir not found)"
  exit 1
fi
echo "OK: Found $NODE_BIN"
echo ""

# === Check 2: Bundled Node runs ===
echo "=== Check 2: Bundled Node runs ==="
export PATH="$NODE_DIR/bin:$PATH"
NODE_VERSION=$("$NODE_BIN" --version 2>&1) || {
  echo "ERROR: Bundled Node failed to run"
  echo "  Path: $NODE_BIN"
  echo "  Exit code: $?"
  echo "  Output: $NODE_VERSION"
  exit 1
}
echo "OK: Node $NODE_VERSION"
echo ""

# === Check 3: Node path structure correct ===
echo "=== Check 3: Node path structure correct ==="
for BINARY in "$NODE_DIR/bin/node" "$NODE_DIR/bin/npm" "$NODE_DIR/bin/npx"; do
  if [ ! -f "$BINARY" ]; then
    echo "ERROR: Expected binary missing"
    echo "  Expected: $BINARY"
    echo "  Contents of bin dir:"
    ls -la "$NODE_DIR/bin/" 2>/dev/null || echo "  (bin dir not found)"
    exit 1
  fi
done
echo "OK: All expected binaries present (node, npm, npx)"
echo ""

# === Check 4: MCP servers can spawn ===
echo "=== Check 4: MCP servers spawn ==="
if [ ! -d "$SKILLS_DIR" ]; then
  echo "ERROR: Skills directory not found"
  echo "  Expected: $SKILLS_DIR"
  exit 1
fi

for MCP_DIR in "$SKILLS_DIR"/*/; do
  MCP_NAME=$(basename "$MCP_DIR")
  MCP_ENTRY="$MCP_DIR/dist/index.mjs"

  if [ ! -f "$MCP_ENTRY" ]; then
    echo "ERROR: MCP entry point missing"
    echo "  MCP: $MCP_NAME"
    echo "  Expected: $MCP_ENTRY"
    echo "  Contents of $MCP_DIR:"
    ls -la "$MCP_DIR" 2>/dev/null || echo "  (dir not found)"
    exit 1
  fi

  echo "Spawning $MCP_NAME..."
  "$NODE_BIN" "$MCP_ENTRY" &
  PID=$!
  sleep 2

  if ! kill -0 $PID 2>/dev/null; then
    # Process exited - check if it was a crash (non-zero exit) or clean exit
    wait $PID 2>/dev/null
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
      echo "ERROR: MCP crashed on startup"
      echo "  MCP: $MCP_NAME"
      echo "  Entry: $MCP_ENTRY"
      echo "  Exit code: $EXIT_CODE"
      echo "  Node path: $NODE_BIN"
      echo "  PATH: $PATH"
      exit 1
    fi
    # Exit code 0 means it started successfully but exited (expected for stdio MCP without client)
    echo "OK: $MCP_NAME started and exited cleanly (no stdin client)"
  else
    kill $PID 2>/dev/null || true
    wait $PID 2>/dev/null || true
    echo "OK: $MCP_NAME started successfully"
  fi
done

echo ""
echo "=== All validations passed ==="
