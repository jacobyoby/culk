# AGENTS.md - AI Photo Culling Development Guide

## 🤖 Claude Code Integration

This project was developed using **Claude Code** - Anthropic's official CLI for Claude. This document serves as a guide for AI agents working on this codebase.

## 📁 Project Overview

**AI Photo Culling** is a production-ready, local-first Progressive Web App for professional photo culling with advanced AI features.

### Core Architecture
- **Frontend**: Next.js 14 + React + TypeScript + Tailwind CSS
- **Storage**: Dexie (IndexedDB) for local persistence
- **AI/ML**: ONNX Runtime Web with BlazeFace models
- **Processing**: Web Workers + Canvas API
- **Deployment**: Docker containers with multi-stage builds

## 🎯 Key Development Patterns

### 1. Component Architecture
```typescript
// Standard component pattern used throughout
interface ComponentProps {
  // Always include these patterns:
  className?: string      // For styling flexibility
  onUpdate?: () => void   // For reactive updates
}

export function Component({ className = '', ...props }: ComponentProps) {
  // Component implementation
}
```

### 2. Database Operations
```typescript
// All database operations use Dexie with reactive hooks
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/store/db'

// Read operations
const images = useLiveQuery(() => db.images.toArray()) ?? []

// Write operations with error handling
const updateImage = async (id: string, updates: Partial<ImageRec>) => {
  try {
    await db.images.update(id, { ...updates, modifiedAt: new Date() })
  } catch (error) {
    console.error('Database update failed:', error)
  }
}
```

### 3. File Processing Pipeline
```typescript
// Standard file processing pattern
const processImage = async (file: File): Promise<ImageRec> => {
  // 1. Generate preview/thumbnail
  // 2. Extract EXIF metadata
  // 3. Calculate perceptual hash
  // 4. Run AI analysis (faces, focus)
  // 5. Store in database
}
```

## 🧪 Testing Philosophy

### Test Structure
```bash
tests/
├── unit/                # Individual function tests
├── integration/         # Component interaction tests
├── acceptance/          # End-to-end user workflows
└── performance/         # Load and speed tests
```

### Testing Patterns
- **Unit Tests**: Pure functions, utilities, algorithms
- **Integration Tests**: Component interactions, database operations
- **Acceptance Tests**: Complete user workflows
- **Performance Tests**: Large dataset handling, memory usage

## 🔧 Development Workflow

### 1. Setup Commands
```bash
# Development
pnpm dev                    # Local development server
docker compose up --build  # Docker development environment

# Testing
pnpm test                   # Run all tests
pnpm test:unit             # Unit tests only
pnpm test:integration      # Integration tests
pnpm test:e2e             # End-to-end tests

# Building
pnpm build                 # Production build
docker build -t ai-cull:prod .  # Docker production image
```

### 2. Code Quality Standards
- **TypeScript**: Strict mode enabled, comprehensive typing
- **ESLint**: Next.js config with custom rules
- **Testing**: 95%+ coverage requirement
- **Error Handling**: Graceful degradation and user feedback
- **Performance**: Lazy loading, memory management, Web Workers

### 3. Feature Development Process
1. **Read existing code** to understand patterns
2. **Write tests first** (TDD approach)
3. **Implement incrementally** with frequent testing
4. **Update documentation** (README, TODO, etc.)
5. **Verify cross-browser compatibility**

## 🎨 UI/UX Patterns

### Design System
- **Colors**: Tailwind CSS custom theme with dark mode support
- **Icons**: Lucide React for consistency
- **Animations**: Framer Motion for professional polish
- **Responsive**: Mobile-first with progressive enhancement

### Interaction Patterns
- **Keyboard Navigation**: Full hotkey support
- **Mouse/Touch**: Smooth zoom, pan, drag operations
- **Visual Feedback**: Loading states, progress indicators
- **Error States**: Clear error messages and recovery options

## 🤖 AI/ML Integration

### Face Detection Pipeline
```typescript
// BlazeFace ONNX model integration
const detector = new BlazeFaceDetector()
const faces = await detector.detectFaces(imageData)

// Eye state analysis
const eyeStates = await Promise.all(
  faces.map(face => analyzeEyeState(face, imageData))
)
```

### Performance Optimization
- **Web Workers**: Heavy processing in background threads
- **Model Caching**: ONNX models loaded once and reused
- **Batch Processing**: Efficient handling of multiple images
- **Memory Management**: Proper cleanup of large objects

## 📊 Database Schema

