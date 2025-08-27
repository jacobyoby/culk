export interface FocusAnalysis {
  focusScore: number
  blurScore: number
  sharpnessMap?: number[]
  isBlurry: boolean
}

export function analyzeImageFocus(imageData: ImageData, threshold: number = 100): FocusAnalysis {
  const { data, width, height } = imageData
  
  // Convert to grayscale
  const grayscale = toGrayscale(data)
  
  // Apply Laplacian operator for edge detection
  const laplacian = applyLaplacian(grayscale, width, height)
  
  // Calculate variance of Laplacian (higher = sharper)
  const variance = calculateVariance(laplacian)
  
  // Calculate focus score (0-1000+)
  const focusScore = variance
  const blurScore = Math.max(0, threshold - variance)
  const isBlurry = variance < threshold
  
  return {
    focusScore,
    blurScore,
    sharpnessMap: laplacian,
    isBlurry
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

function applyLaplacian(data: number[], width: number, height: number): number[] {
  const kernel = [
    0, -1,  0,
   -1,  4, -1,
    0, -1,  0
  ]
  
  const result = new Array(width * height).fill(0)
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIndex = (y + ky) * width + (x + kx)
          const kernelIndex = (ky + 1) * 3 + (kx + 1)
          sum += data[pixelIndex] * kernel[kernelIndex]
        }
      }
      
      result[y * width + x] = Math.abs(sum)
    }
  }
  
  return result
}

function calculateVariance(data: number[]): number {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
  return variance
}

export function analyzeRegionFocus(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): FocusAnalysis {
  // Extract region
  const regionData = extractRegion(imageData, x, y, width, height)
  return analyzeImageFocus(regionData)
}

function extractRegion(
  imageData: ImageData,
  x: number,
  y: number,
  regionWidth: number,
  regionHeight: number
): ImageData {
  const { width: imgWidth, height: imgHeight, data } = imageData
  
  // Clamp coordinates to image bounds
  const startX = Math.max(0, Math.min(x, imgWidth - 1))
  const startY = Math.max(0, Math.min(y, imgHeight - 1))
  const endX = Math.min(imgWidth, startX + regionWidth)
  const endY = Math.min(imgHeight, startY + regionHeight)
  
  const actualWidth = endX - startX
  const actualHeight = endY - startY
  
  const regionData = new Uint8ClampedArray(actualWidth * actualHeight * 4)
  
  for (let row = 0; row < actualHeight; row++) {
    for (let col = 0; col < actualWidth; col++) {
      const srcIndex = ((startY + row) * imgWidth + (startX + col)) * 4
      const dstIndex = (row * actualWidth + col) * 4
      
      regionData[dstIndex] = data[srcIndex]
      regionData[dstIndex + 1] = data[srcIndex + 1]
      regionData[dstIndex + 2] = data[srcIndex + 2]
      regionData[dstIndex + 3] = data[srcIndex + 3]
    }
  }
  
  return new ImageData(regionData, actualWidth, actualHeight)
}

export async function analyzeFocusFromFile(file: File): Promise<FocusAnalysis> {
  const imageData = await loadImageData(file)
  return analyzeImageFocus(imageData)
}

function loadImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      resolve(imageData)
      
      URL.revokeObjectURL(img.src)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

export function createSharpnessHeatmap(
  sharpnessMap: number[],
  width: number,
  height: number
): ImageData {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }
  
  canvas.width = width
  canvas.height = height
  
  const imageData = ctx.createImageData(width, height)
  const { data } = imageData
  
  // Find min/max for normalization
  const min = Math.min(...sharpnessMap)
  const max = Math.max(...sharpnessMap)
  const range = max - min
  
  for (let i = 0; i < sharpnessMap.length; i++) {
    const normalized = range > 0 ? (sharpnessMap[i] - min) / range : 0
    const intensity = Math.floor(normalized * 255)
    
    const pixelIndex = i * 4
    data[pixelIndex] = intensity     // R
    data[pixelIndex + 1] = 0         // G
    data[pixelIndex + 2] = 255 - intensity // B
    data[pixelIndex + 3] = 255       // A
  }
  
  return imageData
}