# Docker Setup for PHP Dependencies Visualizer

This directory contains everything needed to build and run the PHP Dependencies Visualizer in a production-ready Docker container.

## Files

- `Dockerfile`: Multi-stage build file that creates an optimized production image
- `nginx.conf`: Custom Nginx configuration for serving the React application
- `docker-compose.yml`: Compose file for easy deployment
- `.dockerignore`: Excludes unnecessary files from the Docker build
- `build.sh`: Helper script to build the Docker image
- `run.sh`: Helper script to run the Docker container

## Quick Start

### Option 1: Using Docker directly

1. Build the Docker image:
   ```bash
   ./docker/build.sh
   ```

2. Run the container:
   ```bash
   ./docker/run.sh
   ```

3. Access the application at http://localhost:8080

### Option 2: Using Docker Compose

1. From the docker directory, run:
   ```bash
   docker-compose up -d
   ```

2. Access the application at http://localhost:8080

## Production Optimizations

The Docker setup includes several optimizations for production:

1. **Multi-stage build**: Reduces the final image size by only including what's necessary
2. **Nginx configuration**:
   - Gzip compression for faster content delivery
   - Proper cache headers for static assets
   - Security headers to protect against common vulnerabilities
   - Configuration to handle React's client-side routing
3. **Container security**: Running as non-root user in the Nginx container

## Customization

### Changing the port

To use a different port, modify the port mapping in either:
- `docker-compose.yml`: Change `"8080:80"` to `"YOUR_PORT:80"`
- When running with Docker directly: `docker run -p YOUR_PORT:80 php-deps-visualizer`

### Environment variables

If you need to add environment variables, you can:
1. Add them to the `docker-compose.yml` file under the `environment` section
2. Pass them when running with Docker directly: `docker run -p 8080:80 -e KEY=VALUE php-deps-visualizer`

## Troubleshooting

### Container not starting

Check the logs:
```bash
docker logs php-deps-visualizer
```

### Application not accessible

Verify the container is running:
```bash
docker ps
```

Check if the port is correctly mapped:
```bash
docker port php-deps-visualizer
```
