import { db } from '../store/db'
import { ImageRec, ImportSession, ImageMetadata } from '../types'
import { 
  selectFolder, 
  selectFiles,
  selectSingleFile,
  walkDirectory, 
  isImageFile, 
  getFileMetadata,
  readFileAsDataURL
} from './file-system-access'
import { extractMetadata } from '../utils/exif'
import { generateThumbnail } from '../utils/image'
import { detectAutoCropRegion } from '../utils/crop'
import { rawManager } from '../raw/manager'
import { faceDetectionWorkerManager } from '../ml/face-detection-worker-manager'

export interface ImportProgress {
  total: number
  processed: number
  failed: number
  currentFile: string
  errors: Array<{ file: string; error: string }>
}

export interface ImportOptions {
  generateThumbnails?: boolean
  extractExif?: boolean
  detectAutoCrop?: boolean
  detectFaces?: boolean
  maxConcurrent?: number
  onProgress?: (progress: ImportProgress) => void
}

export class ImageImporter {
  private abortController: AbortController | null = null
  
  async importFiles(options: ImportOptions = {}): Promise<ImportSession | null> {
    const fileHandles = await selectFiles()
    if (!fileHandles || fileHandles.length === 0) return null

    return this.processFileHandles(fileHandles, 'Selected Files', options)
  }

  async importSingleFile(options: ImportOptions = {}): Promise<ImportSession | null> {
    const fileHandle = await selectSingleFile()
    if (!fileHandle) return null

    return this.processFileHandles([fileHandle], 'Single File', options)
  }

  async importFolder(options: ImportOptions = {}): Promise<ImportSession | null> {
    const {
      generateThumbnails = true,
      extractExif = true,
      detectAutoCrop = true,
      detectFaces = true,
      maxConcurrent = 4,
      onProgress
    } = options
    
    const dirHandle = await selectFolder()
    if (!dirHandle) return null
    
    this.abortController = new AbortController()
    
    const session: ImportSession = {
      id: crypto.randomUUID(),
      folderName: dirHandle.name,
      startedAt: new Date(),
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      status: 'processing',
      errors: []
    }
    
    await db.sessions.add(session)
    await db.initProject()
    
    try {
      const files: Array<{ handle: FileSystemFileHandle; path: string }> = []
      
      for await (const file of walkDirectory(dirHandle)) {
        if (this.abortController.signal.aborted) break
        if (isImageFile(file.handle.name)) {
          files.push(file)
        }
      }
      
      session.totalFiles = files.length
      await db.sessions.update(session.id, { totalFiles: files.length })
      
      const progress: ImportProgress = {
        total: files.length,
        processed: 0,
        failed: 0,
        currentFile: '',
        errors: []
      }
      
      const queue = [...files]
      const workers: Promise<void>[] = []
      
      for (let i = 0; i < maxConcurrent; i++) {
        workers.push(this.processQueue(
          queue,
          session,
          progress,
          { generateThumbnails, extractExif, detectAutoCrop, detectFaces },
          onProgress
        ))
      }
      
      await Promise.all(workers)
      
      session.completedAt = new Date()
      session.status = progress.failed === files.length ? 'failed' : 'completed'
      session.processedFiles = progress.processed
      session.failedFiles = progress.failed
      session.errors = progress.errors
      
      await db.sessions.update(session.id, session)
      await db.updateProjectStats()
      
      return session
      
    } catch (error) {
      session.status = 'failed'
      session.completedAt = new Date()
      await db.sessions.update(session.id, session)
      throw error
    }
  }

  private async processFileHandles(
    fileHandles: FileSystemFileHandle[],
    sourceName: string,
    options: ImportOptions
  ): Promise<ImportSession | null> {
    const {
      generateThumbnails = true,
      extractExif = true,
      detectAutoCrop = true,
      detectFaces = true,
      maxConcurrent = 4,
      onProgress
    } = options

    this.abortController = new AbortController()

    const session: ImportSession = {
      id: crypto.randomUUID(),
      folderName: sourceName,
      startedAt: new Date(),
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      status: 'processing',
      errors: []
    }

    await db.sessions.add(session)
    await db.initProject()

    try {
      // Filter for image files and create file objects
      const files: Array<{ handle: FileSystemFileHandle; path: string }> = []
      
      for (const handle of fileHandles) {
        if (this.abortController.signal.aborted) break
        if (isImageFile(handle.name)) {
          files.push({
            handle,
            path: handle.name // For files, path is just the filename
          })
        }
      }

      session.totalFiles = files.length
      await db.sessions.update(session.id, { totalFiles: files.length })

      const progress: ImportProgress = {
        total: files.length,
        processed: 0,
        failed: 0,
        currentFile: '',
        errors: []
      }

      const queue = [...files]
      const workers: Promise<void>[] = []

      for (let i = 0; i < maxConcurrent; i++) {
        workers.push(this.processQueue(
          queue,
          session,
          progress,
          { generateThumbnails, extractExif, detectAutoCrop, detectFaces },
          onProgress
        ))
      }

      await Promise.all(workers)

      session.completedAt = new Date()
      session.status = progress.failed === files.length ? 'failed' : 'completed'
      session.processedFiles = progress.processed
      session.failedFiles = progress.failed
      session.errors = progress.errors

      await db.sessions.update(session.id, session)
      await db.updateProjectStats()

      return session

    } catch (error) {
      session.status = 'failed'
      session.completedAt = new Date()
      await db.sessions.update(session.id, session)
      throw error
    }
  }
  
