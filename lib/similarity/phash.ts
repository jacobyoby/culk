export async function calculatePHash(imageData: ImageData): Promise<string> {
  const { data, width, height } = imageData
  
  // Convert to grayscale and resize to 32x32
  const resized = resizeImage(data, width, height, 32, 32)
  const grayscale = toGrayscale(resized)
  
  // Apply DCT (Discrete Cosine Transform)
  const dctData = dct2d(grayscale, 32, 32)
  
  // Extract top-left 8x8 corner (excluding DC component)
  const hash = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (x === 0 && y === 0) continue // Skip DC component
      hash.push(dctData[y * 32 + x])
    }
  }
  
  // Calculate median (avoid spreading potentially large arrays)
  const sortedHash = hash.slice().sort((a, b) => a - b)
  const median = sortedHash[Math.floor(sortedHash.length / 2)]
  
  // Generate binary hash
  let binaryHash = ''
  for (const value of hash) {
    binaryHash += value > median ? '1' : '0'
  }
  
  // Convert to hexadecimal
  return binaryToHex(binaryHash)
}

export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be of equal length')
  }
  
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++
    }
  }
  return distance
}

export function areSimilar(hash1: string, hash2: string, threshold: number = 15): boolean {
  const distance = hammingDistance(hash1, hash2)
  return distance <= threshold
}

function resizeImage(
  data: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(dstWidth * dstHeight * 4)
  const xRatio = srcWidth / dstWidth
  const yRatio = srcHeight / dstHeight
  
  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * xRatio)
      const srcY = Math.floor(y * yRatio)
      const srcIndex = (srcY * srcWidth + srcX) * 4
      const dstIndex = (y * dstWidth + x) * 4
      
      result[dstIndex] = data[srcIndex]     // R
      result[dstIndex + 1] = data[srcIndex + 1] // G
      result[dstIndex + 2] = data[srcIndex + 2] // B
      result[dstIndex + 3] = data[srcIndex + 3] // A
    }
  }
  
  return result
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

function dct2d(data: number[], width: number, height: number): number[] {
  const result = new Array(width * height).fill(0)
  
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      let sum = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = data[y * width + x]
          const cosU = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * width))
          const cosV = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * height))
          sum += pixel * cosU * cosV
        }
      }
      
      let cu = u === 0 ? 1 / Math.sqrt(2) : 1
      let cv = v === 0 ? 1 / Math.sqrt(2) : 1
      
      result[v * width + u] = (2 / Math.sqrt(width * height)) * cu * cv * sum
    }
  }
  
  return result
}

function binaryToHex(binary: string): string {
  let hex = ''
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.substr(i, 4).padEnd(4, '0')
    hex += parseInt(chunk, 2).toString(16)
  }
  return hex
}

export async function calculatePHashFromFile(file: File): Promise<string> {
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
      calculatePHash(imageData)
        .then(resolve)
        .catch(reject)
      
      URL.revokeObjectURL(img.src)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}