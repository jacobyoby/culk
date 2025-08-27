import { ImageRec } from '@/lib/types'
import { faceDetectionWorkerManager } from '@/lib/ml/face-detection-worker-manager'
import { createCanvasFromImage, getImageData } from './canvas'

/**
 * Shared face detection utilities to reduce duplication
 */

export interface FaceDetectionOptions {
  confidenceThreshold?: number
  useExisting?: boolean
  forceRedetect?: boolean
}

export interface FaceAwareCropRegion {
  x: number
  y: number
  width: number
  height: number
  confidence: number
  method: string
}

/**
 * Get faces for an image, using existing detection or performing new detection
 */
export async function getFacesForImage(
  image: ImageRec,
  options: FaceDetectionOptions = {}
): Promise<ImageRec['faces']> {
  const {
    confidenceThreshold = 0.6,
    useExisting = true,
    forceRedetect = false
  } = options
  
  // Use existing faces if available and not forcing re-detection
  if (useExisting && !forceRedetect && image.faces && image.faces.length > 0) {
    return image.faces
  }
  
  // Perform face detection if no preview available
  if (!image.previewDataUrl) {
    console.warn('No preview available for face detection')
    return []
  }
  
  try {
    const { canvas, cleanup } = await createCanvasFromImage(image.previewDataUrl)
    
    try {
      const imageData = getImageData(canvas)
      const result = await faceDetectionWorkerManager.detectFaces(imageData, {
        confidenceThreshold
      })
      
      return result.faces
    } finally {
      cleanup()
    }
  } catch (error) {
    console.warn('Face detection failed:', error)
    return []
  }
}

/**
 * Generate face-aware crop region from faces
 */
export function generateFaceAwareCrop(
  imageWidth: number,
  imageHeight: number,
  faces: NonNullable<ImageRec['faces']>,
  padding: number = 0.3
): FaceAwareCropRegion {
  if (!faces || faces.length === 0) {
    throw new Error('No faces provided for face-aware crop')
  }
  
  // Calculate bounding box around all faces
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
  
  faces.forEach(face => {
    const faceX = (face.bbox.x / 100) * imageWidth
    const faceY = (face.bbox.y / 100) * imageHeight  
    const faceWidth = (face.bbox.width / 100) * imageWidth
    const faceHeight = (face.bbox.height / 100) * imageHeight
    
    minX = Math.min(minX, faceX)
    minY = Math.min(minY, faceY)
    maxX = Math.max(maxX, faceX + faceWidth)
    maxY = Math.max(maxY, faceY + faceHeight)
  })
  
  // Add padding around faces
  const faceWidth = maxX - minX
  const faceHeight = maxY - minY
  const paddingX = faceWidth * padding
  const paddingY = faceHeight * padding
  
  // Expand crop region with padding
  const cropX = Math.max(0, minX - paddingX)
  const cropY = Math.max(0, minY - paddingY)
  const cropRight = Math.min(imageWidth, maxX + paddingX)
  const cropBottom = Math.min(imageHeight, maxY + paddingY)
  const cropWidth = cropRight - cropX
  const cropHeight = cropBottom - cropY
  
  // Calculate confidence based on face coverage and composition
  const faceCoverage = (faceWidth * faceHeight) / (cropWidth * cropHeight)
  const aspectRatio = cropWidth / cropHeight
  const aspectScore = 1 - Math.abs(aspectRatio - 1.5) / 1.5 // Prefer 3:2 aspect ratio
  const confidence = Math.min(0.95, faceCoverage * 0.6 + aspectScore * 0.4)
  
  return {
    x: Math.floor(cropX),
    y: Math.floor(cropY), 
    width: Math.floor(cropWidth),
    height: Math.floor(cropHeight),
    confidence,
    method: `face-aware (${faces.length} ${faces.length === 1 ? 'face' : 'faces'})`
  }
}

/**
 * Check if an image has closed eyes
 */
export function hasClosedEyes(image: ImageRec): boolean {
  return image.faces?.some(face => 
    face.eyeState?.left === 'closed' || 
    face.eyeState?.right === 'closed'
  ) ?? false
}

/**
 * Get face detection status for display
 */
export function getFaceDetectionStatus(image: ImageRec): {
  hasFaces: boolean
  faceCount: number
  hasOpenEyes: boolean
  hasClosedEyes: boolean
  status: 'good' | 'warning' | 'none'
} {
  const hasFaces = !!(image.faces && image.faces.length > 0)
  const faceCount = image.faces?.length ?? 0
  
  if (!hasFaces) {
    return {
      hasFaces: false,
      faceCount: 0,
      hasOpenEyes: false,
      hasClosedEyes: false,
      status: 'none'
    }
  }
  
  const hasClosedEyesFaces = hasClosedEyes(image)
  const hasOpenEyesFaces = image.faces!.some(face => 
    face.eyeState?.left === 'open' && face.eyeState?.right === 'open'
  )
  
  return {
    hasFaces,
    faceCount,
    hasOpenEyes: hasOpenEyesFaces,
    hasClosedEyes: hasClosedEyesFaces,
    status: hasClosedEyesFaces ? 'warning' : 'good'
  }
}

/**
 * Face-aware image sorting comparator
 */
export function compareFaceQuality(a: ImageRec, b: ImageRec): number {
  const aStatus = getFaceDetectionStatus(a)
  const bStatus = getFaceDetectionStatus(b)
  
  // Prioritize images with faces
  if (aStatus.hasFaces && !bStatus.hasFaces) return -1
  if (!aStatus.hasFaces && bStatus.hasFaces) return 1
  
  // Among images with faces, prioritize those with open eyes
  if (aStatus.hasFaces && bStatus.hasFaces) {
    if (aStatus.hasOpenEyes && !aStatus.hasClosedEyes && 
        (!bStatus.hasOpenEyes || bStatus.hasClosedEyes)) return -1
    if ((!aStatus.hasOpenEyes || aStatus.hasClosedEyes) &&
        bStatus.hasOpenEyes && !bStatus.hasClosedEyes) return 1
    
    // If eye status is equal, prefer more faces
    return bStatus.faceCount - aStatus.faceCount
  }
  
  return 0
}

/**
 * Check if face detection is needed for an image
 */
export function needsFaceDetection(image: ImageRec): boolean {
  // Need detection if no faces detected yet and we have a preview
  return !image.faces && !!image.previewDataUrl
}

/**
 * Batch process face detection for multiple images
 */
export async function batchDetectFaces(
  images: ImageRec[],
  options: FaceDetectionOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ImageRec['faces']>> {
  const results = new Map<string, ImageRec['faces']>()
  const imagesToProcess = images.filter(img => 
    options.forceRedetect || needsFaceDetection(img)
  )
  
  for (let i = 0; i < imagesToProcess.length; i++) {
    const image = imagesToProcess[i]
    
    try {
      const faces = await getFacesForImage(image, options)
      results.set(image.id, faces)
    } catch (error) {
      console.warn(`Face detection failed for ${image.fileName}:`, error)
      results.set(image.id, [])
    }
    
    onProgress?.(i + 1, imagesToProcess.length)
  }
  
  return results
}