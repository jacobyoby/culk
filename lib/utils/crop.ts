export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface AutoCropResult {
  region: CropRegion
  confidence: number
  method: 'edge-detection' | 'content-aware' | 'golden-ratio' | 'center'
}

export function detectAutoCropRegion(
  imageData: ImageData,
  options: {
    method?: 'edge-detection' | 'content-aware' | 'golden-ratio' | 'center'
    padding?: number
    minCropRatio?: number
  } = {}
): AutoCropResult {
  const {
    method = 'edge-detection',
    padding = 0.05,
    minCropRatio = 0.7
  } = options
  
  const { width, height } = imageData
  
  switch (method) {
    case 'edge-detection':
      return detectEdgeBasedCrop(imageData, padding, minCropRatio)
    case 'content-aware':
      return detectContentAwareCrop(imageData, padding, minCropRatio)
    case 'golden-ratio':
      return detectGoldenRatioCrop(imageData, padding)
    case 'center':
      return detectCenterCrop(imageData, padding)
    default:
      return detectEdgeBasedCrop(imageData, padding, minCropRatio)
  }
}

function detectEdgeBasedCrop(
  imageData: ImageData,
  padding: number,
  minCropRatio: number
): AutoCropResult {
  const { data, width, height } = imageData
  
  // Convert to grayscale and apply edge detection
  const grayscale = toGrayscale(data)
  const edges = applySobelOperator(grayscale, width, height)
  
  // Find content bounds by analyzing edge density
  const bounds = findContentBounds(edges, width, height, minCropRatio)
  
  // Apply padding
  const paddingX = Math.floor(width * padding)
  const paddingY = Math.floor(height * padding)
  
  const cropRegion: CropRegion = {
    x: Math.max(0, bounds.left - paddingX),
    y: Math.max(0, bounds.top - paddingY),
    width: Math.min(width, bounds.right + paddingX) - Math.max(0, bounds.left - paddingX),
    height: Math.min(height, bounds.bottom + paddingY) - Math.max(0, bounds.top - paddingY)
  }
  
  // Calculate confidence based on how much we're cropping
  const cropRatio = (cropRegion.width * cropRegion.height) / (width * height)
  const confidence = Math.max(0, Math.min(1, (1 - cropRatio) * 2)) // Higher confidence for more aggressive crops
  
  return {
    region: cropRegion,
    confidence,
    method: 'edge-detection'
  }
}

function detectContentAwareCrop(
  imageData: ImageData,
  padding: number,
  minCropRatio: number
): AutoCropResult {
  const { data, width, height } = imageData
  
  // Multi-factor content analysis
  const edgeMap = calculateEdgeMap(data, width, height)
  const colorMap = calculateColorVarianceMap(data, width, height)
  const saliencyMap = calculateSaliencyMap(data, width, height)
  const faceHeuristics = detectFaceRegions(data, width, height)
  
  // Combine maps with weights
  const combinedMap = combineContentMaps(
    { edgeMap, colorMap, saliencyMap, faceHeuristics },
    width,
    height
  )
  
  // Find the region with highest combined interest
  const bounds = findContentBounds(combinedMap, width, height, minCropRatio)
  
  const paddingX = Math.floor(width * padding)
  const paddingY = Math.floor(height * padding)
  
  const cropRegion: CropRegion = {
    x: Math.max(0, bounds.left - paddingX),
    y: Math.max(0, bounds.top - paddingY),
    width: Math.min(width, bounds.right + paddingX) - Math.max(0, bounds.left - paddingX),
    height: Math.min(height, bounds.bottom + paddingY) - Math.max(0, bounds.top - paddingY)
  }
  
  // Calculate confidence based on content distribution
  const contentDensity = calculateContentDensity(combinedMap, bounds, width, height)
  const aspectRatioScore = calculateAspectRatioScore(cropRegion.width, cropRegion.height)
  const confidence = Math.min(0.95, contentDensity * 0.7 + aspectRatioScore * 0.3)
  
  return {
    region: cropRegion,
    confidence,
    method: 'content-aware'
  }
}

function detectGoldenRatioCrop(
  imageData: ImageData,
  padding: number
): AutoCropResult {
  const { width, height } = imageData
  const goldenRatio = 1.618
  
  let cropWidth: number
  let cropHeight: number
  
  if (width / height > goldenRatio) {
    // Image is wider than golden ratio - crop width
    cropHeight = height
    cropWidth = Math.floor(cropHeight * goldenRatio)
  } else {
    // Image is taller than golden ratio - crop height  
    cropWidth = width
    cropHeight = Math.floor(cropWidth / goldenRatio)
  }
  
  const cropRegion: CropRegion = {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight
  }
  
  return {
    region: cropRegion,
    confidence: 0.7, // Golden ratio is aesthetically pleasing but not content-aware
    method: 'golden-ratio'
  }
}

