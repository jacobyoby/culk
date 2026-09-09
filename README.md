# AI Photo Culling

Local-first PWA for culling RAW/JPEG files with AI-powered features.

## Features

✅ **Core Features:**
- **Local File Import** - File System Access API for secure folder import
- **PWA Support** - Installable app with offline capabilities  
- **Advanced Image Viewer** - Zoom, pan, rotate with smooth animations and scroll control
- **Smart Culling Interface** - Filmstrip, loupe, compare, and survey views
- **Rating & Flagging** - 5-star rating system with thumbs up/down for pick/reject
- **XMP Export** - Lightroom/Capture One compatible sidecar files
- **Multiple Export Formats** - JSON, CSV, and XMP exports
- **Docker Support** - Development and production containers with health checks
- **Comprehensive Testing** - Unit, integration, and acceptance test suites

✅ **AI & Image Processing:**
- **Auto-Enhancement** - Intelligent histogram analysis with one-click optimization (E key)
- **Professional Presets** - Portrait, landscape, lowLight, highKey, and dramatic styles
- **Image Adjustments** - Real-time brightness, contrast, saturation, highlights, shadows, and vibrance
- **Auto-Grouping** - Perceptual hash + SSIM similarity detection
- **Smart Crop Suggestions** - Edge detection, golden ratio, and face-aware cropping
- **Face Detection** - BlazeFace ONNX models with eye state analysis and focus scoring
- **Focus Detection** - Laplacian variance for blur/sharpness analysis

✅ **Professional Architecture:**
- **React Context Architecture** - Eliminates anti-patterns with proper state management
- **LRU Caching** - Memory-efficient per-image adjustment persistence  
- **Error Boundaries** - Comprehensive error handling for image processing operations
- **Resource Management** - Automatic blob URL cleanup and memory leak prevention
- **Accessibility** - 44px touch targets, ARIA labels, and keyboard navigation
- **Performance Optimized** - Background processing and efficient rendering

## 🎨 Auto-Enhancement Features

The application includes a sophisticated auto-enhancement system that analyzes image histograms and metadata to provide intelligent, professional-quality adjustments:

### Intelligent Analysis
- **Histogram Analysis** - Calculates luminance distribution, shadow/highlight clipping
- **Exposure Detection** - Identifies underexposed, overexposed, and well-balanced images  
- **Dynamic Range Assessment** - Measures tonal range and midtone balance
- **Metadata Integration** - Considers ISO, aperture, and other EXIF data

### Professional Presets
- **Portrait** - Optimized for skin tones and facial features
- **Landscape** - Enhanced contrast and vibrance for scenic images
- **Low Light** - Shadow lifting and noise-conscious enhancement
- **High Key** - Bright, airy look with highlight recovery
- **Dramatic** - High contrast with rich shadows and highlights

### Smart Adjustments
- **Conservative/Normal Modes** - User-selectable enhancement intensity
- **Confidence Scoring** - Algorithm reports certainty in enhancement recommendations
- **Memory Efficient** - LRU caching prevents memory leaks during long sessions
- **Real-time Preview** - Instant visual feedback with hardware-accelerated rendering

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
     - `1-5` - Rate images (star rating)
     - `P` - Mark as pick (thumbs up)
     - `X` - Mark as reject (thumbs down) 
     - `F` - Toggle face detection boxes
     - `I` - Toggle metadata display
     - `C` - Open crop tool
     - `A` - Open adjustment panel
     - `E` - Auto-enhance image with intelligent analysis

3. **Auto-Group Similar Images**
   - Visit the Review page
   - Click "Auto-Group Similar Images"
   - Review and adjust grouped images

4. **Auto-Enhance Images** 
   - Press `E` for instant intelligent enhancement
   - Choose from professional presets (portrait, landscape, etc.)
   - Fine-tune with manual adjustment sliders
   - Adjustments are cached per-image for memory efficiency

5. **Export Results**
   - Choose export format (XMP, JSON, CSV)
   - Filter by rating or flag status
   - Download your culling results

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion
- **Storage**: Dexie (IndexedDB) for local data persistence
- **AI/ML**: ONNX Runtime Web, BlazeFace models for face detection
- **Image Processing**: Canvas API, Web Workers, LibRaw WASM (planned)
- **Similarity Detection**: Perceptual hashing (pHash), SSIM algorithm  
- **Real-time Filters**: CSS filters with hardware acceleration
- **PWA**: Service workers, offline support, installable
- **Testing**: Vitest, Testing Library, Playwright
- **Deployment**: Docker with multi-stage builds, health checks

## Architecture

```
├── app/                 # Next.js app router pages
├── components/          # Reusable UI components
│   ├── adjustment-panel.tsx  # Real-time image adjustments with auto-enhance
│   ├── crop-tool.tsx         # Smart cropping interface
│   ├── image-viewer.tsx      # Advanced image viewer with controls
│   ├── rating-controls.tsx   # Star ratings and thumbs up/down
│   ├── error-boundary.tsx    # Error handling components
│   └── face-*.tsx           # Face detection components
├── lib/
│   ├── fs/             # File System Access API
│   ├── store/          # Database and state management  
│   ├── ml/             # Machine learning (BlazeFace, eye detection)
│   ├── similarity/     # Image similarity algorithms (pHash, SSIM)
│   ├── quality/        # Focus and blur detection
│   ├── grouping/       # Auto-grouping logic
│   ├── utils/          # Image adjustments, cropping, EXIF, auto-enhancement
│   ├── contexts/       # React Context providers for state management
│   ├── xmp/            # XMP sidecar generation
│   └── export/         # Export functionality
├── workers/            # Web Workers for heavy processing
├── public/
│   ├── models/         # ONNX models for face detection
│   └── manifest.webmanifest  # PWA configuration
└── tests/              # Comprehensive test suite
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

See [SECURITY.md](SECURITY.md) for the local-only privacy stub.

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

## Support

[Donate / Support Jacobrakai Foundation — JACOBRAKAI FOUNDATION 501(c)(3)](https://donate.stripe.com/eVq4gy97DanS9h60phfrW00)

JACOBRAKAI FOUNDATION (Jacobrakai Foundation) is an IRC 501(c)(3) public charity under 170(b)(1)(A)(vi), EIN 33-3382083, effective February 11, 2025. Contributions are deductible to the extent allowed by law. IRS Letter 947 dated September 3, 2026.

## Acknowledgments

- LibRaw team for RAW processing algorithms
- ONNX team for ML inference capabilities
- Dexie.js for IndexedDB wrapper
- Tailwind CSS for utility-first styling
- Framer Motion for smooth animations