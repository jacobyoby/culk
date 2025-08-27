export interface SSIMResult {
  ssim: number
  mssim: number
}

export function calculateSSIM(
  img1Data: ImageData,
  img2Data: ImageData,
  windowSize: number = 11
): SSIMResult {
  if (img1Data.width !== img2Data.width || img1Data.height !== img2Data.height) {
    throw new Error('Images must have the same dimensions')
  }
  
  const width = img1Data.width
  const height = img1Data.height
  
  // Convert to grayscale
  const gray1 = toGrayscale(img1Data.data)
  const gray2 = toGrayscale(img2Data.data)
  
  // Calculate SSIM using sliding window
  const ssimValues = []
  const halfWindow = Math.floor(windowSize / 2)
  
  for (let y = halfWindow; y < height - halfWindow; y++) {
    for (let x = halfWindow; x < width - halfWindow; x++) {
      const window1 = extractWindow(gray1, width, x, y, windowSize)
      const window2 = extractWindow(gray2, width, x, y, windowSize)
      
      const ssim = calculateSSIMWindow(window1, window2)
      ssimValues.push(ssim)
    }
  }
  
  // Calculate mean SSIM
  const mssim = ssimValues.reduce((sum, val) => sum + val, 0) / ssimValues.length
  
  return {
    ssim: mssim,
    mssim
  }
}

function calculateSSIMWindow(window1: number[], window2: number[]): number {
  const N = window1.length
  
  // Calculate means
  const mu1 = window1.reduce((sum, val) => sum + val, 0) / N
  const mu2 = window2.reduce((sum, val) => sum + val, 0) / N
  
  // Calculate variances and covariance
  let sigma1Sq = 0
  let sigma2Sq = 0
  let sigma12 = 0
  
  for (let i = 0; i < N; i++) {
    const diff1 = window1[i] - mu1
    const diff2 = window2[i] - mu2
    
    sigma1Sq += diff1 * diff1
    sigma2Sq += diff2 * diff2
    sigma12 += diff1 * diff2
  }
  
  sigma1Sq /= (N - 1)
  sigma2Sq /= (N - 1)
  sigma12 /= (N - 1)
  
  // SSIM constants (for 8-bit images)
  const C1 = (0.01 * 255) ** 2
  const C2 = (0.03 * 255) ** 2
  
  // Calculate SSIM
  const numerator = (2 * mu1 * mu2 + C1) * (2 * sigma12 + C2)
  const denominator = (mu1 * mu1 + mu2 * mu2 + C1) * (sigma1Sq + sigma2Sq + C2)
  
  return numerator / denominator
}

function extractWindow(
  data: number[],
  width: number,
  centerX: number,
  centerY: number,
  windowSize: number
): number[] {
  const window = []
  const halfWindow = Math.floor(windowSize / 2)
  
  for (let dy = -halfWindow; dy <= halfWindow; dy++) {
    for (let dx = -halfWindow; dx <= halfWindow; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      const index = y * width + x
      window.push(data[index])
    }
  }
  
  return window
}

function toGrayscale(data: Uint8ClampedArray): number[] {
  const result = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    result.push(gray)
  }
  return result
}

export async function calculateSSIMFromFiles(file1: File, file2: File): Promise<SSIMResult> {
  const [img1Data, img2Data] = await Promise.all([
    loadImageData(file1),
    loadImageData(file2)
  ])
  
  return calculateSSIM(img1Data, img2Data)
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

export function isSimilarBySSIM(ssim: number, threshold: number = 0.8): boolean {
  return ssim >= threshold
}