### Core Types
```typescript
interface ImageRec {
  id: string
  fileName: string
  fileSize: number
  previewDataUrl?: string
  metadata: ImageMetadata
  phash?: string
  focusScore?: number
  faces?: FaceDetection[]
  autoCropRegion?: CropRegion
  rating: number              // 0-5 stars
  flag: 'pick' | 'reject' | null  // thumbs up/down
  // ... additional fields
}
```

### Indexing Strategy
- **Primary**: ID-based lookups
- **Secondary**: Rating, flag, group membership
- **Performance**: Compound indexes for complex queries

## 🐳 Docker Configuration

### Development Environment
```dockerfile
# Dockerfile.dev - Hot reload with volume mounting
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]
```

### Production Build
```dockerfile
# Multi-stage build for optimal size
FROM node:20-alpine AS deps
# ... dependency installation

FROM node:20-alpine AS builder
# ... build process

FROM node:20-alpine AS runner
# ... runtime configuration
```

## 🔒 Security Considerations

### File System Access
- **User Permissions**: Explicit folder selection required
- **Secure Context**: HTTPS required in production
- **Data Privacy**: No external API calls or telemetry
- **Local Storage**: All data stays on user's device

### AI Model Security
- **Model Integrity**: Verified ONNX model checksums
- **Input Validation**: Sanitized image data processing
- **Resource Limits**: Bounded memory and CPU usage

## 🚀 Performance Optimization

### Core Optimizations
- **Lazy Loading**: Images loaded on demand
- **Virtual Scrolling**: Efficient large dataset handling
- **Web Workers**: Non-blocking heavy computations
- **Memory Management**: Automatic garbage collection
- **Caching Strategy**: Multiple levels of data caching

### Monitoring
- **Performance Metrics**: Built-in timing measurements
- **Memory Usage**: Resource consumption tracking
- **Error Reporting**: Comprehensive error logging
- **Health Checks**: Docker container monitoring

## 📚 Knowledge Areas

### Essential Understanding
1. **File System Access API** - Browser security model
2. **IndexedDB/Dexie** - Local database operations
3. **ONNX Runtime Web** - AI model inference
4. **Canvas API** - Image processing and analysis
5. **Web Workers** - Background processing
6. **PWA Architecture** - Offline functionality
7. **Docker Containerization** - Deployment strategies

### Advanced Topics
1. **Perceptual Hashing** - Image similarity algorithms
2. **Computer Vision** - Face detection and analysis
3. **Image Processing** - Filters, transformations, cropping
4. **Performance Optimization** - Memory management, caching
5. **Cross-browser Compatibility** - Feature detection and fallbacks

## 🔄 Maintenance Guidelines

### Regular Tasks
- **Dependency Updates**: Monthly security and feature updates
- **Model Updates**: Quarterly AI model improvements
- **Performance Testing**: Load testing with large datasets
- **Browser Testing**: Cross-platform compatibility verification
- **Documentation**: Keep all docs synchronized with code changes

### Monitoring & Alerts
- **Error Rates**: Track and investigate failures
- **Performance Metrics**: Response times and memory usage
- **User Feedback**: Feature requests and bug reports
- **Security Alerts**: Vulnerability scanning and patches

## 🎯 Development Tips for AI Agents

### When Working on This Codebase:

1. **Always read existing code first** to understand patterns and conventions
2. **Use the TodoWrite tool** to track progress on multi-step tasks
3. **Run tests frequently** to ensure changes don't break functionality
4. **Check cross-browser compatibility** for File System Access API features
5. **Consider performance impact** when processing large image datasets
6. **Maintain TypeScript strict typing** throughout all changes
7. **Follow the established error handling patterns**
8. **Update documentation** when adding new features or changing APIs

### Common Pitfalls to Avoid:
- Don't assume external libraries are available - check package.json first
- Don't break the File System Access API security model
- Don't introduce memory leaks in image processing
- Don't change database schemas without migration strategy
- Don't remove TypeScript types or weaken type safety
- Don't skip testing for AI/ML components

### Best Practices:
- Use the established component patterns and props interfaces
- Leverage Web Workers for heavy computations
- Implement proper error boundaries and fallbacks
- Follow the reactive data flow with Dexie hooks
- Maintain the existing keyboard shortcut conventions
- Keep the user experience smooth and professional

---

**This codebase represents production-quality software with comprehensive testing, proper architecture, and professional polish. When making changes, maintain these high standards and always consider the end-user experience.**