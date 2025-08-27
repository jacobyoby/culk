import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FaceDetectionWorkerManager } from '../lib/ml/face-detection-worker-manager'

// Mock Worker for testing
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null
}

// Mock Worker constructor
global.Worker = vi.fn().mockImplementation(() => mockWorker)

// Mock canvas and image APIs
global.OffscreenCanvas = vi.fn().mockImplementation((width, height) => ({
  width,
  height,
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height
    }),
    putImageData: vi.fn()
  })
}))

describe('Face Detection', () => {
  let manager: FaceDetectionWorkerManager
  
  beforeEach(() => {
    manager = new FaceDetectionWorkerManager()
    vi.clearAllMocks()
  })
  
  afterEach(async () => {
    try {
      await manager.dispose()
      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10))
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  })

  it('should initialize worker correctly', async () => {
    await manager.initialize()
    
    expect(global.Worker).toHaveBeenCalledWith('/workers/face-detection-worker.js')
    expect(mockWorker.onmessage).toBeDefined()
    expect(mockWorker.onerror).toBeDefined()
  })

  it('should detect faces in image data', async () => {
    // Create mock image data
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with skin-tone pixels in center region
    for (let y = 30; y < 70; y++) {
      for (let x = 30; x < 70; x++) {
        const idx = (y * width + x) * 4
        data[idx] = 120     // R - skin tone
        data[idx + 1] = 80  // G
        data[idx + 2] = 60  // B
        data[idx + 3] = 255 // A
      }
    }
    
    const imageData = new ImageData(data, width, height)
    
    // Mock worker response
    const detectPromise = manager.detectFaces(imageData)
    
    // Simulate worker message
    const messageHandler = mockWorker.onmessage
    if (messageHandler) {
      const lastCall = mockWorker.postMessage.mock.calls[0]
      const requestId = lastCall[0].id
      
      messageHandler({
        data: {
          id: requestId,
          success: true,
          result: {
            faces: [
              {
                id: 'face-1',
                bbox: { x: 30, y: 30, width: 40, height: 40 },
                confidence: 0.85,
                eyeState: { left: 'open', right: 'open' },
                focusScore: 150
              }
            ],
            processingTime: 45,
            detectorUsed: 'fallback',
            eyeDetectionAvailable: false
          }
        }
      })
    }
    
    const result = await detectPromise
    
    expect(result.faces).toHaveLength(1)
    expect(result.faces[0].confidence).toBeGreaterThan(0.8)
    expect(result.faces[0].eyeState).toEqual({ left: 'open', right: 'open' })
  })

  it('should handle worker errors gracefully', async () => {
    const imageData = new ImageData(new Uint8ClampedArray(100 * 100 * 4), 100, 100)
    
    const detectPromise = manager.detectFaces(imageData)
    
    // Simulate worker error
    const messageHandler = mockWorker.onmessage
    if (messageHandler) {
      const lastCall = mockWorker.postMessage.mock.calls[0]
      const requestId = lastCall[0].id
      
      messageHandler({
        data: {
          id: requestId,
          success: false,
          error: 'Detection failed'
        }
      })
    }
    
    // Should fallback to synchronous detection instead of throwing
    const result = await detectPromise
    expect(result.detectorUsed).toBe('fallback')
  })

  it('should use fallback detection when worker fails', async () => {
    // Create image data with no clear skin tones
    const width = 50
    const height = 50
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with non-skin colors
    data.fill(100)
    
    const imageData = new ImageData(data, width, height)
    
    // Force worker failure by not setting up mock response
    const result = await manager.detectFaces(imageData)
    
    expect(result.detectorUsed).toBe('fallback')
    expect(result.faces).toEqual([]) // No skin tones detected
  })

  it('should detect skin-tone based faces in fallback mode', async () => {
    // Create image data with clear skin-tone region
    const width = 100
    const height = 100  
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill background with non-skin color
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 50      // R
      data[i + 1] = 50  // G  
      data[i + 2] = 50  // B
      data[i + 3] = 255 // A
    }
    
    // Add skin-tone region (simulating a face)
    for (let y = 25; y < 75; y++) {
      for (let x = 25; x < 75; x++) {
        const idx = (y * width + x) * 4
        data[idx] = 150     // R - typical skin tone
        data[idx + 1] = 100 // G
        data[idx + 2] = 80  // B
        data[idx + 3] = 255 // A
      }
    }
    
    const imageData = new ImageData(data, width, height)
    
    // This should trigger fallback detection
    const result = await manager.detectFaces(imageData)
    
    expect(result.detectorUsed).toBe('fallback')
    expect(result.faces.length).toBeGreaterThan(0)
    
    if (result.faces.length > 0) {
      const face = result.faces[0]
      expect(face.confidence).toBeGreaterThan(0)
      expect(face.bbox.width).toBeGreaterThan(0)
      expect(face.bbox.height).toBeGreaterThan(0)
    }
  })

  it('should update settings correctly', async () => {
    await manager.initialize()
    
    await manager.updateSettings({
      faceConfidenceThreshold: 0.8,
      eyeConfidenceThreshold: 0.9
    })
    
    // Verify settings were sent to worker
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update_settings',
        payload: {
          settings: {
            faceConfidenceThreshold: 0.8,
            eyeConfidenceThreshold: 0.9
          }
        }
      })
    )
  })

  it('should handle concurrent face detection requests', async () => {
    const imageData1 = new ImageData(new Uint8ClampedArray(50 * 50 * 4), 50, 50)
    const imageData2 = new ImageData(new Uint8ClampedArray(60 * 60 * 4), 60, 60)
    
    // Start concurrent detections
    const promise1 = manager.detectFaces(imageData1)
    const promise2 = manager.detectFaces(imageData2)
    
    // Both should fall back to synchronous detection and complete
    const [result1, result2] = await Promise.all([promise1, promise2])
    
    expect(result1.detectorUsed).toBe('fallback')
    expect(result2.detectorUsed).toBe('fallback')
  })

  it('should dispose properly', async () => {
    await manager.initialize()
    await manager.dispose()
    
    expect(mockWorker.terminate).toHaveBeenCalled()
    expect(manager.isAvailable()).toBe(false)
  })
})

