import { describe, it, expect, beforeEach } from 'vitest'
import { 
  calculateHistogram, 
  analyzeExposure, 
  autoEnhanceImage, 
  applyPreset,
  getAutoEnhancePresets,
  isEnhancementWorthwhile
} from '../lib/utils/auto-enhance'
import { ImageAdjustments } from '../lib/types'

function createTestImageData(width: number = 100, height: number = 100, pattern: 'dark' | 'bright' | 'normal' | 'lowContrast' = 'normal'): ImageData {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')
  
  canvas.width = width
  canvas.height = height
  const imageData = ctx.createImageData(width, height)
  const { data } = imageData
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    
    let r, g, b
    
    switch (pattern) {
      case 'dark':
        // Underexposed image - most pixels are dark
        r = g = b = Math.random() * 60 + 10 // 10-70 range
        break
      case 'bright':
        // Overexposed image - most pixels are bright
        r = g = b = Math.random() * 60 + 190 // 190-250 range
        break
      case 'lowContrast':
        // Low contrast - pixels clustered around middle gray
        r = g = b = Math.random() * 60 + 100 // 100-160 range
        break
      case 'normal':
      default:
        // Normal distribution across full range
        r = Math.random() * 255
        g = Math.random() * 255
        b = Math.random() * 255
        break
    }
    
    data[i] = r     // Red
    data[i + 1] = g // Green
    data[i + 2] = b // Blue
    data[i + 3] = 255 // Alpha
  }
  
  return imageData
}

