#!/bin/bash

# Install gh-pages if not already installed
npm list gh-pages --depth=0 || npm install --save-dev gh-pages

# Create a .env.production file with the base path for GitHub Pages
echo "VITE_BASE_PATH=/github-deps/" > .env.production

# Build with the base path, ignoring TypeScript errors
npm run build:skip-ts

# Create a CNAME file if you have a custom domain
# echo "your-custom-domain.com" > dist/CNAME

# Create a .nojekyll file to disable Jekyll processing
touch dist/.nojekyll

# Copy the 404.html file to handle client-side routing
cp public/404.html dist/

# Deploy to GitHub Pages
npx gh-pages -d dist

# Clean up
rm .env.production

echo "Deployed to GitHub Pages!"
echo "Your site should be available at: https://yourusername.github.io/github-deps/"
