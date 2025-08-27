import { faceDetector, FaceDetector, DetectionResult } from './face-detector'
import { eyeDetector, EyeDetector } from './eye-detector'
import { FaceDetection } from '../types'
import { calculateLaplacianVariance } from '../quality/focus-detector'

export interface FaceDetectionOptions {
  confidenceThreshold?: number
  includeEyeState?: boolean
  calculateFocusScore?: boolean
}

export interface FaceAnalysisResult {
  faces: FaceDetection[]
  processingTime: number
  detectorUsed: 'onnx' | 'fallback'
  eyeDetectionAvailable: boolean
}

export class FaceDetectionManager {
  private faceDetector: FaceDetector
  private eyeDetector: EyeDetector
  private isInitializing = false

  constructor() {
    this.faceDetector = faceDetector
    this.eyeDetector = eyeDetector
  }

  async initialize(options: { faceConfidenceThreshold?: number } = {}): Promise<void> {
    if (this.isInitializing) {
      // Wait for existing initialization
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return
    }

    this.isInitializing = true

    try {
      // Update confidence threshold if provided
      if (options.faceConfidenceThreshold) {
        this.faceDetector.updateOptions({
          confidenceThreshold: options.faceConfidenceThreshold
        })
      }

      // Initialize face detector (required)
      await this.faceDetector.initialize()

      // Try to initialize eye detector (optional)
      try {
        await this.eyeDetector.initialize()
      } catch (error) {
        console.warn('Eye detector initialization failed, continuing without eye state detection:', error)
      }

      console.log('Face detection manager initialized successfully')
    } finally {
      this.isInitializing = false
    }
  }

  async detectFaces(
    imageData: ImageData,
    options: FaceDetectionOptions = {}
  ): Promise<FaceAnalysisResult> {
    const startTime = performance.now()

    // Ensure initialization
    if (!this.faceDetector.isAvailable()) {
      await this.initialize()
    }

    const {
      includeEyeState = true,
      calculateFocusScore = true
    } = options

    let detectionResult: DetectionResult
    let detectorUsed: 'onnx' | 'fallback' = 'onnx'

    try {
      // Try ONNX face detection first
      detectionResult = await this.faceDetector.detectFaces(imageData)
    } catch (error) {
      console.warn('ONNX face detection failed, using fallback:', error)
      // Fallback to simple heuristic detection
      detectionResult = await this.fallbackFaceDetection(imageData)
      detectorUsed = 'fallback'
    }

    let faces = detectionResult.faces

    // Add eye state detection if requested and available
    if (includeEyeState) {
      try {
        faces = await this.eyeDetector.analyzeEyeState(imageData, faces)
      } catch (error) {
        console.warn('Eye state detection failed:', error)
      }
    }

    // Calculate focus scores for faces if requested
    if (calculateFocusScore) {
      faces = faces.map(face => ({
        ...face,
        focusScore: this.calculateFaceFocusScore(imageData, face)
      }))
    }

    const processingTime = performance.now() - startTime

    return {
      faces,
      processingTime,
      detectorUsed,
      eyeDetectionAvailable: this.eyeDetector.isAvailable()
    }
  }

  private async fallbackFaceDetection(imageData: ImageData): Promise<DetectionResult> {
    const startTime = performance.now()
    
    // Simple skin tone based face detection
    const faces = this.detectFacesBySkinTone(imageData)
    
    return {
      faces,
      processingTime: performance.now() - startTime
    }
  }

