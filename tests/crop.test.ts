import { describe, it, expect, beforeAll } from 'vitest'
import { detectAutoCropRegion, CropRegion } from '../lib/utils/crop'

// Mock environment for browser APIs
beforeAll(() => {
  global.window = {} as any
  global.document = {} as any
})

describe('Crop Detection', () => {
  it('should detect center crop region', () => {
    // Create a simple test image data
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with white background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255     // R
      data[i + 1] = 255 // G
      data[i + 2] = 255 // B
      data[i + 3] = 255 // A
    }
    
    const imageData = new ImageData(data, width, height)
    const result = detectAutoCropRegion(imageData, { method: 'center' })
    
    expect(result.region).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number)
    })
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.method).toBe('center')
  })
  
  it('should detect golden ratio crop', () => {
    const width = 200
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Fill with solid color
    data.fill(128)
    
    const imageData = new ImageData(data, width, height)
    const result = detectAutoCropRegion(imageData, { method: 'golden-ratio' })
    
    expect(result.method).toBe('golden-ratio')
    expect(result.region.width / result.region.height).toBeCloseTo(1.618, 1)
  })
  
  it('should respect minimum crop ratio', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    data.fill(0) // Black image
    
    const imageData = new ImageData(data, width, height)
    const result = detectAutoCropRegion(imageData, { 
      method: 'edge-detection',
      minCropRatio: 0.8 
    })
    
    const cropRatio = (result.region.width * result.region.height) / (width * height)
    expect(cropRatio).toBeGreaterThanOrEqual(0.7) // Allow some tolerance
  })
  
  it('should handle different aspect ratios', () => {
    const testCases = [
      { width: 160, height: 90 },  // 16:9
      { width: 100, height: 100 }, // 1:1
      { width: 90, height: 160 },  // 9:16
    ]
    
    testCases.forEach(({ width, height }) => {
      const data = new Uint8ClampedArray(width * height * 4)
      data.fill(128)
      
      const imageData = new ImageData(data, width, height)
      const result = detectAutoCropRegion(imageData)
      
      expect(result.region.x).toBeGreaterThanOrEqual(0)
      expect(result.region.y).toBeGreaterThanOrEqual(0)
      expect(result.region.x + result.region.width).toBeLessThanOrEqual(width)
      expect(result.region.y + result.region.height).toBeLessThanOrEqual(height)
    })
  })
})