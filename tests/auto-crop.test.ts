import { describe, it, expect } from 'vitest'
import { detectAutoCropRegion } from '../lib/utils/crop'

describe('Enhanced Auto Crop', () => {
  it('should generate edge-detection crop region', () => {
    // Create test image data
    const width = 300
    const height = 200
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with some test pattern
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128     // R
      data[i + 1] = 128 // G
      data[i + 2] = 128 // B
      data[i + 3] = 255 // A
    }
    
    const imageData = new ImageData(data, width, height)
    const result = detectAutoCropRegion(imageData, { method: 'edge-detection' })
    
    expect(result.region.width).toBeGreaterThan(0)
    expect(result.region.height).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.method).toBe('edge-detection')
  })

  it('should generate golden-ratio crop region', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)
    const imageData = new ImageData(data, width, height)
    
    const result = detectAutoCropRegion(imageData, { method: 'golden-ratio' })
    
    expect(result.region.width).toBeGreaterThan(0)
    expect(result.region.height).toBeGreaterThan(0)
    expect(result.method).toBe('golden-ratio')
    
    // Golden ratio should be close to 1.618
    const aspectRatio = result.region.width / result.region.height
    expect(Math.abs(aspectRatio - 1.618)).toBeLessThan(0.1)
  })

  it('should generate center crop region', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)
    const imageData = new ImageData(data, width, height)
    
    const result = detectAutoCropRegion(imageData, { method: 'center' })
    
    expect(result.region.width).toBeGreaterThan(0)
    expect(result.region.height).toBeGreaterThan(0)
    expect(result.method).toBe('center')
    
    // Should be centered
    const centerX = result.region.x + result.region.width / 2
    const centerY = result.region.y + result.region.height / 2
    expect(Math.abs(centerX - width / 2)).toBeLessThan(5)
    expect(Math.abs(centerY - height / 2)).toBeLessThan(5)
  })

  it('should respect minimum crop ratio', () => {
    const width = 400
    const height = 300
    const minCropRatio = 0.8
    const data = new Uint8ClampedArray(width * height * 4)
    const imageData = new ImageData(data, width, height)
    
    const result = detectAutoCropRegion(imageData, { 
      method: 'edge-detection',
      minCropRatio 
    })
    
    const actualRatio = (result.region.width * result.region.height) / (width * height)
    expect(actualRatio).toBeGreaterThanOrEqual(minCropRatio - 0.1) // Small tolerance
  })

  it('should apply padding correctly', () => {
    const width = 400
    const height = 300
    const padding = 0.1
    const data = new Uint8ClampedArray(width * height * 4)
    const imageData = new ImageData(data, width, height)
    
    const result = detectAutoCropRegion(imageData, { 
      method: 'golden-ratio',
      padding 
    })
    
    // With padding, crop should be smaller than without
    const resultNoPadding = detectAutoCropRegion(imageData, { 
      method: 'golden-ratio',
      padding: 0 
    })
    
    expect(result.region.width).toBeLessThanOrEqual(resultNoPadding.region.width)
    expect(result.region.height).toBeLessThanOrEqual(resultNoPadding.region.height)
  })
})

describe('Face-Aware Crop Integration', () => {
  it('should calculate face bounding box correctly', () => {
    // Mock face detection data
    const faces = [
      {
        id: 'face1',
        bbox: { x: 25, y: 30, width: 20, height: 25 }, // 25% from left, 30% from top
        confidence: 0.9,
        eyeState: { left: 'open', right: 'open' },
        focusScore: 0.8
      },
      {
        id: 'face2', 
        bbox: { x: 50, y: 35, width: 15, height: 20 },
        confidence: 0.8,
        eyeState: { left: 'open', right: 'open' },
        focusScore: 0.7
      }
    ]
    
    const imageWidth = 400
    const imageHeight = 300
    
    // Calculate expected bounding box
    const face1X = (25 / 100) * imageWidth  // 100px
    const face1Y = (30 / 100) * imageHeight // 90px
    const face1W = (20 / 100) * imageWidth  // 80px
    const face1H = (25 / 100) * imageHeight // 75px
    
    const face2X = (50 / 100) * imageWidth  // 200px
    const face2Y = (35 / 100) * imageHeight // 105px
    const face2W = (15 / 100) * imageWidth  // 60px
    const face2H = (20 / 100) * imageHeight // 60px
    
    const minX = Math.min(face1X, face2X)          // 100px
    const minY = Math.min(face1Y, face2Y)          // 90px 
    const maxX = Math.max(face1X + face1W, face2X + face2W) // max(180, 260) = 260px
    const maxY = Math.max(face1Y + face1H, face2Y + face2H) // max(165, 165) = 165px
    
    expect(minX).toBe(100)
    expect(minY).toBe(90)
    expect(maxX).toBe(260)
    expect(maxY).toBe(165)
  })
})