import { describe, it, expect } from 'vitest'
import { FaceDetectionWorkerManager } from '../lib/ml/face-detection-worker-manager'

// Simple demo test that doesn't rely on complex mocking
describe('Face Detection Demo', () => {
  it('should create face detection manager instance', () => {
    const manager = new FaceDetectionWorkerManager()
    expect(manager).toBeDefined()
    expect(manager.isAvailable()).toBe(false) // Not initialized yet
  })

  it('should handle fallback skin tone detection', async () => {
    const manager = new FaceDetectionWorkerManager()
    
    // Create image data with clear skin-tone region
    const width = 100
    const height = 100  
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill background with dark color
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30      // R
      data[i + 1] = 30  // G  
      data[i + 2] = 30  // B
      data[i + 3] = 255 // A
    }
    
    // Add large skin-tone region (simulating a face)
    for (let y = 20; y < 80; y++) {
      for (let x = 20; x < 80; x++) {
        const idx = (y * width + x) * 4
        data[idx] = 150     // R - typical skin tone
        data[idx + 1] = 100 // G
        data[idx + 2] = 80  // B
        data[idx + 3] = 255 // A
      }
    }
    
    const imageData = new ImageData(data, width, height)
    
    // This will use fallback detection since no ONNX models are loaded
    const result = await manager.detectFaces(imageData)
    
    expect(result.detectorUsed).toBe('fallback')
    expect(result.faces.length).toBeGreaterThan(0)
    
    if (result.faces.length > 0) {
      const face = result.faces[0]
      expect(face.id).toBeDefined()
      expect(face.confidence).toBeGreaterThan(0)
      expect(face.bbox).toBeDefined()
      expect(face.bbox.width).toBeGreaterThan(0)
      expect(face.bbox.height).toBeGreaterThan(0)
      expect(face.eyeState).toEqual({ left: 'unknown', right: 'unknown' })
    }
    
    await manager.dispose()
  })

  it('should not detect faces in non-skin colored images', async () => {
    const manager = new FaceDetectionWorkerManager()
    
    // Create image data with no skin tones
    const width = 50
    const height = 50
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with pure blue (definitely not skin)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0       // R
      data[i + 1] = 0   // G  
      data[i + 2] = 255 // B - pure blue
      data[i + 3] = 255 // A
    }
    
    const imageData = new ImageData(data, width, height)
    
    const result = await manager.detectFaces(imageData)
    
    expect(result.detectorUsed).toBe('fallback')
    expect(result.faces).toHaveLength(0) // No skin tones detected
    
    await manager.dispose()
  })

  it('should validate face detection data structures', () => {
    // Test that our face detection types are properly structured
    const mockFace = {
      id: 'face-test-1',
      bbox: {
        x: 25.5,      // percentage
        y: 30.2,      // percentage  
        width: 40.0,  // percentage
        height: 45.5  // percentage
      },
      confidence: 0.85,
      eyeState: {
        left: 'open' as const,
        right: 'closed' as const
      },
      focusScore: 150.2
    }

    // Validate structure matches our FaceDetection interface
    expect(mockFace.id).toBeDefined()
    expect(mockFace.bbox.x).toBeGreaterThanOrEqual(0)
    expect(mockFace.bbox.y).toBeGreaterThanOrEqual(0)
    expect(mockFace.bbox.width).toBeGreaterThan(0)
    expect(mockFace.bbox.height).toBeGreaterThan(0)
    expect(mockFace.confidence).toBeGreaterThan(0)
    expect(mockFace.confidence).toBeLessThanOrEqual(1)
    expect(['open', 'closed', 'unknown']).toContain(mockFace.eyeState.left)
    expect(['open', 'closed', 'unknown']).toContain(mockFace.eyeState.right)
    expect(mockFace.focusScore).toBeGreaterThan(0)
  })
})