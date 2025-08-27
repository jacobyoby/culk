import * as ort from 'onnxruntime-web'
import { FaceDetection } from '../types'

export interface BlazeFaceOptions {
  confidenceThreshold?: number
  maxFaces?: number
}

export class BlazeFaceDetector {
  private session: ort.InferenceSession | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Configure ONNX Runtime for optimal performance
      ort.env.wasm.simd = true
      ort.env.wasm.numThreads = Math.min(4, navigator?.hardwareConcurrency || 2)
      
      // Load end-to-end BlazeFace ONNX model with built-in post-processing
      const modelPath = '/models/blazeface-end2end.onnx'
      
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all'
      })

      this.isInitialized = true
      console.log('BlazeFace detector initialized successfully')
    } catch (error) {
      console.error('Failed to initialize BlazeFace detector:', error)
      throw new Error(`BlazeFace initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async detectFaces(
    imageData: ImageData, 
    options: BlazeFaceOptions = {}
  ): Promise<FaceDetection[]> {
    if (!this.isInitialized || !this.session) {
      await this.initialize()
    }

    const { 
      confidenceThreshold = 0.7, 
      maxFaces = 10 
    } = options

    try {
      // Preprocess image for BlazeFace (128x128 input)
      const inputTensor = this.preprocessImage(imageData)
      
      // End-to-end model takes image + confidence + IOU thresholds  
      const confidenceTensor = new ort.Tensor('float32', new Float32Array([confidenceThreshold]), [1])
      const maxDetectionsTensor = new ort.Tensor('int64', new BigInt64Array([BigInt(maxFaces)]), [1])
      const iouTensor = new ort.Tensor('float32', new Float32Array([0.5]), [1]) // IOU threshold for NMS
      
      console.log('Running end-to-end BlazeFace with inputs:', {
        image: inputTensor.dims,
        confidence: confidenceTensor.dims, 
        maxDetections: maxDetectionsTensor.dims,
        iou: iouTensor.dims
      })
      
      // Check the actual input names from the model
      console.log('Model input names:', this.session!.inputNames)
      console.log('Model output names:', this.session!.outputNames)
      
      // Map inputs by name to ensure correct order
      const feeds: Record<string, ort.Tensor> = {
        'image': inputTensor,
        'conf_threshold': confidenceTensor, 
        'max_detections': maxDetectionsTensor,
        'iou_threshold': iouTensor
      }
      
      const results = await this.session!.run(feeds)
      
      // Clean up threshold tensors
      confidenceTensor.dispose()
      iouTensor.dispose()
      maxDetectionsTensor.dispose()
      
      // Post-process results
      const faces = this.postprocessResults(
        results,
        confidenceThreshold,
        maxFaces
      )

      // Clean up tensors
      inputTensor.dispose()
      Object.values(results).forEach(tensor => tensor.dispose())

      return faces
    } catch (error) {
      console.error('BlazeFace detection failed:', error)
      return []
    }
  }

  private preprocessImage(imageData: ImageData): ort.Tensor {
    const { width, height } = imageData
    
    // BlazeFace expects 128x128 RGB input
    const targetSize = 128
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = targetSize
    canvas.height = targetSize
    
    // Resize image to 128x128
    ctx.drawImage(
      this.imageDataToCanvas(imageData),
      0, 0, width, height,
      0, 0, targetSize, targetSize
    )
    
    const resizedImageData = ctx.getImageData(0, 0, targetSize, targetSize)
    
    // Try different input formats
    // Method 1: CHW format (channels first) - current attempt with BGR
    const rgbDataCHW = new Float32Array(3 * targetSize * targetSize)
    for (let i = 0; i < targetSize * targetSize; i++) {
      const pixelIndex = i * 4
      // Try RGB order first
      rgbDataCHW[i] = resizedImageData.data[pixelIndex] / 255.0     // R: [0, 1]
      rgbDataCHW[i + targetSize * targetSize] = resizedImageData.data[pixelIndex + 1] / 255.0 // G: [0, 1]
      rgbDataCHW[i + 2 * targetSize * targetSize] = resizedImageData.data[pixelIndex + 2] / 255.0 // B: [0, 1]
    }
    
    // Debug: Log input statistics
    const rChannel = rgbDataCHW.slice(0, targetSize * targetSize)
    const gChannel = rgbDataCHW.slice(targetSize * targetSize, 2 * targetSize * targetSize)
    const bChannel = rgbDataCHW.slice(2 * targetSize * targetSize)
    
    const rMean = rChannel.reduce((a, b) => a + b) / rChannel.length
    const gMean = gChannel.reduce((a, b) => a + b) / gChannel.length
    const bMean = bChannel.reduce((a, b) => a + b) / bChannel.length
    
    console.log(`BlazeFace input stats - R: ${rMean.toFixed(3)}, G: ${gMean.toFixed(3)}, B: ${bMean.toFixed(3)}`)
    console.log(`Input tensor shape: [1, 3, ${targetSize}, ${targetSize}] (CHW format)`)
    
    // Also try HWC format (height, width, channels) - some models expect this
    const rgbDataHWC = new Float32Array(targetSize * targetSize * 3)
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const srcIdx = (y * targetSize + x) * 4
        const dstIdx = (y * targetSize + x) * 3
        rgbDataHWC[dstIdx] = resizedImageData.data[srcIdx] / 255.0     // R
        rgbDataHWC[dstIdx + 1] = resizedImageData.data[srcIdx + 1] / 255.0 // G
        rgbDataHWC[dstIdx + 2] = resizedImageData.data[srcIdx + 2] / 255.0 // B
      }
    }
    
    // Try CHW format first (most common for ONNX models)
    return new ort.Tensor('float32', rgbDataCHW, [1, 3, targetSize, targetSize])
  }

  private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)
    
    return canvas
  }

  private postprocessResults(
    results: Record<string, ort.Tensor>,
    confidenceThreshold: number,
    maxFaces: number
  ): FaceDetection[] {
    const faces: FaceDetection[] = []
    
    try {
      console.log('BlazeFace model outputs:', Object.keys(results))
      
      // End-to-end model output: (batch_size, num_detections, 16)
      const outputKeys = Object.keys(results)
      const predictions = results[outputKeys[0]]
      
      console.log(`End-to-end BlazeFace output shape:`, predictions.dims)
      console.log(`All output keys:`, outputKeys)
      
      if (!predictions || predictions.dims.length < 2) {
        console.warn('Invalid end-to-end BlazeFace output tensor')
        return faces
      }
      
      const data = predictions.data as Float32Array
      
      // Handle different output shapes:
      // Shape [1, 16]: Single detection with 16 values
      // Shape [1, N, 16]: Multiple detections 
      let batchSize: number, numDetections: number, valuesPer: number
      
      if (predictions.dims.length === 2) {
        // Shape [1, 16] - single detection
        batchSize = predictions.dims[0]
        numDetections = 1
        valuesPer = predictions.dims[1] // Should be 16
        console.log(`Single detection format: batch=${batchSize}, values=${valuesPer}`)
      } else {
        // Shape [1, N, 16] - multiple detections
        batchSize = predictions.dims[0]
        numDetections = predictions.dims[1]
        valuesPer = predictions.dims[2] 
        console.log(`Multiple detection format: batch=${batchSize}, detections=${numDetections}, values=${valuesPer}`)
      }
      
      console.log(`Processing batch_size=${batchSize}, detections=${numDetections}, values_per=${valuesPer}`)
      
      for (let i = 0; i < Math.min(numDetections, maxFaces); i++) {
        let offset: number
        
        if (predictions.dims.length === 2) {
          // Single detection: data is just [16 values]
          offset = 0
        } else {
          // Multiple detections: data is [detection0_16values, detection1_16values, ...]
          offset = i * valuesPer
        }
        
        // End-to-end format: 16 values = [box coordinates, eye positions, nose, mouth, ear coordinates]
        // First 4 are bounding box: [ymin, xmin, ymax, xmax]  
        const ymin = data[offset]
        const xmin = data[offset + 1]
        const ymax = data[offset + 2] 
        const xmax = data[offset + 3]
        
        console.log(`Detection ${i}: bbox=[${xmin.toFixed(3)}, ${ymin.toFixed(3)}, ${xmax.toFixed(3)}, ${ymax.toFixed(3)}]`)
        
        // Since this is end-to-end with NMS, all returned detections should be above threshold
        // But let's validate bounding box sanity
        if (xmin >= xmax || ymin >= ymax || xmin < 0 || ymin < 0 || xmax > 1 || ymax > 1) {
          console.log(`Skipping invalid bbox: [${xmin}, ${ymin}, ${xmax}, ${ymax}]`)
          continue
        }
        
        // Check if this is actually a detection (non-zero box)
        if (xmin === 0 && ymin === 0 && xmax === 0 && ymax === 0) {
          console.log(`Skipping empty detection ${i}`)
          continue
        }
        
        // Convert to percentage coordinates
        const face: FaceDetection = {
          id: `blazeface-end2end-${Date.now()}-${i}`,
          bbox: {
            x: xmin * 100,
            y: ymin * 100,
            width: (xmax - xmin) * 100,
            height: (ymax - ymin) * 100
          },
          confidence: 0.8, // End-to-end model doesn't return explicit confidence, use default
          eyeState: { left: 'unknown', right: 'unknown' },
          focusScore: 0
        }
        
        faces.push(face)
      }
      
    } catch (error) {
      console.error('Error post-processing BlazeFace results:', error)
    }
    
    return faces
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