function detectCenterCrop(
  imageData: ImageData,
  padding: number
): AutoCropResult {
  const { width, height } = imageData
  
  // Simple center crop to square or 16:9 ratio
  const targetRatio = 16 / 9
  let cropWidth: number
  let cropHeight: number
  
  if (width / height > targetRatio) {
    cropHeight = height
    cropWidth = Math.floor(cropHeight * targetRatio)
  } else {
    cropWidth = width
    cropHeight = Math.floor(cropWidth / targetRatio)
  }
  
  const cropRegion: CropRegion = {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight
  }
  
  return {
    region: cropRegion,
    confidence: 0.5, // Center crop is safe but not intelligent
    method: 'center'
  }
}

function toGrayscale(data: Uint8ClampedArray): number[] {
  const grayscale = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    grayscale.push(gray)
  }
  return grayscale
}

function applySobelOperator(data: number[], width: number, height: number): number[] {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  const edges = new Array(width * height).fill(0)
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIndex = (y + ky) * width + (x + kx)
          const kernelIndex = (ky + 1) * 3 + (kx + 1)
          
          gx += data[pixelIndex] * sobelX[kernelIndex]
          gy += data[pixelIndex] * sobelY[kernelIndex]
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy)
      edges[y * width + x] = magnitude
    }
  }
  
  return edges
}

function findContentBounds(
  edges: number[],
  width: number,
  height: number,
  minCropRatio: number
): { left: number; right: number; top: number; bottom: number } {
  const threshold = calculateEdgeThreshold(edges)
  
  let left = width, right = 0, top = height, bottom = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] > threshold) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  }
  
  // Ensure minimum crop ratio
  const cropWidth = right - left
  const cropHeight = bottom - top
  const cropRatio = (cropWidth * cropHeight) / (width * height)
  
  if (cropRatio < minCropRatio) {
    // Expand bounds to meet minimum ratio
    const centerX = Math.floor((left + right) / 2)
    const centerY = Math.floor((top + bottom) / 2)
    const targetArea = width * height * minCropRatio
    const targetWidth = Math.sqrt(targetArea * (cropWidth / cropHeight))
    const targetHeight = targetArea / targetWidth
    
    left = Math.max(0, Math.floor(centerX - targetWidth / 2))
    right = Math.min(width, Math.floor(centerX + targetWidth / 2))
    top = Math.max(0, Math.floor(centerY - targetHeight / 2))
    bottom = Math.min(height, Math.floor(centerY + targetHeight / 2))
  }
  
  return { left, right, top, bottom }
}

function calculateEdgeThreshold(edges: number[]): number {
  const sortedEdges = [...edges].sort((a, b) => a - b)
  const percentile95 = sortedEdges[Math.floor(sortedEdges.length * 0.95)]
  return percentile95 * 0.3 // 30% of 95th percentile
}

function calculateInterestMap(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number[] {
  const interestMap = new Array(width * height).fill(0)
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4
      
      // Calculate local variance (measure of detail)
      let variance = 0
      let mean = 0
      const windowSize = 3
      let count = 0
      
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIndex = (ny * width + nx) * 4
            const gray = 0.299 * data[nIndex] + 0.587 * data[nIndex + 1] + 0.114 * data[nIndex + 2]
            mean += gray
            count++
          }
        }
      }
      
      mean /= count
      
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIndex = (ny * width + nx) * 4
            const gray = 0.299 * data[nIndex] + 0.587 * data[nIndex + 1] + 0.114 * data[nIndex + 2]
            variance += Math.pow(gray - mean, 2)
          }
        }
      }
      
      variance /= count
      interestMap[y * width + x] = variance
    }
  }
  
  return interestMap
}

function findInterestBounds(
  interestMap: number[],
  width: number,
  height: number,
  minCropRatio: number
): { left: number; right: number; top: number; bottom: number } {
  const threshold = calculateInterestThreshold(interestMap)
  
  let left = width, right = 0, top = height, bottom = 0
  let hasContent = false
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (interestMap[y * width + x] > threshold) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
        hasContent = true
      }
    }
  }
  
  if (!hasContent) {
    // Fallback to center crop
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)
    const size = Math.min(width, height) * 0.8
    
    left = Math.floor(centerX - size / 2)
    right = Math.floor(centerX + size / 2)
    top = Math.floor(centerY - size / 2)
    bottom = Math.floor(centerY + size / 2)
  }
  
  return { left, right, top, bottom }
}

function calculateInterestThreshold(interestMap: number[]): number {
  const sortedInterest = [...interestMap].sort((a, b) => a - b)
  const percentile80 = sortedInterest[Math.floor(sortedInterest.length * 0.8)]
  return percentile80 * 0.5
}

// Enhanced content-aware functions
function calculateEdgeMap(data: Uint8ClampedArray, width: number, height: number): number[] {
  const grayscale = toGrayscale(data)
  return applySobelOperator(grayscale, width, height)
}

