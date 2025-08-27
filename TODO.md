# TODO - AI Photo Culling Project

## High Priority

### 🔧 Core Functionality
- [ ] **LibRaw WASM Integration** - Complete RAW file preview generation
- [ ] **Batch Processing** - Multi-select operations for ratings and flags
- [ ] **Undo/Redo System** - Action history for rating and flag changes
- [ ] **Performance Optimization** - Virtualized scrolling for large image sets

### 🎯 User Experience  
- [ ] **Keyboard Navigation Enhancement** - Add more shortcuts (Delete key, Space bar)
- [ ] **Progressive Loading** - Better loading states and progress indicators
- [ ] **Drag & Drop Import** - Alternative to folder selection
- [ ] **Thumbnail Quality Settings** - User configurable preview sizes

### 🛠️ Advanced Features
- [ ] **Custom Export Templates** - User-defined XMP templates
- [ ] **Metadata Editing** - Basic EXIF editing capabilities
- [ ] **Color Profile Support** - ICC profile handling
- [ ] **Duplicate Detection** - More sophisticated similarity algorithms

## Medium Priority

### 🎨 UI/UX Improvements
- [ ] **Dark/Light Theme Toggle** - User preference system
- [ ] **Customizable Layouts** - Adjustable panel sizes and positions
- [ ] **Tooltips and Help System** - Better onboarding experience
- [ ] **Accessibility** - Screen reader support, keyboard navigation

### ⚡ Performance & Reliability
- [ ] **Web Workers Optimization** - Better resource management
- [ ] **Memory Usage Monitoring** - Automatic cleanup and warnings
- [ ] **Error Recovery** - Graceful handling of corrupted files
- [ ] **Offline Mode Enhancement** - Better PWA capabilities

### 🧪 Testing & Quality
- [ ] **End-to-End Tests** - Playwright test coverage
- [ ] **Performance Tests** - Benchmarking large image sets
- [ ] **Cross-Browser Testing** - Safari and Firefox compatibility
- [ ] **Mobile Responsiveness** - Touch device support

## Low Priority

### 📱 Platform Support
- [ ] **Mobile PWA** - Touch-optimized interface
- [ ] **Electron Desktop App** - Native desktop version
- [ ] **Tauri Alternative** - Rust-based desktop app
- [ ] **Browser Extension** - Quick culling from file managers

### 🔮 Future Enhancements
- [ ] **AI-Powered Auto-Rating** - Machine learning rating suggestions
- [ ] **CLIP Embeddings** - Semantic image search
- [ ] **Cloud Backup Integration** - Optional cloud storage
- [ ] **Collaborative Culling** - Multi-user review sessions

### 🌐 Integrations
- [ ] **Lightroom Plugin** - Direct import/export
- [ ] **Capture One Integration** - Session file support
- [ ] **Photo Mechanic** - Metadata compatibility
- [ ] **Adobe Bridge** - Workflow integration

## Technical Debt

### 🔄 Refactoring
- [ ] **Component Abstraction** - Reduce code duplication
- [ ] **Type Safety** - Improve TypeScript coverage
- [ ] **Error Handling** - Consistent error boundaries
- [ ] **Configuration System** - Centralized settings management

### 📚 Documentation
- [ ] **API Documentation** - Complete function documentation
- [ ] **Architecture Guide** - Detailed system design docs
- [ ] **Contributing Guide** - Development setup and guidelines
- [ ] **Deployment Guide** - Production deployment instructions

### 🔒 Security & Privacy
- [ ] **Security Audit** - Third-party security review
- [ ] **Privacy Policy** - Clear data handling documentation
- [ ] **Content Security Policy** - Enhanced CSP headers
- [ ] **Dependency Audit** - Regular security updates

## Completed Recently ✅

- [x] **Face Detection System** - BlazeFace ONNX implementation with eye state analysis
- [x] **Smart Crop Tool** - Face-aware cropping with multiple suggestion algorithms  
- [x] **Image Adjustments** - Real-time brightness, contrast, saturation controls
- [x] **Advanced Adjustments** - Highlights, shadows, vibrance controls
- [x] **Thumbs Up/Down UI** - Replaced flag/X icons with intuitive thumbs
- [x] **Scroll Behavior Fix** - Proper mouse wheel handling in image viewer
- [x] **Crop Icon Polish** - Fixed check mark positioning and styling
- [x] **Comprehensive Testing** - Unit, integration, and acceptance tests
- [x] **Docker Production Setup** - Multi-stage builds with health checks

## Notes

### Development Priorities
1. Focus on core functionality completion (LibRaw, batch operations)
2. Improve user experience with better loading and feedback
3. Add advanced features once core is stable
4. Maintain high code quality and test coverage

### Performance Targets
- Import 1000+ images in under 30 seconds
- Smooth 60fps interactions in image viewer
- Memory usage under 2GB for large photo sessions
- PWA install and offline functionality

### Browser Support
- **Primary**: Chrome 86+, Edge 86+ (File System Access API)
- **Secondary**: Firefox 78+, Safari 15.2+ (with fallbacks)
- **Mobile**: iOS Safari 15+, Chrome Android 86+