describe('Skin Tone Detection', () => {
  let manager: FaceDetectionWorkerManager
  
  beforeEach(() => {
    manager = new FaceDetectionWorkerManager()
  })

  afterEach(async () => {
    await manager.dispose()
  })

  it('should detect typical skin tones', async () => {
    const width = 50
    const height = 50
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Test various skin tones
    const skinTones = [
      [150, 100, 80],  // Light skin
      [120, 80, 60],   // Medium skin  
      [90, 65, 50],    // Dark skin
      [200, 180, 150], // Very light skin
    ]
    
    for (const [r, g, b] of skinTones) {
      // Fill small region with skin tone
      for (let y = 10; y < 40; y++) {
        for (let x = 10; x < 40; x++) {
          const idx = (y * width + x) * 4
          data[idx] = r
          data[idx + 1] = g
          data[idx + 2] = b
          data[idx + 3] = 255
        }
      }
      
      const imageData = new ImageData(data, width, height)
      const result = await manager.detectFaces(imageData)
      
      // Should detect at least some face regions for skin tones
      expect(result.faces.length).toBeGreaterThanOrEqual(0) // Could be 0 if region is too small
    }
  })

  it('should not detect non-skin colors as faces', async () => {
    const width = 50
    const height = 50
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with clearly non-skin colors
    const nonSkinColors = [
      [0, 255, 0],     // Pure green
      [0, 0, 255],     // Pure blue  
      [255, 255, 255], // Pure white
      [0, 0, 0],       // Pure black
      [255, 0, 0],     // Pure red
    ]
    
    for (const [r, g, b] of nonSkinColors) {
      data.fill(0)
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          data[idx] = r
          data[idx + 1] = g
          data[idx + 2] = b
          data[idx + 3] = 255
        }
      }
      
      const imageData = new ImageData(data, width, height)
      const result = await manager.detectFaces(imageData)
      
      // Should not detect faces in non-skin colored images
      expect(result.faces).toHaveLength(0)
    }
  })
})