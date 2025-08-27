/**
 * Shared canvas utilities to reduce code duplication across image processing operations
 */

export interface CanvasConfig {
  willReadFrequently?: boolean
  alpha?: boolean
  desynchronized?: boolean
}

/**
 * Create a canvas from an image with proper error handling and cleanup
 */
export async function createCanvasFromImage(
  imageSrc: string | HTMLImageElement,
  config: CanvasConfig = {}
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; cleanup: () => void }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', {
    willReadFrequently: config.willReadFrequently ?? false,
    alpha: config.alpha ?? true,
    desynchronized: config.desynchronized ?? false
  })
  
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }
  
  let img: HTMLImageElement
  let shouldCleanupImg = false
  
  if (typeof imageSrc === 'string') {
    img = new Image()
    shouldCleanupImg = true
    
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        img.onload = null
        img.onerror = null
      }
      
      img.onload = () => {
        cleanup()
        resolve()
      }
      
      img.onerror = () => {
        cleanup()
        reject(new Error('Failed to load image'))
      }
      
      img.src = imageSrc
    })
  } else {
    img = imageSrc
  }
  
  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)
  
  const cleanup = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    canvas.width = 0
    canvas.height = 0
    
    if (shouldCleanupImg && img.src.startsWith('blob:')) {
      img.onload = null
      img.onerror = null
      URL.revokeObjectURL(img.src)
    }
  }
  
  return { canvas, ctx, cleanup }
}

/**
 * Create a canvas from a File/Blob with proper error handling
 */
export async function createCanvasFromFile(
  file: File | Blob,
  config: CanvasConfig = {}
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; cleanup: () => void }> {
  const url = URL.createObjectURL(file)
  
  try {
    const result = await createCanvasFromImage(url, config)
    
    // Override cleanup to also revoke the object URL
    const originalCleanup = result.cleanup
    result.cleanup = () => {
      originalCleanup()
      URL.revokeObjectURL(url)
    }
    
    return result
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/**
 * Sample a canvas to a smaller size for performance
 */
export function sampleCanvas(
  sourceCanvas: HTMLCanvasElement,
  maxDimension: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number } {
  const scale = Math.min(1, maxDimension / Math.max(sourceCanvas.width, sourceCanvas.height))
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }
  
  const newWidth = Math.floor(sourceCanvas.width * scale)
  const newHeight = Math.floor(sourceCanvas.height * scale)
  
  canvas.width = newWidth
  canvas.height = newHeight
  
  ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight)
  
  return { canvas, ctx, scale }
}

/**
 * Convert canvas to blob with error handling
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      },
      type,
      quality
    )
  })
}

/**
 * Convert canvas to data URL with error handling
 */
export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.9
): string {
  try {
    return canvas.toDataURL(type, quality)
  } catch (error) {
    throw new Error(`Failed to create data URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Load image element with promise and cleanup
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    const cleanup = () => {
      img.onload = null
      img.onerror = null
    }
    
    img.onload = () => {
      cleanup()
      resolve(img)
    }
    
    img.onerror = () => {
      cleanup()
      reject(new Error('Failed to load image'))
    }
    
    img.src = src
  })
}

/**
 * Safely revoke object URLs with existence check
 */
export function safeRevokeObjectURL(url: string | null | undefined) {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch (error) {
      console.warn('Failed to revoke object URL:', error)
    }
  }
}

/**
 * Create a download link for a blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Get image data from canvas with error handling
 */
export function getImageData(
  canvas: HTMLCanvasElement,
  x: number = 0,
  y: number = 0,
  width?: number,
  height?: number
): ImageData {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }
  
  try {
    return ctx.getImageData(
      x, 
      y, 
      width ?? canvas.width, 
      height ?? canvas.height
    )
  } catch (error) {
    throw new Error(`Failed to get image data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}