import * as ort from 'onnxruntime-web'
import { FaceDetection } from '../types'

export interface FaceDetectorOptions {
  modelPath?: string
  confidenceThreshold?: number
  nmsThreshold?: number
  inputSize?: { width: number; height: number }
}

export interface DetectionResult {
  faces: FaceDetection[]
  processingTime: number
}

export class FaceDetector {
  private session: ort.InferenceSession | null = null
  private isInitialized = false
  private options: Required<FaceDetectorOptions>

  constructor(options: FaceDetectorOptions = {}) {
    this.options = {
      modelPath: options.modelPath || '/models/face-detection.onnx',
      confidenceThreshold: options.confidenceThreshold || 0.7,
      nmsThreshold: options.nmsThreshold || 0.4,
      inputSize: options.inputSize || { width: 640, height: 640 }
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Configure ONNX Runtime for WebGL/WebGPU if available
      ort.env.wasm.simd = true
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4

      // Try WebGPU first, fallback to WebGL, then CPU
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
          console.log(`Face detection initialized with ${provider} provider`)
          break
        } catch (error) {
          console.warn(`Failed to initialize with ${provider}:`, error)
          continue
        }
      }

      if (!this.session) {
        throw new Error('Failed to initialize ONNX session with any provider')
      }

      this.isInitialized = true
    } catch (error) {
      console.error('Face detector initialization failed:', error)
      throw new Error(`Face detection unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async detectFaces(imageData: ImageData): Promise<DetectionResult> {
    const startTime = performance.now()

    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.session) {
      throw new Error('Face detector not initialized')
    }

    try {
      // Preprocess image for model input
      const inputTensor = await this.preprocessImage(imageData)
      
      // Run inference
      const results = await this.session.run({ 'images': inputTensor })
      
      // Post-process results
      const faces = await this.postprocessResults(
        results, 
        imageData.width, 
        imageData.height
      )

      const processingTime = performance.now() - startTime

      return {
        faces,
        processingTime
      }
    } catch (error) {
      throw new Error(`Face detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async preprocessImage(imageData: ImageData): Promise<ort.Tensor> {
    const { width, height, data } = imageData
    const { width: inputWidth, height: inputHeight } = this.options.inputSize

    // Create canvas for preprocessing
    const canvas = new OffscreenCanvas(inputWidth, inputHeight)
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    // Draw and resize image
    const imageCanvas = new OffscreenCanvas(width, height)
    const imageCtx = imageCanvas.getContext('2d')
    if (!imageCtx) {
      throw new Error('Image canvas context not available')
    }

    const imageDataClone = new ImageData(data, width, height)
    imageCtx.putImageData(imageDataClone, 0, 0)
    
    ctx.drawImage(imageCanvas, 0, 0, inputWidth, inputHeight)
    
    const resizedImageData = ctx.getImageData(0, 0, inputWidth, inputHeight)
    
    // Convert to RGB float tensor [1, 3, H, W] normalized to [0,1]
    const tensorData = new Float32Array(3 * inputHeight * inputWidth)
    
    for (let i = 0; i < inputHeight * inputWidth; i++) {
      const pixelIndex = i * 4
      // Normalize to [0,1] and convert from RGBA to RGB
      tensorData[i] = resizedImageData.data[pixelIndex] / 255.0 // R
      tensorData[i + inputHeight * inputWidth] = resizedImageData.data[pixelIndex + 1] / 255.0 // G  
      tensorData[i + 2 * inputHeight * inputWidth] = resizedImageData.data[pixelIndex + 2] / 255.0 // B
    }

    return new ort.Tensor('float32', tensorData, [1, 3, inputHeight, inputWidth])
  }

  private async postprocessResults(
    results: ort.InferenceSession.OnnxValueMapType,
    originalWidth: number,
    originalHeight: number
  ): Promise<FaceDetection[]> {
    // Handle different model output formats (YOLOv8, YOLOv5, etc.)
    const outputKey = Object.keys(results)[0]
    const output = results[outputKey] as ort.Tensor
    
    if (!output) {
      return []
    }

    const boxes: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      confidence: number
    }> = []

    // Parse model output - assuming format: [batch, 6, num_detections] where 6 = [x1,y1,x2,y2,conf,class]
    const outputData = output.data as Float32Array
    const dims = output.dims
    
    if (dims.length >= 3) {
      const numDetections = dims[2] || dims[1]
      const stride = 6 // [x1, y1, x2, y2, confidence, class]
      
      for (let i = 0; i < numDetections; i++) {
        const baseIdx = i * stride
        const confidence = outputData[baseIdx + 4]
        
        if (confidence >= this.options.confidenceThreshold) {
          const x1 = outputData[baseIdx] / this.options.inputSize.width
          const y1 = outputData[baseIdx + 1] / this.options.inputSize.height  
          const x2 = outputData[baseIdx + 2] / this.options.inputSize.width
          const y2 = outputData[baseIdx + 3] / this.options.inputSize.height

          boxes.push({ x1, y1, x2, y2, confidence })
        }
      }
    }

    // Apply Non-Maximum Suppression
    const filteredBoxes = this.applyNMS(boxes, this.options.nmsThreshold)
    
    // Convert to FaceDetection format
    const faces: FaceDetection[] = filteredBoxes.map((box, index) => ({
      id: `face-${Date.now()}-${index}`,
      bbox: {
        x: box.x1 * 100, // Convert to percentage
        y: box.y1 * 100,
        width: (box.x2 - box.x1) * 100,
        height: (box.y2 - box.y1) * 100
      },
      confidence: box.confidence,
      eyeState: undefined, // Will be filled by eye detector
      focusScore: undefined // Will be calculated later
    }))

    return faces
  }

  private applyNMS(
    boxes: Array<{ x1: number; y1: number; x2: number; y2: number; confidence: number }>,
    threshold: number
  ): Array<{ x1: number; y1: number; x2: number; y2: number; confidence: number }> {
    if (boxes.length === 0) return []

    // Sort by confidence descending
    boxes.sort((a, b) => b.confidence - a.confidence)

    const keep: boolean[] = new Array(boxes.length).fill(true)

    for (let i = 0; i < boxes.length; i++) {
      if (!keep[i]) continue

      const boxA = boxes[i]
      
      for (let j = i + 1; j < boxes.length; j++) {
        if (!keep[j]) continue

        const boxB = boxes[j]
        const iou = this.calculateIoU(boxA, boxB)
        
        if (iou > threshold) {
          keep[j] = false
        }
      }
    }

    return boxes.filter((_, index) => keep[index])
  }

  private calculateIoU(
    boxA: { x1: number; y1: number; x2: number; y2: number },
    boxB: { x1: number; y1: number; x2: number; y2: number }
  ): number {
    const intersectionX1 = Math.max(boxA.x1, boxB.x1)
    const intersectionY1 = Math.max(boxA.y1, boxB.y1)
    const intersectionX2 = Math.min(boxA.x2, boxB.x2)
    const intersectionY2 = Math.min(boxA.y2, boxB.y2)

    const intersectionWidth = Math.max(0, intersectionX2 - intersectionX1)
    const intersectionHeight = Math.max(0, intersectionY2 - intersectionY1)
    const intersectionArea = intersectionWidth * intersectionHeight

    const boxAArea = (boxA.x2 - boxA.x1) * (boxA.y2 - boxA.y1)
    const boxBArea = (boxB.x2 - boxB.x1) * (boxB.y2 - boxB.y1)
    const unionArea = boxAArea + boxBArea - intersectionArea

    return unionArea > 0 ? intersectionArea / unionArea : 0
  }

  updateOptions(newOptions: Partial<FaceDetectorOptions>): void {
    this.options = { ...this.options, ...newOptions }
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

// Singleton instance
export const faceDetector = new FaceDetector()