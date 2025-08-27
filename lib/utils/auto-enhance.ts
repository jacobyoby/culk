import { ImageAdjustments, ImageMetadata } from '../types'

// Constants for exposure analysis thresholds
const EXPOSURE_THRESHOLDS = {
  SHADOW_THRESHOLD: 16,          // Values below this are considered shadows
  HIGHLIGHT_THRESHOLD: 235,      // Values above this are considered highlights
  UNDEREXPOSED_MEAN: 85,         // Mean luminance below this suggests underexposure
  OVEREXPOSED_MEAN: 170,         // Mean luminance above this suggests overexposure
  SHADOW_CLIPPING_PERCENT: 15,   // Shadow clipping % threshold for underexposure
  HIGHLIGHT_CLIPPING_PERCENT: 5, // Highlight clipping % threshold for overexposure
  MIN_PIXEL_PERCENT: 0.001,      // Minimum % of pixels to consider for dynamic range
  IDEAL_MEAN_LUMINANCE: 128,     // Ideal mean luminance for exposure
  LOW_DYNAMIC_RANGE: 180,        // Dynamic range below this is considered low
  HIGH_DYNAMIC_RANGE: 220,       // Dynamic range above this is considered high
  GOOD_MIDTONE_BALANCE: 0.4,     // Midtone balance above this is considered good
  HIGH_ISO_THRESHOLD: 1600,      // ISO above this is considered high (noisy)
  MIDTONE_START: 64,             // Start of midtone range
  MIDTONE_END: 192,              // End of midtone range
} as const

// Constants for enhancement limits
const ENHANCEMENT_LIMITS = {
  MAX_SHADOW_LIFT_CONSERVATIVE: 25,
  MAX_SHADOW_LIFT_NORMAL: 40,
  MAX_HIGHLIGHT_RECOVERY_CONSERVATIVE: -25,
  MAX_HIGHLIGHT_RECOVERY_NORMAL: -40,
  MAX_BRIGHTNESS_BOOST_CONSERVATIVE: 15,
  MAX_BRIGHTNESS_BOOST_NORMAL: 25,
  MAX_BRIGHTNESS_REDUCTION_CONSERVATIVE: -10,
  MAX_BRIGHTNESS_REDUCTION_NORMAL: -15,
  MAX_CONTRAST_BOOST_CONSERVATIVE: 15,
  MAX_CONTRAST_BOOST_NORMAL: 25,
  CONTRAST_REDUCTION_CONSERVATIVE: -5,
  CONTRAST_REDUCTION_NORMAL: -8,
  SATURATION_BOOST_CONSERVATIVE: 8,
  SATURATION_BOOST_NORMAL: 12,
  VIBRANCE_BOOST_CONSERVATIVE: 10,
  VIBRANCE_BOOST_NORMAL: 15,
  HIGH_ISO_SATURATION_FACTOR: 0.7,
  MAX_SAMPLE_SIZE: 800,           // Maximum dimension for performance sampling
} as const

export interface HistogramData {
  red: number[]
  green: number[]
  blue: number[]
  luminance: number[]
  total: number
}

export interface ExposureAnalysis {
  isUnderexposed: boolean
  isOverexposed: boolean
  exposureScore: number // -1 to 1, 0 is ideal
  shadowClipping: number // percentage
  highlightClipping: number // percentage
  dynamicRange: number
  midtoneBalance: number
}

export interface AutoEnhanceResult {
  adjustments: ImageAdjustments
  analysis: ExposureAnalysis
  confidence: number // 0-1, how confident we are in the enhancement
}

export function calculateHistogram(imageData: ImageData): HistogramData {
  const { data, width, height } = imageData
  const histogram: HistogramData = {
    red: new Array(256).fill(0),
    green: new Array(256).fill(0),
    blue: new Array(256).fill(0),
    luminance: new Array(256).fill(0),
    total: width * height
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    histogram.red[r]++
    histogram.green[g]++
    histogram.blue[b]++
    
    // Calculate luminance using standard weights
    const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    histogram.luminance[luminance]++
  }

  return histogram
}

