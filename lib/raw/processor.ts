import { ImageRec, ImageMetadata } from '../types'

export interface RawProcessorOptions {
  brightness?: number
  whiteBalance?: 'auto' | 'camera' | 'daylight' | 'custom'
  colorSpace?: 'sRGB' | 'AdobeRGB' | 'ProPhotoRGB'
  quality?: number
  size?: { width: number; height: number }
}

export interface RawProcessingResult {
  imageData: Uint8Array
  metadata: ImageMetadata
  width: number
  height: number
  format: 'jpeg' | 'png'
}

export class RawProcessor {
  private libRaw: any = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      const { default: LibRaw } = await import('libraw-wasm')
      this.libRaw = new LibRaw()
      this.isInitialized = true
    } catch (error) {
      console.warn('LibRaw WASM not available, RAW processing disabled:', error)
      throw new Error('Failed to initialize RAW processor')
    }
  }

  async processRawFile(
    fileBuffer: ArrayBuffer,
    options: RawProcessorOptions = {}
  ): Promise<RawProcessingResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.libRaw) {
      throw new Error('RAW processor not initialized')
    }

    const {
      brightness = 0,
      whiteBalance = 'auto',
      colorSpace = 'sRGB',
      quality = 90,
      size
    } = options

    try {
      const uint8Array = new Uint8Array(fileBuffer)
      
      await this.libRaw.open(uint8Array, {
        brightness,
        wb: this.mapWhiteBalance(whiteBalance),
        colorSpace: this.mapColorSpace(colorSpace),
        quality
      })

      const metadata = await this.libRaw.metadata()
      const imageData = await this.libRaw.imageData()
      
      let processedData = imageData
      let width = metadata.width
      let height = metadata.height

      if (size && (size.width !== width || size.height !== height)) {
        const resizeResult = await this.resizeImage(imageData, width, height, size.width, size.height)
        processedData = resizeResult.data
        width = size.width
        height = size.height
      }

      return {
        imageData: processedData,
        metadata: this.convertMetadata(metadata),
        width,
        height,
        format: 'jpeg'
      }
    } catch (error) {
      throw new Error(`RAW processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      try {
        await this.libRaw.close()
      } catch (closeError) {
        console.warn('Error closing RAW processor:', closeError)
      }
    }
  }

  async generatePreview(
    fileBuffer: ArrayBuffer,
    maxWidth: number = 1920,
    maxHeight: number = 1080
  ): Promise<RawProcessingResult> {
    return this.processRawFile(fileBuffer, {
      size: { width: maxWidth, height: maxHeight },
      quality: 85
    })
  }

  async generateThumbnail(
    fileBuffer: ArrayBuffer,
    width: number = 200,
    height: number = 200
  ): Promise<RawProcessingResult> {
    return this.processRawFile(fileBuffer, {
      size: { width, height },
      quality: 75
    })
  }

  private mapWhiteBalance(wb: string): number {
    switch (wb) {
      case 'auto': return 0
      case 'camera': return 1
      case 'daylight': return 2
      default: return 0
    }
  }

  private mapColorSpace(colorSpace: string): number {
    switch (colorSpace) {
      case 'sRGB': return 1
      case 'AdobeRGB': return 2
      case 'ProPhotoRGB': return 3
      default: return 1
    }
  }

  private async resizeImage(
    imageData: Uint8Array,
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): Promise<{ data: Uint8Array; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      const img = new Image()
      img.onload = () => {
        const aspectRatio = originalWidth / originalHeight
        let newWidth = targetWidth
        let newHeight = targetHeight

        if (targetWidth / targetHeight > aspectRatio) {
          newWidth = targetHeight * aspectRatio
        } else {
          newHeight = targetWidth / aspectRatio
        }

        canvas.width = newWidth
        canvas.height = newHeight
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                data: new Uint8Array(reader.result as ArrayBuffer),
                width: newWidth,
                height: newHeight
              })
            }
            reader.readAsArrayBuffer(blob)
          } else {
            reject(new Error('Failed to resize image'))
          }
        }, 'image/jpeg')
      }
      
      img.onerror = () => reject(new Error('Failed to load image for resizing'))
      
      const blob = new Blob([imageData])
      img.src = URL.createObjectURL(blob)
    })
  }

  private convertMetadata(rawMetadata: any): ImageMetadata {
    return {
      make: rawMetadata.make,
      model: rawMetadata.model,
      lens: rawMetadata.lens,
      dateTime: rawMetadata.datetime ? new Date(rawMetadata.datetime) : undefined,
      orientation: rawMetadata.orientation || 1,
      focalLength: rawMetadata.focal_length,
      aperture: rawMetadata.aperture,
      shutterSpeed: rawMetadata.shutter_speed,
      iso: rawMetadata.iso,
      whiteBalance: rawMetadata.white_balance,
      flash: rawMetadata.flash,
      width: rawMetadata.width,
      height: rawMetadata.height,
      colorSpace: rawMetadata.color_space,
      exposureCompensation: rawMetadata.exposure_compensation,
      meteringMode: rawMetadata.metering_mode,
      exposureMode: rawMetadata.exposure_mode
    }
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

export const rawProcessor = new RawProcessor()