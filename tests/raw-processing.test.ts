import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RawProcessingManager } from '../lib/raw/manager'

// Mock worker for testing
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null
}

// Mock Worker constructor
global.Worker = vi.fn().mockImplementation(() => mockWorker)

describe('RAW Processing', () => {
  let manager: RawProcessingManager
  
  beforeEach(() => {
    manager = new RawProcessingManager()
    vi.clearAllMocks()
  })
  
  afterEach(async () => {
    try {
      manager.terminate()
      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10))
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  })

  it('should detect RAW files correctly', () => {
    expect(manager.isRawFile('IMG_1234.CR2')).toBe(true)
    expect(manager.isRawFile('image.nef')).toBe(true)
    expect(manager.isRawFile('photo.ARW')).toBe(true)
    expect(manager.isRawFile('test.dng')).toBe(true)
    expect(manager.isRawFile('image.jpg')).toBe(false)
    expect(manager.isRawFile('document.pdf')).toBe(false)
  })

  it('should initialize worker correctly', async () => {
    await manager.initialize()
    
    expect(global.Worker).toHaveBeenCalledWith('/workers/raw-worker.js')
    expect(mockWorker.onmessage).toBeDefined()
    expect(mockWorker.onerror).toBeDefined()
  })

  it('should handle worker messages correctly', async () => {
    await manager.initialize()
    
    // Create a mock ArrayBuffer
    const mockBuffer = new ArrayBuffer(100)
    
    // Start processing (this will create a pending request)
    const processPromise = manager.generateThumbnail(mockBuffer, 200, 200)
    
    // Simulate worker response
    const mockResponse = {
      data: {
        id: expect.any(String),
        success: true,
        result: {
          imageData: new Uint8Array([1, 2, 3]),
          metadata: { width: 200, height: 200 },
          width: 200,
          height: 200,
          format: 'jpeg'
        }
      }
    }
    
    // Get the message handler and simulate response
    const messageHandler = mockWorker.onmessage
    if (messageHandler) {
      // Find the request ID from the postMessage call
      const lastCall = mockWorker.postMessage.mock.calls[0]
      const requestId = lastCall[0].id
      
      // Send response with same ID
      messageHandler({
        data: {
          ...mockResponse.data,
          id: requestId
        }
      })
    }
    
    // Verify the promise resolves
    const result = await processPromise
    expect(result).toEqual({
      imageData: new Uint8Array([1, 2, 3]),
      metadata: { width: 200, height: 200 },
      width: 200,
      height: 200,
      format: 'jpeg'
    })
  })

  it('should handle worker errors correctly', async () => {
    await manager.initialize()
    
    const mockBuffer = new ArrayBuffer(100)
    const processPromise = manager.generateThumbnail(mockBuffer, 200, 200)
    
    // Simulate worker error response
    const messageHandler = mockWorker.onmessage
    if (messageHandler) {
      const lastCall = mockWorker.postMessage.mock.calls[0]
      const requestId = lastCall[0].id
      
      messageHandler({
        data: {
          id: requestId,
          success: false,
          error: 'Processing failed'
        }
      })
    }
    
    await expect(processPromise).rejects.toThrow('Processing failed')
  })

  it('should terminate worker properly', async () => {
    await manager.initialize()
    
    manager.terminate()
    
    expect(mockWorker.terminate).toHaveBeenCalled()
  })

  it('should handle multiple concurrent requests', async () => {
    await manager.initialize()
    
    const mockBuffer1 = new ArrayBuffer(100)
    const mockBuffer2 = new ArrayBuffer(200)
    
    // Start two concurrent requests
    const promise1 = manager.generateThumbnail(mockBuffer1, 200, 200)
    const promise2 = manager.generatePreview(mockBuffer2, 1920, 1080)
    
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(2)
    
    // Verify different request types
    const calls = mockWorker.postMessage.mock.calls
    expect(calls[0][0].type).toBe('thumbnail')
    expect(calls[1][0].type).toBe('preview')
  })
})

describe('RAW File Extensions', () => {
  const manager = new RawProcessingManager()
  
  const rawExtensions = [
    'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2', 
    'raf', 'srw', 'pef', 'x3f', 'raw'
  ]
  
  rawExtensions.forEach(ext => {
    it(`should recognize .${ext} files as RAW`, () => {
      expect(manager.isRawFile(`image.${ext}`)).toBe(true)
      expect(manager.isRawFile(`IMAGE.${ext.toUpperCase()}`)).toBe(true)
    })
  })
  
  const nonRawExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff']
  
  nonRawExtensions.forEach(ext => {
    it(`should not recognize .${ext} files as RAW`, () => {
      expect(manager.isRawFile(`image.${ext}`)).toBe(false)
    })
  })
})