export function analyzeExposure(histogram: HistogramData, metadata?: ImageMetadata): ExposureAnalysis {
  const { luminance, total } = histogram
  
  // Calculate shadow and highlight clipping
  let shadowClipping = 0
  let highlightClipping = 0
  
  for (let i = 0; i < EXPOSURE_THRESHOLDS.SHADOW_THRESHOLD; i++) {
    shadowClipping += luminance[i]
  }
  
  for (let i = EXPOSURE_THRESHOLDS.HIGHLIGHT_THRESHOLD; i < 256; i++) {
    highlightClipping += luminance[i]
  }
  
  const shadowPercent = (shadowClipping / total) * 100
  const highlightPercent = (highlightClipping / total) * 100
  
  // Calculate weighted mean (center of mass)
  let weightedSum = 0
  for (let i = 0; i < 256; i++) {
    weightedSum += i * luminance[i]
  }
  const meanLuminance = weightedSum / total
  
  // Calculate exposure score (-1 underexposed, 0 ideal, 1 overexposed)
  const exposureScore = (meanLuminance - EXPOSURE_THRESHOLDS.IDEAL_MEAN_LUMINANCE) / EXPOSURE_THRESHOLDS.IDEAL_MEAN_LUMINANCE
  
  // Determine exposure state
  const isUnderexposed = meanLuminance < EXPOSURE_THRESHOLDS.UNDEREXPOSED_MEAN || 
                        shadowPercent > EXPOSURE_THRESHOLDS.SHADOW_CLIPPING_PERCENT
  const isOverexposed = meanLuminance > EXPOSURE_THRESHOLDS.OVEREXPOSED_MEAN || 
                       highlightPercent > EXPOSURE_THRESHOLDS.HIGHLIGHT_CLIPPING_PERCENT
  
  // Calculate dynamic range (simplified)
  let firstNonZero = -1
  let lastNonZero = -1
  
  for (let i = 0; i < 256; i++) {
    if (luminance[i] > total * EXPOSURE_THRESHOLDS.MIN_PIXEL_PERCENT) {
      if (firstNonZero === -1) firstNonZero = i
      lastNonZero = i
    }
  }
  
  const dynamicRange = lastNonZero - firstNonZero
  
  // Calculate midtone balance (how well distributed midtones are)
  let midtoneSum = 0
  for (let i = EXPOSURE_THRESHOLDS.MIDTONE_START; i < EXPOSURE_THRESHOLDS.MIDTONE_END; i++) {
    midtoneSum += luminance[i]
  }
  const midtoneBalance = midtoneSum / total
  
  return {
    isUnderexposed,
    isOverexposed,
    exposureScore,
    shadowClipping: shadowPercent,
    highlightClipping: highlightPercent,
    dynamicRange,
    midtoneBalance
  }
}

export function autoEnhanceImage(
  imageData: ImageData, 
  metadata?: ImageMetadata,
  conservative: boolean = true
): AutoEnhanceResult {
  const histogram = calculateHistogram(imageData)
  const analysis = analyzeExposure(histogram, metadata)
  
  let adjustments: ImageAdjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    highlights: 0,
    shadows: 0,
    vibrance: 0
  }
  
  let confidence = 0.5
  
  // Shadow/Highlight recovery based on clipping
  if (analysis.shadowClipping > 10) {
    // Lift shadows
    const maxShadowLift = conservative ? ENHANCEMENT_LIMITS.MAX_SHADOW_LIFT_CONSERVATIVE : ENHANCEMENT_LIMITS.MAX_SHADOW_LIFT_NORMAL
    adjustments.shadows = Math.min(maxShadowLift, analysis.shadowClipping * 2)
    confidence += 0.2
  }
  
  if (analysis.highlightClipping > 3) {
    // Recover highlights
    const maxHighlightRecovery = conservative ? ENHANCEMENT_LIMITS.MAX_HIGHLIGHT_RECOVERY_CONSERVATIVE : ENHANCEMENT_LIMITS.MAX_HIGHLIGHT_RECOVERY_NORMAL
    adjustments.highlights = Math.max(maxHighlightRecovery, -analysis.highlightClipping * 8)
    confidence += 0.2
  }
  
  // Brightness adjustment based on mean luminance
  if (analysis.isUnderexposed) {
    const maxBrightnessBump = conservative ? ENHANCEMENT_LIMITS.MAX_BRIGHTNESS_BOOST_CONSERVATIVE : ENHANCEMENT_LIMITS.MAX_BRIGHTNESS_BOOST_NORMAL
    const brightnessBump = Math.min(maxBrightnessBump, Math.abs(analysis.exposureScore) * 30)
    adjustments.brightness = brightnessBump
    confidence += 0.15
  } else if (analysis.isOverexposed && analysis.highlightClipping < 8) {
    // Only darken if not too much highlight clipping (prefer highlight recovery)
    const maxBrightnessReduction = conservative ? ENHANCEMENT_LIMITS.MAX_BRIGHTNESS_REDUCTION_CONSERVATIVE : ENHANCEMENT_LIMITS.MAX_BRIGHTNESS_REDUCTION_NORMAL
    const brightnessReduction = Math.max(maxBrightnessReduction, analysis.exposureScore * 20)
    adjustments.brightness = brightnessReduction
    confidence += 0.1
  }
  
  // Contrast adjustment based on dynamic range
  if (analysis.dynamicRange < EXPOSURE_THRESHOLDS.LOW_DYNAMIC_RANGE && !analysis.isOverexposed) {
    // Low dynamic range, boost contrast
    const maxContrastBoost = conservative ? ENHANCEMENT_LIMITS.MAX_CONTRAST_BOOST_CONSERVATIVE : ENHANCEMENT_LIMITS.MAX_CONTRAST_BOOST_NORMAL
    const contrastBoost = Math.min(maxContrastBoost, (EXPOSURE_THRESHOLDS.LOW_DYNAMIC_RANGE - analysis.dynamicRange) / 8)
    adjustments.contrast = contrastBoost
    confidence += 0.1
  } else if (analysis.dynamicRange > EXPOSURE_THRESHOLDS.HIGH_DYNAMIC_RANGE && (analysis.isUnderexposed || analysis.isOverexposed)) {
    // High dynamic range with exposure issues, reduce contrast slightly
    adjustments.contrast = conservative ? ENHANCEMENT_LIMITS.CONTRAST_REDUCTION_CONSERVATIVE : ENHANCEMENT_LIMITS.CONTRAST_REDUCTION_NORMAL
  }
  
  // Saturation enhancement based on exposure and metadata
  if (analysis.midtoneBalance > EXPOSURE_THRESHOLDS.GOOD_MIDTONE_BALANCE && !analysis.isOverexposed) {
    // Good midtone distribution, can enhance saturation
    let saturationBoost = conservative ? ENHANCEMENT_LIMITS.SATURATION_BOOST_CONSERVATIVE : ENHANCEMENT_LIMITS.SATURATION_BOOST_NORMAL
    
    // Reduce saturation boost for high ISO images (likely to be noisy)
    if (metadata?.iso && metadata.iso > EXPOSURE_THRESHOLDS.HIGH_ISO_THRESHOLD) {
      saturationBoost *= ENHANCEMENT_LIMITS.HIGH_ISO_SATURATION_FACTOR
    }
    
    adjustments.saturation = saturationBoost
    adjustments.vibrance = conservative ? ENHANCEMENT_LIMITS.VIBRANCE_BOOST_CONSERVATIVE : ENHANCEMENT_LIMITS.VIBRANCE_BOOST_NORMAL
    confidence += 0.1
  }
  
  // Reduce confidence for extreme cases
  if (analysis.shadowClipping > 25 || analysis.highlightClipping > 15) {
    confidence *= 0.7
  }
  
  // Boost confidence for well-balanced images that just need minor tweaks
  if (analysis.shadowClipping < 5 && analysis.highlightClipping < 2 && 
      analysis.dynamicRange > 150 && analysis.midtoneBalance > 0.3) {
    confidence = Math.min(0.9, confidence + 0.2)
  }
  
  return {
    adjustments,
    analysis,
    confidence: Math.max(0.1, Math.min(1.0, confidence))
  }
}

