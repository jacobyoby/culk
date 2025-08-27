import { FaceDetection } from '../types'
import { nanoid } from 'nanoid'
import { BlazeFaceDetector } from './blazeface-detector'

export interface FaceDetectionWorkerOptions {
  confidenceThreshold?: number
  includeEyeState?: boolean
  calculateFocusScore?: boolean
}

export interface FaceDetectionWorkerResult {
  faces: FaceDetection[]
  processingTime: number
  detectorUsed: 'onnx' | 'fallback'
  eyeDetectionAvailable: boolean
}

interface WorkerMessage {
  id: string
  type: 'initialize' | 'detect_faces' | 'update_settings' | 'dispose'
  payload: any
}

interface WorkerResponse {
  id: string
  success: boolean
  result?: any
  error?: string
}

export class FaceDetectionWorkerManager {
  private worker: Worker | null = null
  private blazeFaceDetector: BlazeFaceDetector | null = null
  private pendingRequests = new Map<string, {
    resolve: (result: any) => void
    reject: (error: Error) => void
  }>()
  private isInitialized = false

  async initialize(options: { faceConfidenceThreshold?: number } = {}): Promise<void> {
    if (this.isInitialized) return

    try {
      // Initialize BlazeFace detector first
      this.blazeFaceDetector = new BlazeFaceDetector()
      
      try {
        await this.blazeFaceDetector.initialize()
        console.log('BlazeFace detector initialized successfully')
      } catch (error) {
        console.warn('BlazeFace initialization failed, will use fallback:', error)
        this.blazeFaceDetector = null
      }

      // Initialize worker as backup
      this.worker = new Worker('/workers/face-detection-worker.js')
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)

      // Initialize the worker
      await this.sendWorkerMessage('initialize', {
        options: {
          faceConfidenceThreshold: options.faceConfidenceThreshold || 0.7
        }
      })

      this.isInitialized = true
      console.log('Face detection worker manager initialized')
    } catch (error) {
      console.error('Failed to initialize face detection worker:', error)
      throw new Error(`Face detection worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async detectFaces(
    imageData: ImageData,
    options: FaceDetectionWorkerOptions = {}
  ): Promise<FaceDetectionWorkerResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = performance.now()

    // Try BlazeFace detector first if available
    if (this.blazeFaceDetector && this.blazeFaceDetector.isAvailable()) {
      try {
        const faces = await this.blazeFaceDetector.detectFaces(imageData, {
          confidenceThreshold: options.confidenceThreshold || 0.7,
          maxFaces: 10
        })

        console.log(`BlazeFace detected ${faces.length} faces in ${(performance.now() - startTime).toFixed(2)}ms`)

        return {
          faces,
          processingTime: performance.now() - startTime,
          detectorUsed: 'onnx',
          eyeDetectionAvailable: false // BlazeFace doesn't provide eye state
        }
      } catch (error) {
        console.warn('BlazeFace detection failed, falling back to worker:', error)
      }
    }

    // Fallback to worker-based detection
    try {
      const result = await this.sendWorkerMessage('detect_faces', {
        imageData,
        options
      })

      return result as FaceDetectionWorkerResult
    } catch (error) {
      // Final fallback to synchronous detection
      console.warn('Worker face detection failed, using heuristic fallback:', error)
      return this.fallbackFaceDetection(imageData)
    }
  }

  private async fallbackFaceDetection(imageData: ImageData): Promise<FaceDetectionWorkerResult> {
    const startTime = performance.now()
    
    // Simple synchronous skin tone detection
    const faces = this.detectFacesBySkinTone(imageData)
    
    return {
      faces,
      processingTime: performance.now() - startTime,
      detectorUsed: 'fallback',
      eyeDetectionAvailable: false
    }
  }

  private detectFacesBySkinTone(imageData: ImageData): FaceDetection[] {
    const { width, height, data } = imageData
    const skinPixels: Array<{ x: number; y: number }> = []

    // Find skin-tone pixels using improved algorithm
    for (let y = 0; y < height; y += 1) { // Check every pixel for better accuracy
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        if (this.isSkinToneMultiSpace(r, g, b)) {
          skinPixels.push({ x, y })
        }
      }
    }

    console.log(`Found ${skinPixels.length} skin pixels in ${width}x${height} image`)
    
    // Adjust minimum based on image size
    const imageArea = width * height
    const minSkinPixels = Math.max(50, Math.floor(imageArea * 0.005)) // At least 0.5% of image
    
    console.log(`Need at least ${minSkinPixels} skin pixels (0.5% of ${imageArea} pixels)`)
    
    if (skinPixels.length < minSkinPixels) {
      console.log(`Not enough skin pixels for face detection (found ${skinPixels.length}, need ${minSkinPixels})`)
      return []
    }

    // Simple clustering - just create one face region from all skin pixels
    const xs = skinPixels.map(p => p.x)
    const ys = skinPixels.map(p => p.y)
    
    // Avoid spreading large arrays to prevent stack overflow
    let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0]
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i]
      if (xs[i] > maxX) maxX = xs[i]
    }
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] < minY) minY = ys[i]
      if (ys[i] > maxY) maxY = ys[i]
    }
    
    // Add padding
    const padding = 0.1
    const faceWidth = maxX - minX
    const faceHeight = maxY - minY
    
    // More restrictive size validation (relaxed)
    const minSize = Math.min(width, height) * 0.03 // At least 3% of image dimension (relaxed)
    const maxSize = Math.min(width, height) * 0.8  // At most 80% of image dimension
    
    if (faceWidth < minSize || faceHeight < minSize || 
        faceWidth > maxSize || faceHeight > maxSize) {
      console.log(`Rejecting face: ${faceWidth}x${faceHeight}, limits: ${minSize.toFixed(1)}-${maxSize.toFixed(1)}`)
      return [] // Invalid size for a face
    }
    
    // Check aspect ratio (more flexible)
    const aspectRatio = faceWidth / faceHeight
    if (aspectRatio < 0.3 || aspectRatio > 3.0) {
      console.log(`Rejecting face with bad aspect ratio: ${aspectRatio.toFixed(2)}`)
      return [] // Not face-like proportions
    }
    
    const paddedMinX = Math.max(0, minX - faceWidth * padding)
    const paddedMinY = Math.max(0, minY - faceHeight * padding)
    const paddedMaxX = Math.min(width, maxX + faceWidth * padding)
    const paddedMaxY = Math.min(height, maxY + faceHeight * padding)

    const finalWidth = ((paddedMaxX - paddedMinX) / width) * 100
    const finalHeight = ((paddedMaxY - paddedMinY) / height) * 100
    const areaRatio = (finalWidth * finalHeight) / (100 * 100)
    
    // Final area check - reject if too large (more lenient)
    if (areaRatio > 0.9) {
      console.log(`Rejecting face with area ratio: ${areaRatio.toFixed(3)}`)
      return []
    }

    return [{
      id: `face-fallback-${Date.now()}`,
      bbox: {
        x: (paddedMinX / width) * 100,
        y: (paddedMinY / height) * 100,
        width: finalWidth,
        height: finalHeight
      },
      confidence: Math.min(0.7, skinPixels.length / 500),
      eyeState: { left: 'unknown', right: 'unknown' },
      focusScore: 0
    }]
  }

  // RGB to YCbCr conversion
  private rgbToYCbCr(r: number, g: number, b: number): { Y: number; Cb: number; Cr: number } {
    const Y = 0.299 * r + 0.587 * g + 0.114 * b
    const Cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128
    const Cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128
    return { Y, Cb, Cr }
  }

  // Research-based skin detection using multiple color spaces
  private isSkinToneMultiSpace(r: number, g: number, b: number): boolean {
    // Quick rejection of obviously non-skin colors
    if (r < 40 || g < 25 || b < 15) return false
    if (r > 250 && g > 250 && b > 250) return false // Too white
    if (Math.max(r, g, b) < 60) return false // Too dark
    
    // YCbCr-based skin detection (research proven)
    const { Y, Cb, Cr } = this.rgbToYCbCr(r, g, b)
    
    // Adaptive YCbCr ranges based on research
    const ycbcrSkin = (
      Y >= 50 && Y <= 235 &&
      Cb >= 85 && Cb <= 135 &&
      Cr >= 135 && Cr <= 180
    )
    
    // Alternative YCbCr range for different skin tones
    const ycbcrSkin2 = (
      Y >= 60 && Y <= 230 &&
      Cb >= 77 && Cb <= 127 &&
      Cr >= 133 && Cr <= 173
    )
    
    // HSV-based validation
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const diff = max - min
    
    if (diff === 0) return false
    
    const saturation = diff / max
    const value = max / 255
    
    let hue = 0
    if (max === r) {
      hue = ((g - b) / diff) % 6
    } else if (max === g) {
      hue = (b - r) / diff + 2
    } else {
      hue = (r - g) / diff + 4
    }
    hue = (hue * 60 + 360) % 360
    
    const hsvSkin = (
      (hue >= 0 && hue <= 25) || (hue >= 335 && hue <= 360)
    ) && saturation >= 0.2 && saturation <= 0.7 && value >= 0.3 && value <= 0.95
    
    // RGB-based conditions (from research)
    const rgbSkin1 = (
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.abs(r - g) > 15 &&
      (r - b) > 15
    )
    
    // Lighter skin tones
    const rgbSkin2 = (
      r > 200 && g > 210 && b > 170 &&
      Math.abs(r - g) < 15 &&
      r > b && g > b
    )
    
    // Final decision: must pass YCbCr AND (HSV OR RGB)
    return (ycbcrSkin || ycbcrSkin2) && (hsvSkin || rgbSkin1 || rgbSkin2)
  }

  // Legacy function for backward compatibility
  private isSkinTone(r: number, g: number, b: number): boolean {
    return this.isSkinToneMultiSpace(r, g, b)
  }

  async updateSettings(settings: {
    faceConfidenceThreshold?: number
    eyeConfidenceThreshold?: number
  }): Promise<void> {
    if (!this.isInitialized) return

    await this.sendWorkerMessage('update_settings', { settings })
  }

  private async sendWorkerMessage(type: 'initialize' | 'detect_faces' | 'update_settings' | 'dispose', payload: any): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized')
    }

    return new Promise<any>((resolve, reject) => {
      const id = nanoid()
      
      this.pendingRequests.set(id, { resolve, reject })

      const message: WorkerMessage = { id, type, payload }
      
      // Clone ImageData for transfer to worker
      if (payload.imageData) {
        const imageData = payload.imageData
        const clonedData = new Uint8ClampedArray(imageData.data)
        const clonedImageData = new ImageData(clonedData, imageData.width, imageData.height)
        
        this.worker!.postMessage({
          ...message,
          payload: {
            ...payload,
            imageData: clonedImageData
          }
        })
      } else {
        this.worker!.postMessage(message)
      }
    })
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, success, result, error } = event.data
    const pending = this.pendingRequests.get(id)
    
    if (!pending) {
      console.warn('Received response for unknown request:', id)
      return
    }

    this.pendingRequests.delete(id)

    if (success && result !== undefined) {
      pending.resolve(result)
    } else {
      pending.reject(new Error(error || 'Face detection failed'))
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Face detection worker error:', error)
    
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Face detection worker encountered an error'))
    })
    
    this.pendingRequests.clear()
  }

  async dispose(): Promise<void> {
    // Dispose BlazeFace detector
    if (this.blazeFaceDetector) {
      try {
        await this.blazeFaceDetector.dispose()
      } catch (error) {
        console.warn('Error disposing BlazeFace detector:', error)
      }
      this.blazeFaceDetector = null
    }

    // Dispose worker
    if (this.worker) {
      try {
        await this.sendWorkerMessage('dispose', {})
      } catch (error) {
        console.warn('Error disposing worker:', error)
      }
      
      this.worker.terminate()
      this.worker = null
    }
    
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Face detection worker disposed'))
    })
    
    this.pendingRequests.clear()
    this.isInitialized = false
  }

  isAvailable(): boolean {
    return this.isInitialized && this.worker !== null
  }
}

// Singleton instance
export const faceDetectionWorkerManager = new FaceDetectionWorkerManager()