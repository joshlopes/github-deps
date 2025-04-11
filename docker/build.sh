#!/bin/bash

# Move to the project root directory
cd "$(dirname "$0")/.."

# Copy .dockerignore to the root if it doesn't exist
if [ ! -f .dockerignore ]; then
  cp docker/.dockerignore .
fi

# Build the Docker image
docker build -t php-deps-visualizer -f docker/Dockerfile .

echo "Build completed successfully!"
echo "To run the container: docker run -p 8080:80 php-deps-visualizer"
