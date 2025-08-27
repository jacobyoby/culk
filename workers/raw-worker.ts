import { RawProcessor, RawProcessorOptions, RawProcessingResult } from '../lib/raw/processor'

export interface RawWorkerMessage {
  id: string
  type: 'process' | 'preview' | 'thumbnail'
  fileBuffer: ArrayBuffer
  options?: RawProcessorOptions
  maxWidth?: number
  maxHeight?: number
  width?: number
  height?: number
}

export interface RawWorkerResponse {
  id: string
  success: boolean
  result?: RawProcessingResult
  error?: string
}

const processor = new RawProcessor()

self.onmessage = async (event: MessageEvent<RawWorkerMessage>) => {
  const { id, type, fileBuffer, options, maxWidth, maxHeight, width, height } = event.data
  
  try {
    let result: RawProcessingResult

    switch (type) {
      case 'process':
        result = await processor.processRawFile(fileBuffer, options)
        break
        
      case 'preview':
        result = await processor.generatePreview(
          fileBuffer, 
          maxWidth || 1920, 
          maxHeight || 1080
        )
        break
        
      case 'thumbnail':
        result = await processor.generateThumbnail(
          fileBuffer,
          width || 200,
          height || 200
        )
        break
        
      default:
        throw new Error(`Unknown processing type: ${type}`)
    }

    const response: RawWorkerResponse = {
      id,
      success: true,
      result
    }
    
    self.postMessage(response)
    
  } catch (error) {
    const response: RawWorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    self.postMessage(response)
  }
}

export {}