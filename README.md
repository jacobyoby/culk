# AI Photo Culling

Local-first PWA for culling RAW/JPEG files with AI-powered features.

## Features

✅ **Completed Features:**
- **Local File Import** - File System Access API for secure folder import
- **PWA Support** - Installable app with offline capabilities
- **Advanced Image Viewer** - Zoom, pan, rotate with smooth animations
- **Smart Culling Interface** - Filmstrip, loupe, compare, and survey views
- **Rating & Flagging** - 5-star rating system with pick/reject flags
- **Auto-Grouping** - Perceptual hash + SSIM similarity detection
- **Focus Detection** - Laplacian variance for blur/sharpness analysis
- **XMP Export** - Lightroom/Capture One compatible sidecar files
- **Multiple Export Formats** - JSON, CSV, and XMP exports
- **Docker Support** - Development and production containers

🚧 **In Development:**
- **RAW Preview** - LibRaw WASM integration for fast RAW thumbnails
- **Face Detection** - ONNX Runtime with eye state analysis
- **Advanced Tests** - Comprehensive test suite

## Quick Start

### Using Docker (Recommended)
```bash
# Clone and navigate to project
cd ai-photo-culling

# Copy environment file
cp env.example .env

# Start development server
docker compose up --build

# Open http://localhost:3000
```

### Using Node.js (Alternative)
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

## Usage

1. **Import Photos**
   - Click "Import Photos" on the home page
   - Select a folder containing RAW/JPEG files
   - Wait for processing and thumbnail generation

2. **Cull Images**
   - Use keyboard shortcuts for efficient culling:
     - `←/→` - Navigate between images
     - `1-5` - Rate images
     - `P` - Mark as pick
     - `X` - Mark as reject
     - `F` - Toggle face detection boxes
     - `I` - Toggle metadata display

3. **Auto-Group Similar Images**
   - Visit the Review page
   - Click "Auto-Group Similar Images"
   - Review and adjust grouped images

4. **Export Results**
   - Choose export format (XMP, JSON, CSV)
   - Filter by rating or flag status
   - Download your culling results

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Storage**: Dexie (IndexedDB) for local data persistence
- **Image Processing**: Canvas API, Web Workers
- **Similarity Detection**: Perceptual hashing, SSIM algorithm
- **PWA**: Service workers, offline support
- **Deployment**: Docker with multi-stage builds

## Architecture

```
├── app/                 # Next.js app router pages
├── components/          # Reusable UI components
├── lib/
│   ├── fs/             # File System Access API
│   ├── store/          # Database and state management
│   ├── similarity/     # Image similarity algorithms
│   ├── quality/        # Focus and blur detection
│   ├── grouping/       # Auto-grouping logic
│   ├── xmp/            # XMP sidecar generation
│   ├── export/         # Export functionality
│   └── utils/          # Utility functions
├── workers/            # Web Workers for heavy processing
├── public/             # Static assets and PWA manifest
└── tests/              # Test files
```

## Docker Workflow

### Development
```bash
# Start development environment
docker compose up --build

# App available at http://localhost:3000
```

### Production
```bash
# Build production image
docker build -t ai-cull:prod .

# Run production container
docker run -p 3000:3000 --env-file .env ai-cull:prod
```

### Testing
```bash
# Run tests in Docker
docker compose -f docker-compose.test.yml up --build
```

## Browser Compatibility

**Required for full functionality:**
- File System Access API (Chrome, Edge, Safari 15.2+)
- Service Workers (all modern browsers)
- IndexedDB (all modern browsers)
- Canvas API (all modern browsers)

**Recommended:**
- Chrome 86+ or Edge 86+ for optimal File System Access API support
- 4GB+ RAM for processing large image sets
- SSD storage for better performance

## Security & Privacy

- **100% Local Processing** - No images or data sent to any server
- **Secure Context** - Requires HTTPS in production (localhost is secure for development)
- **File System Access** - Controlled folder access with user permissions
- **No Telemetry** - No usage tracking or analytics

## Performance Considerations

- **Thumbnail Generation** - Automatic downscaling for fast preview
- **Lazy Loading** - Images loaded on demand
- **Web Workers** - Heavy processing in background threads
- **IndexedDB** - Efficient local storage with indexing
- **Memory Management** - Automatic cleanup of large objects

## Development

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Modern browser with File System Access API support

### Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- LibRaw team for RAW processing algorithms
- ONNX team for ML inference capabilities
- Dexie.js for IndexedDB wrapper
- Tailwind CSS for utility-first styling
- Framer Motion for smooth animations