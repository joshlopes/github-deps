# Hosting on GitHub Pages

This document explains how to deploy the PHP Dependencies Visualizer to GitHub Pages.

## Automatic Deployment

The repository is configured to automatically deploy to GitHub Pages when changes are pushed to the main branch. This is handled by the GitHub Actions workflow in `.github/workflows/deploy.yml`.

## How It Works

1. The GitHub Actions workflow builds the application with the correct base path for GitHub Pages
2. The built files are deployed to the `gh-pages` branch
3. GitHub Pages serves the content from this branch

## Client-Side Routing

Since this is a single-page application (SPA) with client-side routing, we've implemented a solution to handle routing on GitHub Pages:

1. A custom 404.html page that redirects to the main page with the requested path as a query parameter
2. A script in index.html that reads this query parameter and uses the History API to restore the correct URL

This approach is based on the [spa-github-pages](https://github.com/rafgraph/spa-github-pages) project.

## Testing Locally

To test the GitHub Pages build locally:

1. Run the test script:
   ```bash
   ./scripts/test-gh-pages.sh
   ```

2. Open your browser to http://localhost:5000

This script:
- Creates a temporary .env.production file with the GitHub Pages base path
- Builds the application
- Serves it locally using the `serve` package
- Cleans up the temporary file when done

## Manual Deployment

If you need to deploy manually:

1. Create a .env.production file:
   ```
   VITE_BASE_PATH=/github-deps/
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Deploy the contents of the `dist` directory to the `gh-pages` branch:
   ```bash
   npx gh-pages -d dist
   ```

## Troubleshooting

### Assets Not Loading

If assets like CSS or JavaScript files aren't loading, check that:

1. The base path is correctly set in vite.config.ts
2. The .env.production file has the correct VITE_BASE_PATH value
3. All asset references in the HTML use relative paths (starting with ./ instead of /)

### Routing Issues

If routes aren't working correctly:

1. Make sure the 404.html file is present in the build output
2. Check that the redirect script in index.html is working properly
3. Verify that `pathSegmentsToKeep` in 404.html is set to the correct value (usually 1 for project pages)
