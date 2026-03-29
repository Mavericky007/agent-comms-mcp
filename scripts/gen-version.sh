#!/bin/bash
# Generate version.json from package.json + git state
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

VERSION=$(node -p "require('./package.json').version")
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > dist/version.json <<EOF
{
  "version": "$VERSION",
  "gitHash": "$GIT_HASH",
  "buildTime": "$BUILD_TIME"
}
EOF

echo "Generated version.json: v$VERSION ($GIT_HASH) at $BUILD_TIME"