describe('Auto Enhance Algorithms', () => {
  describe('calculateHistogram', () => {
    it('should calculate histogram correctly for a simple image', () => {
      const imageData = createTestImageData(2, 2, 'normal')
      const histogram = calculateHistogram(imageData)
      
      expect(histogram.red).toHaveLength(256)
      expect(histogram.green).toHaveLength(256)
      expect(histogram.blue).toHaveLength(256)
      expect(histogram.luminance).toHaveLength(256)
      expect(histogram.total).toBe(4) // 2x2 image
      
      // Check that histogram counts sum to total pixels
      const redSum = histogram.red.reduce((sum, count) => sum + count, 0)
      const greenSum = histogram.green.reduce((sum, count) => sum + count, 0)
      const blueSum = histogram.blue.reduce((sum, count) => sum + count, 0)
      const luminanceSum = histogram.luminance.reduce((sum, count) => sum + count, 0)
      
      expect(redSum).toBe(4)
      expect(greenSum).toBe(4)
      expect(blueSum).toBe(4)
      expect(luminanceSum).toBe(4)
    })
    
    it('should handle larger images efficiently', () => {
      const imageData = createTestImageData(500, 500, 'normal')
      const histogram = calculateHistogram(imageData)
      
      expect(histogram.total).toBe(250000) // 500x500
      
      const luminanceSum = histogram.luminance.reduce((sum, count) => sum + count, 0)
      expect(luminanceSum).toBe(250000)
    })
  })
  
  describe('analyzeExposure', () => {
    it('should detect underexposed images', () => {
      const imageData = createTestImageData(100, 100, 'dark')
      const histogram = calculateHistogram(imageData)
      const analysis = analyzeExposure(histogram)
      
      expect(analysis.isUnderexposed).toBe(true)
      expect(analysis.isOverexposed).toBe(false)
      expect(analysis.exposureScore).toBeLessThan(0)
      expect(analysis.shadowClipping).toBeGreaterThan(0)
    })
    
    it('should detect overexposed images', () => {
      const imageData = createTestImageData(100, 100, 'bright')
      const histogram = calculateHistogram(imageData)
      const analysis = analyzeExposure(histogram)
      
      expect(analysis.isOverexposed).toBe(true)
      expect(analysis.isUnderexposed).toBe(false)
      expect(analysis.exposureScore).toBeGreaterThan(0)
      expect(analysis.highlightClipping).toBeGreaterThan(0)
    })
    
    it('should detect low dynamic range', () => {
      const imageData = createTestImageData(100, 100, 'lowContrast')
      const histogram = calculateHistogram(imageData)
      const analysis = analyzeExposure(histogram)
      
      expect(analysis.dynamicRange).toBeLessThan(150)
      expect(analysis.midtoneBalance).toBeGreaterThan(0.7) // Most pixels in midtones
    })
    
    it('should calculate midtone balance correctly', () => {
      const imageData = createTestImageData(100, 100, 'normal')
      const histogram = calculateHistogram(imageData)
      const analysis = analyzeExposure(histogram)
      
      expect(analysis.midtoneBalance).toBeGreaterThan(0)
      expect(analysis.midtoneBalance).toBeLessThan(1)
    })
  })
  
  describe('autoEnhanceImage', () => {
    it('should enhance underexposed images', () => {
      const imageData = createTestImageData(100, 100, 'dark')
      const result = autoEnhanceImage(imageData)
      
      expect(result.analysis.isUnderexposed).toBe(true)
      expect(result.adjustments.brightness).toBeGreaterThan(0)
      expect(result.adjustments.shadows).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThan(0.3)
    })
    
    it('should enhance overexposed images', () => {
      const imageData = createTestImageData(100, 100, 'bright')
      const result = autoEnhanceImage(imageData)
      
      expect(result.analysis.isOverexposed).toBe(true)
      expect(result.adjustments.highlights).toBeLessThan(0) // Negative = recover highlights
      expect(result.confidence).toBeGreaterThan(0.3)
    })
    
    it('should enhance low contrast images', () => {
      const imageData = createTestImageData(100, 100, 'lowContrast')
      const result = autoEnhanceImage(imageData)
      
      expect(result.analysis.dynamicRange).toBeLessThan(180)
      expect(result.adjustments.contrast).toBeGreaterThan(0)
      expect(result.adjustments.saturation).toBeGreaterThan(0)
    })
    
    it('should work in conservative mode', () => {
      const imageData = createTestImageData(100, 100, 'dark')
      const conservativeResult = autoEnhanceImage(imageData, undefined, true)
      const normalResult = autoEnhanceImage(imageData, undefined, false)
      
      // Conservative should make smaller adjustments
      expect(Math.abs(conservativeResult.adjustments.brightness)).toBeLessThanOrEqual(
        Math.abs(normalResult.adjustments.brightness)
      )
      expect(Math.abs(conservativeResult.adjustments.contrast)).toBeLessThanOrEqual(
        Math.abs(normalResult.adjustments.contrast)
      )
    })
    
    it('should consider metadata when available', () => {
      const imageData = createTestImageData(100, 100, 'normal')
      const highISOMetadata = { iso: 3200 }
      const lowISOMetadata = { iso: 100 }
      
      const highISOResult = autoEnhanceImage(imageData, highISOMetadata)
      const lowISOResult = autoEnhanceImage(imageData, lowISOMetadata)
      
      // High ISO should get less saturation boost to avoid noise
      if (highISOResult.adjustments.saturation > 0 && lowISOResult.adjustments.saturation > 0) {
        expect(highISOResult.adjustments.saturation).toBeLessThan(lowISOResult.adjustments.saturation)
      }
    })
    
    it('should return reasonable confidence scores', () => {
      const imageData = createTestImageData(100, 100, 'normal')
      const result = autoEnhanceImage(imageData)
      
      expect(result.confidence).toBeGreaterThanOrEqual(0.1)
      expect(result.confidence).toBeLessThanOrEqual(1.0)
    })
  })
  
  describe('presets', () => {
    it('should return all available presets', () => {
      const presets = getAutoEnhancePresets()
      
      expect(presets).toHaveProperty('portrait')
      expect(presets).toHaveProperty('landscape')
      expect(presets).toHaveProperty('lowLight')
      expect(presets).toHaveProperty('highKey')
      expect(presets).toHaveProperty('dramatic')
      
      // Each preset should have reasonable values
      Object.values(presets).forEach(preset => {
        if (preset.brightness !== undefined) {
          expect(preset.brightness).toBeGreaterThanOrEqual(-50)
          expect(preset.brightness).toBeLessThanOrEqual(50)
        }
        if (preset.contrast !== undefined) {
          expect(preset.contrast).toBeGreaterThanOrEqual(-50)
          expect(preset.contrast).toBeLessThanOrEqual(50)
        }
      })
    })
    
    it('should apply presets correctly', () => {
      const portraitAdjustments = applyPreset('portrait')
      const landscapeAdjustments = applyPreset('landscape')
      
      expect(portraitAdjustments).toHaveProperty('brightness')
      expect(portraitAdjustments).toHaveProperty('contrast')
      expect(portraitAdjustments).toHaveProperty('saturation')
      expect(portraitAdjustments).toHaveProperty('highlights')
      expect(portraitAdjustments).toHaveProperty('shadows')
      expect(portraitAdjustments).toHaveProperty('vibrance')
      
      // Portrait and landscape should have different characteristics
      expect(portraitAdjustments).not.toEqual(landscapeAdjustments)
    })
    
    it('should fallback to portrait for unknown presets', () => {
      const unknownPreset = applyPreset('unknown')
      const portraitPreset = applyPreset('portrait')
      
      expect(unknownPreset).toEqual(portraitPreset)
    })
  })
  
  describe('isEnhancementWorthwhile', () => {
    it('should detect worthwhile enhancements', () => {
      const significantResult = {
        adjustments: {
          brightness: 15,
          contrast: 10,
          saturation: 8,
          highlights: -20,
          shadows: 25,
          vibrance: 12
        } as ImageAdjustments,
        analysis: {} as any,
        confidence: 0.8
      }
      
      expect(isEnhancementWorthwhile(significantResult)).toBe(true)
    })
    
    it('should reject minor enhancements', () => {
      const minorResult = {
        adjustments: {
          brightness: 1,
          contrast: 2,
          saturation: 1,
          highlights: -2,
          shadows: 3,
          vibrance: 2
        } as ImageAdjustments,
        analysis: {} as any,
        confidence: 0.2
      }
      
      expect(isEnhancementWorthwhile(minorResult)).toBe(false)
    })
    
    it('should consider confidence in worthwhile check', () => {
      const lowConfidenceResult = {
        adjustments: {
          brightness: 20,
          contrast: 15,
          saturation: 10,
          highlights: -15,
          shadows: 20,
          vibrance: 15
        } as ImageAdjustments,
        analysis: {} as any,
        confidence: 0.2 // Low confidence
      }
      
      expect(isEnhancementWorthwhile(lowConfidenceResult)).toBe(false)
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  it('should handle empty or invalid images', () => {
    const emptyImageData = new ImageData(1, 1)
    const histogram = calculateHistogram(emptyImageData)
    
    expect(histogram.total).toBe(1)
    expect(histogram.red.reduce((sum, count) => sum + count, 0)).toBe(1)
  })
  
  it('should handle extreme exposure cases', () => {
    // All black image
    const blackCanvas = document.createElement('canvas')
    const blackCtx = blackCanvas.getContext('2d')!
    blackCanvas.width = blackCanvas.height = 10
    const blackImageData = blackCtx.createImageData(10, 10)
    // Data is already all zeros (black)
    
    const blackResult = autoEnhanceImage(blackImageData)
    expect(blackResult.adjustments.brightness).toBeGreaterThan(0)
    expect(blackResult.adjustments.shadows).toBeGreaterThan(0)
    
    // All white image
    const whiteCanvas = document.createElement('canvas')
    const whiteCtx = whiteCanvas.getContext('2d')!
    whiteCanvas.width = whiteCanvas.height = 10
    const whiteImageData = whiteCtx.createImageData(10, 10)
    for (let i = 0; i < whiteImageData.data.length; i += 4) {
      whiteImageData.data[i] = 255     // R
      whiteImageData.data[i + 1] = 255 // G
      whiteImageData.data[i + 2] = 255 // B
      whiteImageData.data[i + 3] = 255 // A
    }
    
    const whiteResult = autoEnhanceImage(whiteImageData)
    expect(whiteResult.adjustments.highlights).toBeLessThan(0)
  })
})