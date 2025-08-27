import * as ort from 'onnxruntime-web'
import { FaceDetection, EyeState } from '../types'

export interface EyeDetectorOptions {
  modelPath?: string
  confidenceThreshold?: number
  inputSize?: { width: number; height: number }
}

export class EyeDetector {
  private session: ort.InferenceSession | null = null
  private isInitialized = false
  private options: Required<EyeDetectorOptions>

  constructor(options: EyeDetectorOptions = {}) {
    this.options = {
      modelPath: options.modelPath || '/models/eye-state.onnx',
      confidenceThreshold: options.confidenceThreshold || 0.6,
      inputSize: options.inputSize || { width: 112, height: 112 }
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Configure ONNX Runtime
      ort.env.wasm.simd = true
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2)

      const providers = ['webgpu', 'webgl', 'wasm']
      
      for (const provider of providers) {
        try {
          this.session = await ort.InferenceSession.create(
            this.options.modelPath, 
            { 
              executionProviders: [provider as any],
              graphOptimizationLevel: 'all'
            }
          )
          console.log(`Eye detector initialized with ${provider} provider`)
          break
        } catch (error) {
          console.warn(`Failed to initialize eye detector with ${provider}:`, error)
          continue
        }
      }

      if (!this.session) {
        throw new Error('Failed to initialize ONNX session for eye detection')
      }

      this.isInitialized = true
    } catch (error) {
      console.warn('Eye detector initialization failed, using fallback:', error)
      // Don't throw - we can still do face detection without eye state
    }
  }

  async analyzeEyeState(
    imageData: ImageData, 
    faces: FaceDetection[]
  ): Promise<FaceDetection[]> {
    if (!this.isInitialized || !this.session) {
      // Use fallback heuristic eye detection
      return this.fallbackEyeDetection(imageData, faces)
    }

    try {
      const updatedFaces = await Promise.all(
        faces.map(async (face) => {
          const eyeState = await this.detectEyeStateForFace(imageData, face)
          return { ...face, eyeState }
        })
      )
      
      return updatedFaces
    } catch (error) {
      console.warn('ONNX eye detection failed, using fallback:', error)
      return this.fallbackEyeDetection(imageData, faces)
    }
  }

  private async detectEyeStateForFace(
    imageData: ImageData,
    face: FaceDetection
  ): Promise<EyeState> {
    if (!this.session) {
      throw new Error('Eye detector not initialized')
    }

    // Extract face region
    const faceRegion = this.extractFaceRegion(imageData, face)
    
    // Preprocess for model
    const inputTensor = await this.preprocessFaceImage(faceRegion)
    
    // Run inference
    const results = await this.session.run({ 'input': inputTensor })
    
    // Parse results - assuming output format: [left_open, left_closed, right_open, right_closed]
    const output = results[Object.keys(results)[0]] as ort.Tensor
    const scores = output.data as Float32Array
    
    const leftOpenScore = scores[0]
    const leftClosedScore = scores[1]  
    const rightOpenScore = scores[2]
    const rightClosedScore = scores[3]
    
    const leftState: 'open' | 'closed' | 'unknown' = 
      leftOpenScore > leftClosedScore && leftOpenScore > this.options.confidenceThreshold 
        ? 'open' 
        : leftClosedScore > this.options.confidenceThreshold 
        ? 'closed' 
        : 'unknown'
    
    const rightState: 'open' | 'closed' | 'unknown' = 
      rightOpenScore > rightClosedScore && rightOpenScore > this.options.confidenceThreshold
        ? 'open'
        : rightClosedScore > this.options.confidenceThreshold
        ? 'closed' 
        : 'unknown'

    return { left: leftState, right: rightState }
  }

  private extractFaceRegion(imageData: ImageData, face: FaceDetection): ImageData {
    const { width, height, data } = imageData
    const { x, y, width: faceWidth, height: faceHeight } = face.bbox
    
    // Convert percentages to pixels
    const faceX = Math.floor((x / 100) * width)
    const faceY = Math.floor((y / 100) * height)
    const faceW = Math.floor((faceWidth / 100) * width)
    const faceH = Math.floor((faceHeight / 100) * height)
    
    // Add padding around face
    const padding = 0.2
    const paddedX = Math.max(0, faceX - Math.floor(faceW * padding))
    const paddedY = Math.max(0, faceY - Math.floor(faceH * padding))
    const paddedW = Math.min(width - paddedX, faceW + Math.floor(faceW * padding * 2))
    const paddedH = Math.min(height - paddedY, faceH + Math.floor(faceH * padding * 2))
    
    // Extract face region
    const faceData = new Uint8ClampedArray(paddedW * paddedH * 4)
    
    for (let y = 0; y < paddedH; y++) {
      for (let x = 0; x < paddedW; x++) {
        const srcIdx = ((paddedY + y) * width + (paddedX + x)) * 4
        const destIdx = (y * paddedW + x) * 4
        
        faceData[destIdx] = data[srcIdx]         // R
        faceData[destIdx + 1] = data[srcIdx + 1] // G
        faceData[destIdx + 2] = data[srcIdx + 2] // B
        faceData[destIdx + 3] = data[srcIdx + 3] // A
      }
    }
    
    return new ImageData(faceData, paddedW, paddedH)
  }

  private async preprocessFaceImage(faceImageData: ImageData): Promise<ort.Tensor> {
    const { width: inputWidth, height: inputHeight } = this.options.inputSize
    
    // Resize face to model input size
    const canvas = new OffscreenCanvas(inputWidth, inputHeight)
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    // Create image from face data
    const faceCanvas = new OffscreenCanvas(faceImageData.width, faceImageData.height)
    const faceCtx = faceCanvas.getContext('2d')
    if (!faceCtx) {
      throw new Error('Face canvas context not available')
    }
    
    faceCtx.putImageData(faceImageData, 0, 0)
    
    // Draw resized
    ctx.drawImage(faceCanvas, 0, 0, inputWidth, inputHeight)
    const resizedData = ctx.getImageData(0, 0, inputWidth, inputHeight)
    
    // Convert to tensor format [1, 3, H, W] normalized to [-1, 1]
    const tensorData = new Float32Array(3 * inputHeight * inputWidth)
    
    for (let i = 0; i < inputHeight * inputWidth; i++) {
      const pixelIndex = i * 4
      // Normalize to [-1, 1] range
      tensorData[i] = (resizedData.data[pixelIndex] / 255.0) * 2.0 - 1.0 // R
      tensorData[i + inputHeight * inputWidth] = (resizedData.data[pixelIndex + 1] / 255.0) * 2.0 - 1.0 // G
      tensorData[i + 2 * inputHeight * inputWidth] = (resizedData.data[pixelIndex + 2] / 255.0) * 2.0 - 1.0 // B
    }

    return new ort.Tensor('float32', tensorData, [1, 3, inputHeight, inputWidth])
  }

  private fallbackEyeDetection(imageData: ImageData, faces: FaceDetection[]): FaceDetection[] {
    // Simple heuristic-based eye detection as fallback
    return faces.map(face => ({
      ...face,
      eyeState: this.analyzeEyeStateHeuristic(imageData, face)
    }))
  }

  private analyzeEyeStateHeuristic(imageData: ImageData, face: FaceDetection): EyeState {
    const { width, height, data } = imageData
    const { x, y, width: faceWidth, height: faceHeight } = face.bbox
    
    // Convert to pixels
    const faceX = (x / 100) * width
    const faceY = (y / 100) * height
    const faceW = (faceWidth / 100) * width
    const faceH = (faceHeight / 100) * height
    
    // Approximate eye regions (upper 40% of face)
    const eyeRegionY = faceY + faceH * 0.2
    const eyeRegionHeight = faceH * 0.3
    
    const leftEyeX = faceX + faceW * 0.2
    const rightEyeX = faceX + faceW * 0.7
    const eyeWidth = faceW * 0.2
    
    const leftEyeState = this.analyzeEyeRegionHeuristic(
      data, width, height,
      leftEyeX, eyeRegionY, eyeWidth, eyeRegionHeight
    )
    
    const rightEyeState = this.analyzeEyeRegionHeuristic(
      data, width, height,
      rightEyeX, eyeRegionY, eyeWidth, eyeRegionHeight
    )
    
    return {
      left: leftEyeState,
      right: rightEyeState
    }
  }

  private analyzeEyeRegionHeuristic(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    eyeX: number,
    eyeY: number,
    eyeWidth: number,
    eyeHeight: number
  ): 'open' | 'closed' | 'unknown' {
    let darkPixels = 0
    let totalPixels = 0
    
    const startX = Math.max(0, Math.floor(eyeX))
    const endX = Math.min(imageWidth, Math.floor(eyeX + eyeWidth))
    const startY = Math.max(0, Math.floor(eyeY))
    const endY = Math.min(imageHeight, Math.floor(eyeY + eyeHeight))
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * imageWidth + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        
        // Calculate luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b
        
        if (luminance < 80) { // Dark threshold for iris/pupil
          darkPixels++
        }
        totalPixels++
      }
    }
    
    if (totalPixels === 0) return 'unknown'
    
    const darkRatio = darkPixels / totalPixels
    
    // Heuristic: open eyes have more dark pixels (iris/pupil visible)
    if (darkRatio > 0.15) return 'open'
    if (darkRatio < 0.05) return 'closed'
    return 'unknown'
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release()
      this.session = null
    }
    this.isInitialized = false
  }

  isAvailable(): boolean {
    return this.isInitialized && this.session !== null
  }
}

export const eyeDetector = new EyeDetector()