  private async processQueue(
    queue: Array<{ handle: FileSystemFileHandle; path: string }>,
    session: ImportSession,
    progress: ImportProgress,
    options: { generateThumbnails: boolean; extractExif: boolean; detectAutoCrop: boolean; detectFaces: boolean },
    onProgress?: (progress: ImportProgress) => void
  ): Promise<void> {
    while (queue.length > 0) {
      if (this.abortController?.signal.aborted) break
      
      const file = queue.shift()
      if (!file) break
      
      progress.currentFile = file.path
      
      try {
        await this.processFile(file, session.id, options)
        progress.processed++
      } catch (error) {
        progress.failed++
        progress.errors.push({
          file: file.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      onProgress?.(progress)
      
      await db.sessions.update(session.id, {
        processedFiles: progress.processed,
        failedFiles: progress.failed,
        errors: progress.errors
      })
    }
  }
  
  private async processFile(
    file: { handle: FileSystemFileHandle; path: string },
    sessionId: string,
    options: { generateThumbnails: boolean; extractExif: boolean; detectAutoCrop: boolean; detectFaces: boolean }
  ): Promise<void> {
    const fileData = await getFileMetadata(file.handle)
    const fileObj = await file.handle.getFile()
    
    let metadata: ImageMetadata = {}
    let thumbnailDataUrl: string | undefined
    let previewDataUrl: string | undefined
    let autoCropRegion: any = undefined
    let detectedFaces: any = undefined
    
    if (options.extractExif) {
      try {
        metadata = await extractMetadata(fileObj)
      } catch (error) {
        console.warn('Failed to extract metadata:', error)
      }
    }
    
    // Check if file is an image (by extension or MIME type) or RAW file
    const isImageByType = fileObj.type.startsWith('image/')
    const isImageByExtension = isImageFile(fileData.name)
    const isRawFile = rawManager.isRawFile(fileData.name)
    
    if (options.generateThumbnails && (isImageByType || isImageByExtension || isRawFile)) {
      try {
        if (isRawFile && typeof window !== 'undefined') {
          // Process RAW file using LibRaw WASM
          try {
            await rawManager.initialize()
            const fileBuffer = await fileObj.arrayBuffer()
            
            const thumbnailResult = await rawManager.generateThumbnail(fileBuffer, 200, 200)
            const previewResult = await rawManager.generatePreview(fileBuffer, 1920, 1080)
            
            // Convert RAW processing results to data URLs
            thumbnailDataUrl = this.arrayBufferToDataUrl(thumbnailResult.imageData, 'image/jpeg')
            previewDataUrl = this.arrayBufferToDataUrl(previewResult.imageData, 'image/jpeg')
            
            // Use RAW metadata if available
            if (thumbnailResult.metadata && Object.keys(thumbnailResult.metadata).length > 0) {
              metadata = { ...metadata, ...thumbnailResult.metadata }
            }
          } catch (rawError) {
            console.warn('RAW processing failed, falling back to standard processing:', rawError)
            // Fall back to standard thumbnail generation
            thumbnailDataUrl = await generateThumbnail(fileObj, 200, 200)
            previewDataUrl = await generateThumbnail(fileObj, 1920, 1080)
          }
        } else {
          // Standard image processing
          thumbnailDataUrl = await generateThumbnail(fileObj, 200, 200)
          previewDataUrl = await generateThumbnail(fileObj, 1920, 1080)
        }
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error)
        
        // If MIME type failed but extension suggests it's an image, try forcing it
        if (!isImageByType && isImageByExtension && !isRawFile) {
          try {
            // Create a new File object with correct MIME type
            const correctedFile = new File([fileObj], fileObj.name, {
              type: this.getMimeTypeFromExtension(fileData.name)
            })
            thumbnailDataUrl = await generateThumbnail(correctedFile, 200, 200)
            previewDataUrl = await generateThumbnail(correctedFile, 1920, 1080)
          } catch (retryError) {
            console.warn('Failed to generate thumbnail after MIME type correction:', retryError)
          }
        }
      }
    }
    
    // Detect auto-crop region if enabled and thumbnails were generated (client-side only)
    if (options.detectAutoCrop && thumbnailDataUrl && typeof window !== 'undefined') {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              canvas.width = img.width
              canvas.height = img.height
              ctx.drawImage(img, 0, 0)
              
              const imageData = ctx.getImageData(0, 0, img.width, img.height)
              const cropResult = detectAutoCropRegion(imageData, { method: 'edge-detection' })
              
              autoCropRegion = {
                x: cropResult.region.x,
                y: cropResult.region.y,
                width: cropResult.region.width,
                height: cropResult.region.height,
                confidence: cropResult.confidence,
                method: cropResult.method
              }
              
              resolve()
            }
            img.onerror = reject
            img.src = thumbnailDataUrl!
          })
        }
      } catch (error) {
        console.warn('Failed to detect auto-crop region:', error)
      }
    }
    
    // Detect faces if enabled and thumbnails were generated (client-side only)
    console.log('Face detection check:', {
      detectFacesEnabled: options.detectFaces,
      hasThumbnail: !!thumbnailDataUrl,
      isClient: typeof window !== 'undefined',
      fileName: fileData.name
    })
    
    if (options.detectFaces && thumbnailDataUrl && typeof window !== 'undefined') {
      console.log('Starting face detection for', fileData.name)
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = async () => {
              canvas.width = img.width
              canvas.height = img.height
              ctx.drawImage(img, 0, 0)
              
              const imageData = ctx.getImageData(0, 0, img.width, img.height)
              
              try {
                // Initialize face detection worker if not already done
                if (!faceDetectionWorkerManager.isAvailable()) {
                  await faceDetectionWorkerManager.initialize()
                }
                
                const faceResult = await faceDetectionWorkerManager.detectFaces(imageData, {
                  confidenceThreshold: 0.5, // Lowered threshold for better sensitivity
                  includeEyeState: true,
                  calculateFocusScore: true
                })
                
                detectedFaces = faceResult.faces
                console.log(`Face detection for ${fileData.name}:`, {
                  facesDetected: detectedFaces.length,
                  imageSize: `${imageData.width}x${imageData.height}`,
                  processingTime: faceResult.processingTime,
                  detector: faceResult.detectorUsed,
                  faces: detectedFaces.map(f => ({
                    confidence: f.confidence,
                    bbox: f.bbox,
                    eyeState: f.eyeState
                  }))
                })
              } catch (faceError) {
                console.error('Face detection failed for', fileData.name, ':', faceError)
                console.error('Face detection error stack:', faceError instanceof Error ? faceError.stack : 'No stack trace')
              }
              
              resolve()
            }
            img.onerror = reject
            img.src = thumbnailDataUrl!
          })
        }
      } catch (error) {
        console.warn('Failed to detect faces:', error)
      }
    }
    
    const imageRec: ImageRec = {
      id: crypto.randomUUID(),
      fileName: fileData.name,
      filePath: file.path,
      fileSize: fileData.size,
      fileType: fileData.type || 'unknown',
      fileHandle: file.handle,
      metadata,
      thumbnailDataUrl,
      previewDataUrl,
      autoCropRegion,
      faces: detectedFaces || [],
      rating: 0,
      flag: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      importSessionId: sessionId
    }
    
    await db.images.add(imageRec)
  }
  
  private arrayBufferToDataUrl(arrayBuffer: Uint8Array, mimeType: string): string {
    const blob = new Blob([arrayBuffer], { type: mimeType })
    return URL.createObjectURL(blob)
  }

  private getMimeTypeFromExtension(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop()
    const mimeTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
      'raw': 'image/x-canon-raw',
      'cr2': 'image/x-canon-cr2',
      'cr3': 'image/x-canon-cr3',
      'nef': 'image/x-nikon-nef',
      'arw': 'image/x-sony-arw',
      'orf': 'image/x-olympus-orf',
      'rw2': 'image/x-panasonic-rw2',
      'dng': 'image/x-adobe-dng',
      'raf': 'image/x-fuji-raf',
      'srw': 'image/x-samsung-srw',
      'pef': 'image/x-pentax-pef',
      'x3f': 'image/x-sigma-x3f'
    }
    return ext ? (mimeTypeMap[ext] || 'application/octet-stream') : 'application/octet-stream'
  }
  
  abort() {
    this.abortController?.abort()
  }
}

export const importer = new ImageImporter()