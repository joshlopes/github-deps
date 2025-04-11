#!/bin/bash

# Create a .env.production file with the base path
echo "VITE_BASE_PATH=/" > .env.production

# Build with the base path, ignoring TypeScript errors
npm run build:skip-ts

# Copy the index.html to 200.html for serve's SPA support
cp dist/index.html dist/200.html

# Serve the build locally
npx serve -s dist -l 5000

# Clean up
rm .env.production
