import { RawWorkerMessage, RawWorkerResponse } from '../../workers/raw-worker'
import { RawProcessorOptions, RawProcessingResult } from './processor'
import { nanoid } from 'nanoid'

export class RawProcessingManager {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, {
    resolve: (result: RawProcessingResult) => void
    reject: (error: Error) => void
  }>()

  async initialize(): Promise<void> {
    if (this.worker) return

    try {
      this.worker = new Worker('/workers/raw-worker.js')
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)
    } catch (error) {
      console.warn('RAW Worker not available:', error)
      throw new Error('Failed to initialize RAW processing worker')
    }
  }

  async processRawFile(
    fileBuffer: ArrayBuffer,
    options?: RawProcessorOptions
  ): Promise<RawProcessingResult> {
    return this.sendWorkerMessage('process', fileBuffer, { options })
  }

  async generatePreview(
    fileBuffer: ArrayBuffer,
    maxWidth: number = 1920,
    maxHeight: number = 1080
  ): Promise<RawProcessingResult> {
    return this.sendWorkerMessage('preview', fileBuffer, { maxWidth, maxHeight })
  }

  async generateThumbnail(
    fileBuffer: ArrayBuffer,
    width: number = 200,
    height: number = 200
  ): Promise<RawProcessingResult> {
    return this.sendWorkerMessage('thumbnail', fileBuffer, { width, height })
  }

  private async sendWorkerMessage(
    type: 'process' | 'preview' | 'thumbnail',
    fileBuffer: ArrayBuffer,
    params: any = {}
  ): Promise<RawProcessingResult> {
    if (!this.worker) {
      await this.initialize()
    }

    return new Promise<RawProcessingResult>((resolve, reject) => {
      const id = nanoid()
      
      this.pendingRequests.set(id, { resolve, reject })

      const message: RawWorkerMessage = {
        id,
        type,
        fileBuffer,
        ...params
      }

      this.worker!.postMessage(message, [fileBuffer.slice()])
    })
  }

  private handleWorkerMessage(event: MessageEvent<RawWorkerResponse>): void {
    const { id, success, result, error } = event.data
    const pending = this.pendingRequests.get(id)
    
    if (!pending) {
      console.warn('Received response for unknown request:', id)
      return
    }

    this.pendingRequests.delete(id)

    if (success && result) {
      pending.resolve(result)
    } else {
      pending.reject(new Error(error || 'RAW processing failed'))
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('RAW Worker error:', error)
    
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('RAW worker encountered an error'))
    })
    
    this.pendingRequests.clear()
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('RAW processing terminated'))
    })
    
    this.pendingRequests.clear()
  }

  isRawFile(fileName: string): boolean {
    const rawExtensions = [
      'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2', 
      'raf', 'srw', 'pef', 'x3f', 'rwl', '3fr', 'fff', 'dcr',
      'kdc', 'mef', 'mos', 'mrw', 'nrw', 'ptx', 'pxn', 'r3d'
    ]
    
    const extension = fileName.toLowerCase().split('.').pop()
    return extension ? rawExtensions.includes(extension) : false
  }
}

export const rawManager = new RawProcessingManager()