# PHP Dependencies Visualizer

A web application that analyzes and visualizes PHP package dependencies across GitHub organizations. This tool helps developers understand the relationships between their PHP packages and identify dependency patterns.

![PHP Dependencies Visualizer](https://via.placeholder.com/800x400?text=PHP+Dependencies+Visualizer)

## Features

- **GitHub Integration**: Connect to GitHub repositories using a personal access token
- **Organization Analysis**: Analyze all repositories within a GitHub organization
- **Dependency Visualization**: Interactive graph visualization of package dependencies
- **Version Tracking**: Track version differences between packages
- **Monorepo Support**: Identify and visualize nested composer.json files in monorepos
- **Filtering**: Filter and search for specific packages in the dependency graph
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **State Management**: Zustand
- **Visualization**: ECharts
- **API Integration**: Octokit (GitHub API client)
- **Build Tools**: Vite, ESLint
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- GitHub Personal Access Token with repo scope

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/github-deps.git
   cd github-deps
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter your GitHub Personal Access Token
2. Select an organization from the dropdown
3. Choose the repositories you want to analyze
4. Click "Analyze Dependencies" to generate the visualization
5. Interact with the graph to explore dependencies:
   - Click on nodes to see details
   - Double-click to focus on a specific package
   - Use the search bar to find specific packages

## How It Works

The application works by:

1. Authenticating with GitHub using your personal access token
2. Fetching repositories from the selected organization
3. Analyzing composer.json files in each repository
4. Extracting dependency information and version constraints
5. Building a graph of package relationships
6. Visualizing the dependencies using an interactive graph

## Development

### Project Structure

```
github-deps/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── ConfigForm/  # Authentication and configuration UI
│   │   └── Graph/       # Visualization components
│   ├── store/           # Zustand store
│   │   ├── slices/      # Store slices for different features
│   │   └── utils/       # Utility functions
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── test/                # Test files
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── index.html           # HTML entry point
├── package.json         # Project dependencies
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

### Running Tests

```bash
npm test
# or
yarn test
```

### Building for Production

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [ECharts](https://echarts.apache.org/) for the visualization library
- [Octokit](https://github.com/octokit/octokit.js) for the GitHub API client
- [Zustand](https://github.com/pmndrs/zustand) for state management
- [Tailwind CSS](https://tailwindcss.com/) for styling
