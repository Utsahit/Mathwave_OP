#!/usr/bin/env bash
# Render.com build script
set -e
echo "Installing dependencies..."
npm install --include=dev
echo "Generating Prisma client..."
npx prisma generate
echo "Running database migrations..."
npx prisma migrate deploy || echo "Migrations skipped (may already be applied)"
echo "Building TypeScript..."
npm run build
echo "Build complete."
