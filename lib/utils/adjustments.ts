import { ImageAdjustments } from '../types'

export function adjustmentsToCSSFilter(adjustments: ImageAdjustments): string {
  const filters: string[] = []

  // Basic brightness with highlights/shadows compensation
  let effectiveBrightness = adjustments.brightness
  
  // Highlights: reduce brightness in bright areas (simulate highlight recovery)
  if (adjustments.highlights !== 0) {
    effectiveBrightness += adjustments.highlights * 0.3
  }
  
  // Shadows: lift brightness in dark areas (simulate shadow lifting)
  if (adjustments.shadows !== 0) {
    effectiveBrightness += adjustments.shadows * 0.4
  }

  // Apply brightness
  if (effectiveBrightness !== 0) {
    const brightness = 1 + (effectiveBrightness / 100)
    filters.push(`brightness(${Math.max(0.1, Math.min(3, brightness))})`)
  }

  // Contrast with highlight/shadow interaction
  let effectiveContrast = adjustments.contrast
  
  // Highlights reduce contrast (soften highlights)
  if (adjustments.highlights < 0) {
    effectiveContrast += Math.abs(adjustments.highlights) * 0.2
  } else if (adjustments.highlights > 0) {
    effectiveContrast -= adjustments.highlights * 0.15
  }
  
  // Shadows affect contrast (lifting shadows reduces contrast)
  if (adjustments.shadows > 0) {
    effectiveContrast -= adjustments.shadows * 0.1
  }

  if (effectiveContrast !== 0) {
    const contrast = 1 + (effectiveContrast / 100)
    filters.push(`contrast(${Math.max(0.1, Math.min(3, contrast))})`)
  }

  // Enhanced saturation with vibrance
  let effectiveSaturation = adjustments.saturation
  
  // Vibrance: selective saturation boost (more subtle than saturation)
  if (adjustments.vibrance !== 0) {
    // Vibrance affects less-saturated colors more than already-saturated ones
    effectiveSaturation += adjustments.vibrance * 0.6
  }

  if (effectiveSaturation !== 0) {
    const saturation = 1 + (effectiveSaturation / 100)
    filters.push(`saturate(${Math.max(0, Math.min(3, saturation))})`)
  }
  
  // Additional filters for more advanced adjustments
  
  // Simulate highlight recovery with reduced exposure on bright areas
  if (adjustments.highlights < -20) {
    const exposureReduction = Math.abs(adjustments.highlights + 20) / 100
    filters.push(`drop-shadow(0 0 0 rgba(255,255,255,${exposureReduction * 0.1}))`)
  }
  
  // Add subtle hue rotation for vibrance effect
  if (Math.abs(adjustments.vibrance) > 10) {
    const hueShift = (adjustments.vibrance / 100) * 5 // Small hue shift for vibrance
    filters.push(`hue-rotate(${hueShift}deg)`)
  }

  return filters.length > 0 ? filters.join(' ') : 'none'
}

export function getDefaultAdjustments(): ImageAdjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    highlights: 0,
    shadows: 0,
    vibrance: 0
  }
}

export function resetAdjustments(): ImageAdjustments {
  return getDefaultAdjustments()
}

// Advanced adjustments using CSS filters + blend modes
export function advancedAdjustmentsToCSSFilter(adjustments: ImageAdjustments): {
  filter: string
  mixBlendMode?: string
  opacity?: number
} {
  const basicFilter = adjustmentsToCSSFilter(adjustments)
  
  // For highlights/shadows/vibrance, we'll use a combination approach
  const result = {
    filter: basicFilter,
    mixBlendMode: undefined as string | undefined,
    opacity: undefined as number | undefined
  }

  // Basic implementation - can be enhanced with more complex blend modes
  if (adjustments.highlights !== 0 || adjustments.shadows !== 0) {
    // This would require more complex implementation with overlay elements
    // For now, we'll map to brightness/contrast adjustments
    const highlightAdjustment = adjustments.highlights * 0.3
    const shadowAdjustment = adjustments.shadows * 0.3
    
    const combinedBrightness = 1 + ((adjustments.brightness + highlightAdjustment + shadowAdjustment) / 100)
    result.filter = result.filter.replace(/brightness\([^)]+\)/, `brightness(${Math.max(0, combinedBrightness)})`)
  }

  return result
}