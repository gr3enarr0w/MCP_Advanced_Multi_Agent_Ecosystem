#!/bin/bash

echo "🚀 Building Skills Manager MCP Server..."

# Navigate to skills manager directory
cd mcp-servers/skills-manager

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

echo "✅ Build complete!"
echo "📍 Build output location: $(pwd)/dist/"

# Verify dist files exist
if [ -f "dist/index.js" ]; then
    echo "✅ dist/index.js found"
    ls -la dist/
else
    echo "❌ dist/index.js not found!"
    exit 1
fi

echo "🎯 Skills Manager build completed successfully!"