  private detectFacesBySkinTone(imageData: ImageData): FaceDetection[] {
    const { width, height, data } = imageData
    const skinPixels: Array<{ x: number; y: number }> = []

    // Find skin-tone pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        if (this.isSkinTone(r, g, b)) {
          skinPixels.push({ x, y })
        }
      }
    }

    if (skinPixels.length < 100) {
      return [] // Not enough skin pixels for face detection
    }

    // Cluster skin pixels into face regions
    const faces = this.clusterSkinPixels(skinPixels, width, height)
    return faces
  }

  private isSkinTone(r: number, g: number, b: number): boolean {
    // Enhanced skin tone detection
    const conditions = [
      // Condition 1: Basic skin tone range
      r > 95 && g > 40 && b > 20 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
      Math.abs(r - g) > 15 && r > g && r > b,
      
      // Condition 2: Alternative skin tone range for different ethnicities
      r > 220 && g > 210 && b > 170 &&
      Math.abs(r - g) <= 15 && r >= g && g >= b,
      
      // Condition 3: Darker skin tones
      r > 50 && g > 30 && b > 15 &&
      r > g && g >= b && (r - b) > 10
    ]

    return conditions.some(condition => condition)
  }

  private clusterSkinPixels(
    skinPixels: Array<{ x: number; y: number }>,
    width: number,
    height: number
  ): FaceDetection[] {
    // Simple clustering by proximity
    const clusters: Array<Array<{ x: number; y: number }>> = []
    const visited = new Set<string>()
    const clusterRadius = Math.min(width, height) * 0.1 // 10% of image size

    for (const pixel of skinPixels) {
      const key = `${pixel.x},${pixel.y}`
      if (visited.has(key)) continue

      const cluster: Array<{ x: number; y: number }> = []
      const queue = [pixel]
      visited.add(key)

      while (queue.length > 0) {
        const current = queue.shift()!
        cluster.push(current)

        // Find nearby skin pixels
        for (const candidate of skinPixels) {
          const candidateKey = `${candidate.x},${candidate.y}`
          if (visited.has(candidateKey)) continue

          const distance = Math.sqrt(
            Math.pow(current.x - candidate.x, 2) + 
            Math.pow(current.y - candidate.y, 2)
          )

          if (distance <= clusterRadius) {
            queue.push(candidate)
            visited.add(candidateKey)
          }
        }
      }

      if (cluster.length > 50) { // Minimum cluster size for a face
        clusters.push(cluster)
      }
    }

    // Convert clusters to face bounding boxes
    return clusters.map((cluster, index) => {
      const xs = cluster.map(p => p.x)
      const ys = cluster.map(p => p.y)
      
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      
      // Add padding
      const padding = 0.1
      const faceWidth = maxX - minX
      const faceHeight = maxY - minY
      
      const paddedMinX = Math.max(0, minX - faceWidth * padding)
      const paddedMinY = Math.max(0, minY - faceHeight * padding)
      const paddedMaxX = Math.min(width, maxX + faceWidth * padding)
      const paddedMaxY = Math.min(height, maxY + faceHeight * padding)

      return {
        id: `face-fallback-${Date.now()}-${index}`,
        bbox: {
          x: (paddedMinX / width) * 100,
          y: (paddedMinY / height) * 100,
          width: ((paddedMaxX - paddedMinX) / width) * 100,
          height: ((paddedMaxY - paddedMinY) / height) * 100
        },
        confidence: Math.min(0.8, cluster.length / 200), // Confidence based on cluster size
        eyeState: undefined,
        focusScore: undefined
      }
    })
  }

  private calculateFaceFocusScore(imageData: ImageData, face: FaceDetection): number {
    const { width, height, data } = imageData
    const { x, y, width: faceWidth, height: faceHeight } = face.bbox
    
    // Convert percentages to pixels
    const faceX = Math.floor((x / 100) * width)
    const faceY = Math.floor((y / 100) * height)
    const faceW = Math.floor((faceWidth / 100) * width)
    const faceH = Math.floor((faceHeight / 100) * height)
    
    // Extract face region data
    const faceData = new Uint8ClampedArray(faceW * faceH * 4)
    
    for (let fy = 0; fy < faceH; fy++) {
      for (let fx = 0; fx < faceW; fx++) {
        const srcIdx = ((faceY + fy) * width + (faceX + fx)) * 4
        const destIdx = (fy * faceW + fx) * 4
        
        if (faceY + fy < height && faceX + fx < width && srcIdx < data.length) {
          faceData[destIdx] = data[srcIdx]
          faceData[destIdx + 1] = data[srcIdx + 1]
          faceData[destIdx + 2] = data[srcIdx + 2]
          faceData[destIdx + 3] = data[srcIdx + 3]
        }
      }
    }
    
    const faceImageData = new ImageData(faceData, faceW, faceH)
    return calculateLaplacianVariance(faceImageData)
  }

  updateSettings(settings: {
    faceConfidenceThreshold?: number
    eyeConfidenceThreshold?: number
  }): void {
    if (settings.faceConfidenceThreshold !== undefined) {
      this.faceDetector.updateOptions({
        confidenceThreshold: settings.faceConfidenceThreshold
      })
    }

    // Note: Eye detector options are set during initialization
    // To change eye confidence threshold, detector needs to be reinitialized
  }

  async dispose(): Promise<void> {
    await Promise.all([
      this.faceDetector.dispose(),
      this.eyeDetector.dispose()
    ])
  }

  getStatus(): {
    faceDetectionAvailable: boolean
    eyeDetectionAvailable: boolean
    isInitialized: boolean
  } {
    return {
      faceDetectionAvailable: this.faceDetector.isAvailable(),
      eyeDetectionAvailable: this.eyeDetector.isAvailable(),
      isInitialized: this.faceDetector.isAvailable()
    }
  }
}

// Singleton instance
export const faceDetectionManager = new FaceDetectionManager()