function calculateColorVarianceMap(data: Uint8ClampedArray, width: number, height: number): number[] {
  const varianceMap = new Array(width * height).fill(0)
  const windowSize = 5
  
  for (let y = windowSize; y < height - windowSize; y++) {
    for (let x = windowSize; x < width - windowSize; x++) {
      let rVariance = 0, gVariance = 0, bVariance = 0
      let rMean = 0, gMean = 0, bMean = 0
      let count = 0
      
      // Calculate mean
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4
          rMean += data[idx]
          gMean += data[idx + 1]
          bMean += data[idx + 2]
          count++
        }
      }
      rMean /= count
      gMean /= count
      bMean /= count
      
      // Calculate variance
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4
          rVariance += Math.pow(data[idx] - rMean, 2)
          gVariance += Math.pow(data[idx + 1] - gMean, 2)
          bVariance += Math.pow(data[idx + 2] - bMean, 2)
        }
      }
      
      const totalVariance = (rVariance + gVariance + bVariance) / (count * 3)
      varianceMap[y * width + x] = totalVariance
    }
  }
  
  return varianceMap
}

function calculateSaliencyMap(data: Uint8ClampedArray, width: number, height: number): number[] {
  const grayscale = toGrayscale(data)
  const saliencyMap = new Array(width * height).fill(0)
  
  // Simple center bias + contrast enhancement
  const centerX = width / 2
  const centerY = height / 2
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      
      // Distance from center (inverse saliency - center is more salient)
      const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
      const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2))
      const centerBias = 1 - (distFromCenter / maxDist)
      
      // Local contrast
      let contrast = 0
      let count = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx
            contrast += Math.abs(grayscale[idx] - grayscale[nIdx])
            count++
          }
        }
      }
      contrast /= count
      
      // Combine center bias and contrast
      saliencyMap[idx] = centerBias * 0.3 + (contrast / 255) * 0.7
    }
  }
  
  return saliencyMap
}

function detectFaceRegions(data: Uint8ClampedArray, width: number, height: number): number[] {
  const faceMap = new Array(width * height).fill(0)
  
  // Simple skin tone detection as face heuristic
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    // Rough skin tone detection
    const isSkinTone = (
      r > 95 && g > 40 && b > 20 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
      Math.abs(r - g) > 15 && r > g && r > b
    )
    
    const pixelIdx = Math.floor(i / 4)
    if (isSkinTone) {
      // Apply gaussian-like influence around detected skin pixels
      const x = pixelIdx % width
      const y = Math.floor(pixelIdx / width)
      
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx
            const dist = Math.sqrt(dx * dx + dy * dy)
            const influence = Math.exp(-dist / 5) * 0.8
            faceMap[nIdx] = Math.max(faceMap[nIdx], influence)
          }
        }
      }
    }
  }
  
  return faceMap
}

function combineContentMaps(
  maps: {
    edgeMap: number[]
    colorMap: number[]
    saliencyMap: number[]
    faceHeuristics: number[]
  },
  width: number,
  height: number
): number[] {
  const combined = new Array(width * height).fill(0)
  const { edgeMap, colorMap, saliencyMap, faceHeuristics } = maps
  
  // Normalize each map to 0-1 range
  const normalizeMap = (map: number[]) => {
    const max = Math.max(...map)
    const min = Math.min(...map)
    const range = max - min
    return range > 0 ? map.map(v => (v - min) / range) : map
  }
  
  const normEdge = normalizeMap(edgeMap)
  const normColor = normalizeMap(colorMap)
  const normSaliency = normalizeMap(saliencyMap)
  const normFace = normalizeMap(faceHeuristics)
  
  // Weighted combination
  for (let i = 0; i < combined.length; i++) {
    combined[i] = (
      normEdge[i] * 0.25 +        // Edge detection
      normColor[i] * 0.20 +       // Color variance
      normSaliency[i] * 0.30 +    // Saliency (center bias + contrast)
      normFace[i] * 0.25          // Face heuristics
    )
  }
  
  return combined
}

function calculateContentDensity(
  contentMap: number[],
  bounds: { left: number; right: number; top: number; bottom: number },
  width: number,
  height: number
): number {
  let totalContent = 0
  let maxContent = 0
  let pixelCount = 0
  
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const value = contentMap[y * width + x]
      totalContent += value
      maxContent = Math.max(maxContent, value)
      pixelCount++
    }
  }
  
  const avgContent = totalContent / pixelCount
  
  // Compare to overall image average
  const overallAvg = contentMap.reduce((sum, val) => sum + val, 0) / contentMap.length
  
  return Math.min(1, avgContent / Math.max(0.1, overallAvg))
}

function calculateAspectRatioScore(width: number, height: number): number {
  const ratio = width / height
  const idealRatios = [1.0, 1.618, 16/9, 4/3, 3/2] // Square, Golden, 16:9, 4:3, 3:2
  
  let bestScore = 0
  for (const ideal of idealRatios) {
    const score = 1 - Math.abs(ratio - ideal) / Math.max(ratio, ideal)
    bestScore = Math.max(bestScore, score)
  }
  
  return bestScore
}

export async function applyCrop(
  imageFile: File,
  cropRegion: CropRegion
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('applyCrop can only be used in browser environment')
  }
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }
    
    img.onload = () => {
      canvas.width = cropRegion.width
      canvas.height = cropRegion.height
      
      ctx.drawImage(
        img,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        0,
        0,
        cropRegion.width,
        cropRegion.height
      )
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create cropped image blob'))
          }
        },
        'image/jpeg',
        0.9
      )
      
      URL.revokeObjectURL(img.src)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(imageFile)
  })
}