export function getAutoEnhancePresets(): Record<string, Partial<ImageAdjustments>> {
  return {
    portrait: {
      brightness: 5,
      contrast: 10,
      saturation: 8,
      shadows: 15,
      highlights: -10,
      vibrance: 20
    },
    landscape: {
      brightness: 2,
      contrast: 15,
      saturation: 12,
      shadows: 20,
      highlights: -15,
      vibrance: 25
    },
    lowLight: {
      brightness: 20,
      contrast: 12,
      saturation: 5,
      shadows: 35,
      highlights: -5,
      vibrance: 15
    },
    highKey: {
      brightness: -8,
      contrast: 8,
      saturation: 6,
      shadows: 10,
      highlights: -25,
      vibrance: 12
    },
    dramatic: {
      brightness: -2,
      contrast: 25,
      saturation: 15,
      shadows: 25,
      highlights: -20,
      vibrance: 30
    }
  }
}

export function applyPreset(preset: string): ImageAdjustments {
  const presets = getAutoEnhancePresets()
  const presetAdjustments = presets[preset] || presets.portrait
  
  return {
    brightness: presetAdjustments.brightness || 0,
    contrast: presetAdjustments.contrast || 0,
    saturation: presetAdjustments.saturation || 0,
    highlights: presetAdjustments.highlights || 0,
    shadows: presetAdjustments.shadows || 0,
    vibrance: presetAdjustments.vibrance || 0
  }
}

export async function autoEnhanceFromCanvas(
  canvas: HTMLCanvasElement,
  metadata?: ImageMetadata,
  conservative: boolean = true
): Promise<AutoEnhanceResult> {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }
  
  // Sample a smaller area for performance if image is large
  const scale = Math.min(1, ENHANCEMENT_LIMITS.MAX_SAMPLE_SIZE / Math.max(canvas.width, canvas.height))
  
  const sampleWidth = Math.floor(canvas.width * scale)
  const sampleHeight = Math.floor(canvas.height * scale)
  
  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  
  return autoEnhanceImage(imageData, metadata, conservative)
}

export function isEnhancementWorthwhile(result: AutoEnhanceResult): boolean {
  return result.confidence > 0.3 && (
    Math.abs(result.adjustments.brightness) > 3 ||
    Math.abs(result.adjustments.contrast) > 5 ||
    Math.abs(result.adjustments.shadows) > 8 ||
    Math.abs(result.adjustments.highlights) > 8 ||
    result.adjustments.saturation > 5 ||
    result.adjustments.vibrance > 8
  )
}