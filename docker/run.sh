#!/bin/bash

# Run the Docker container
docker run -d -p 8080:80 --name php-deps-visualizer php-deps-visualizer

echo "Container started successfully!"
echo "The application is now available at http://localhost:8080"
