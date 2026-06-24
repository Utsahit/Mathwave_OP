#!/usr/bin/env bash
# Render.com build script
set -e
echo "Installing dependencies..."
npm install --include=dev
echo "Generating Prisma client..."
npx prisma generate
echo "Building TypeScript..."
npm run build
echo "Build complete."
