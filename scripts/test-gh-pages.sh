#!/bin/bash

# Create a .env.production file with the base path
echo "VITE_BASE_PATH=/github-deps/" > .env.production

# Build with the base path
npm run build

# Serve the build locally
npx serve -s dist -l 5000

# Clean up
rm .env.production
