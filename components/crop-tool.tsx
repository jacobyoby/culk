'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crop, Download, RotateCcw, Scissors, Sparkles } from 'lucide-react'
import { ImageRec } from '@/lib/types'
import { detectAutoCropRegion, applyCrop, CropRegion } from '@/lib/utils/crop'
import { faceDetectionWorkerManager } from '@/lib/ml/face-detection-worker-manager'

interface CropToolProps {
  image: ImageRec
  isOpen: boolean
  onClose: () => void
  onCropApplied?: (croppedBlob: Blob, newPreviewUrl: string) => void
  onImageUpdate?: (updatedImage: Partial<ImageRec>) => void
}

export function CropTool({ image, isOpen, onClose, onCropApplied, onImageUpdate }: CropToolProps) {
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoCropSuggestions, setAutoCropSuggestions] = useState<Array<{
    region: CropRegion
    confidence: number
    method: string
  }>>([])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (isOpen && image.previewDataUrl) {
      loadImage()
    }
  }, [isOpen, image.previewDataUrl])
  
  const loadImage = async () => {
    if (!image.previewDataUrl || !canvasRef.current) return
    
    const img = new Image()
    img.onload = async () => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      // Initialize crop to full image
      setCropRegion({
        x: 0,
        y: 0,
        width: img.width,
        height: img.height
      })
      
      // Generate auto-crop suggestions
      generateAutoCropSuggestions(ctx.getImageData(0, 0, img.width, img.height))
    }
    
    img.src = image.previewDataUrl
    // Update ref (create new ref object to avoid readonly error)
    imageRef.current = img
  }
  
  const generateAutoCropSuggestions = async (imageData: ImageData) => {
    const methods: Array<'edge-detection' | 'content-aware' | 'golden-ratio' | 'center'> = [
      'edge-detection',
      'content-aware', 
      'golden-ratio',
      'center'
    ]
    
    const suggestions = methods.map(method => {
      const result = detectAutoCropRegion(imageData, { method })
      return {
        region: result.region,
        confidence: result.confidence,
        method: result.method
      }
    })

    // Add face-aware crop suggestions if faces are detected
    if (image.faces && image.faces.length > 0) {
      try {
        const faceAwareCrop = generateFaceAwareCrop(imageData, image.faces)
        suggestions.push(faceAwareCrop)
        console.log('Added face-aware crop suggestion:', faceAwareCrop)
      } catch (error) {
        console.warn('Failed to generate face-aware crop:', error)
      }
    } else {
      // Try to detect faces for cropping if not already detected
      try {
        const faceResult = await faceDetectionWorkerManager.detectFaces(imageData, {
          confidenceThreshold: 0.6
        })
        
        if (faceResult.faces.length > 0) {
          const faceAwareCrop = generateFaceAwareCrop(imageData, faceResult.faces)
          suggestions.push(faceAwareCrop)
          console.log('Generated face-aware crop from new detection:', faceAwareCrop)
        }
      } catch (error) {
        console.warn('Face detection failed for crop suggestions:', error)
      }
    }
    
    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence)
    setAutoCropSuggestions(suggestions)
    
    // Use the best suggestion if user's stored auto-crop exists
    if (image.autoCropRegion && image.autoCropRegion.confidence > 0.6) {
      setCropRegion({
        x: image.autoCropRegion.x,
        y: image.autoCropRegion.y,
        width: image.autoCropRegion.width,
        height: image.autoCropRegion.height
      })
    }
  }

  const generateFaceAwareCrop = (imageData: ImageData, faces: ImageRec['faces']) => {
    if (!faces || faces.length === 0) {
      throw new Error('No faces provided for face-aware crop')
    }

    const { width, height } = imageData
    
    // Calculate bounding box around all faces
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
    
    faces.forEach(face => {
      const faceX = (face.bbox.x / 100) * width
      const faceY = (face.bbox.y / 100) * height  
      const faceWidth = (face.bbox.width / 100) * width
      const faceHeight = (face.bbox.height / 100) * height
      
      minX = Math.min(minX, faceX)
      minY = Math.min(minY, faceY)
      maxX = Math.max(maxX, faceX + faceWidth)
      maxY = Math.max(maxY, faceY + faceHeight)
    })
    
    // Add padding around faces (30% on each side)
    const padding = 0.3
    const faceWidth = maxX - minX
    const faceHeight = maxY - minY
    const paddingX = faceWidth * padding
    const paddingY = faceHeight * padding
    
    // Expand crop region with padding
    const cropX = Math.max(0, minX - paddingX)
    const cropY = Math.max(0, minY - paddingY)
    const cropRight = Math.min(width, maxX + paddingX)
    const cropBottom = Math.min(height, maxY + paddingY)
    const cropWidth = cropRight - cropX
    const cropHeight = cropBottom - cropY
    
    // Calculate confidence based on face coverage and composition
    const faceCoverage = (faceWidth * faceHeight) / (cropWidth * cropHeight)
    const aspectRatio = cropWidth / cropHeight
    const aspectScore = 1 - Math.abs(aspectRatio - 1.5) / 1.5 // Prefer 3:2 aspect ratio
    const confidence = Math.min(0.95, faceCoverage * 0.6 + aspectScore * 0.4)
    
    return {
      region: {
        x: Math.floor(cropX),
        y: Math.floor(cropY), 
        width: Math.floor(cropWidth),
        height: Math.floor(cropHeight)
      },
      confidence,
      method: `face-aware (${faces.length} ${faces.length === 1 ? 'face' : 'faces'})`
    }
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || !cropRegion) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    setIsDragging(true)
    setDragStart({ x, y })
    setCropRegion({ x, y, width: 0, height: 0 })
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    setCropRegion({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y)
    })
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  const applySuggestion = (suggestion: typeof autoCropSuggestions[0]) => {
    setCropRegion(suggestion.region)
  }
  
  const handleCrop = async () => {
    if (!cropRegion) return
    
    setIsProcessing(true)
    try {
      let croppedBlob: Blob
      
      // Try to use FileHandle first (if we have recent user activation)
      if (image.fileHandle) {
        try {
          const file = await image.fileHandle.getFile()
          croppedBlob = await applyCrop(file, cropRegion)
        } catch (fileError) {
          console.warn('FileHandle access failed, using preview fallback:', fileError)
          // Fallback to using the preview image
          croppedBlob = await applyCropFromPreview(image.previewDataUrl!, cropRegion)
        }
      } else if (image.previewDataUrl) {
        // Use preview if no file handle
        croppedBlob = await applyCropFromPreview(image.previewDataUrl, cropRegion)
      } else {
        throw new Error('No image source available for cropping')
      }
      
      // Create new preview URL from cropped image
      const newPreviewUrl = URL.createObjectURL(croppedBlob)
      
      // Update image record with new dimensions and crop info
      const updatedImage: Partial<ImageRec> = {
        previewDataUrl: newPreviewUrl,
        autoCropRegion: {
          x: cropRegion.x,
          y: cropRegion.y,
          width: cropRegion.width,
          height: cropRegion.height,
          confidence: 1.0, // User-applied crop has max confidence
          method: 'user-applied'
        }
      }
      
      // Notify parent components
      onCropApplied?.(croppedBlob, newPreviewUrl)
      onImageUpdate?.(updatedImage)
      
      console.log('Crop applied successfully:', {
        originalSize: `${image.metadata.width}x${image.metadata.height}`,
        cropRegion,
        newPreview: newPreviewUrl
      })
      
    } catch (error) {
      console.error('Failed to apply crop:', error)
      alert('Failed to apply crop: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
  }

  const applyCropFromPreview = async (previewUrl: string, cropRegion: CropRegion): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      img.onload = () => {
        canvas.width = cropRegion.width
        canvas.height = cropRegion.height
        
        ctx.drawImage(
          img,
          cropRegion.x,
          cropRegion.y,
          cropRegion.width,
          cropRegion.height,
          0,
          0,
          cropRegion.width,
          cropRegion.height
        )
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create cropped image blob'))
            }
          },
          'image/jpeg',
          0.9
        )
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load preview image'))
      }
      
      img.src = previewUrl
    })
  }
  
  const handleReset = () => {
    if (canvasRef.current) {
      setCropRegion({
        x: 0,
        y: 0,
        width: canvasRef.current.width,
        height: canvasRef.current.height
      })
    }
  }
  
  const downloadCrop = async () => {
    if (!cropRegion) return
    
    setIsProcessing(true)
    try {
      let croppedBlob: Blob
      
      // Try to use FileHandle first (if we have recent user activation)
      if (image.fileHandle) {
        try {
          const file = await image.fileHandle.getFile()
          croppedBlob = await applyCrop(file, cropRegion)
        } catch (fileError) {
          console.warn('FileHandle access failed for download, using preview fallback:', fileError)
          // Fallback to using the preview image
          croppedBlob = await applyCropFromPreview(image.previewDataUrl!, cropRegion)
        }
      } else if (image.previewDataUrl) {
        // Use preview if no file handle
        croppedBlob = await applyCropFromPreview(image.previewDataUrl, cropRegion)
      } else {
        throw new Error('No image source available for cropping')
      }
      
      // Create download link
      const url = URL.createObjectURL(croppedBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cropped_${image.fileName}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download crop:', error)
      alert('Failed to download crop: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-xl border border-border p-6 max-w-6xl max-h-[90vh] overflow-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Crop className="w-5 h-5" />
            Crop Image
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            ×
          </button>
        </div>
        
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div
              ref={containerRef}
              className="relative bg-black rounded-lg overflow-hidden"
              style={{ maxHeight: '60vh' }}
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              
              {cropRegion && (
                <div
                  className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
                  style={{
                    left: `${(cropRegion.x / (canvasRef.current?.width || 1)) * 100}%`,
                    top: `${(cropRegion.y / (canvasRef.current?.height || 1)) * 100}%`,
                    width: `${(cropRegion.width / (canvasRef.current?.width || 1)) * 100}%`,
                    height: `${(cropRegion.height / (canvasRef.current?.height || 1)) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Auto Crop Suggestions
                </h3>
                <button
                  onClick={() => autoCropSuggestions.length > 0 && applySuggestion(autoCropSuggestions[0])}
                  disabled={autoCropSuggestions.length === 0}
                  className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  Apply Best
                </button>
              </div>
              <div className="space-y-2">
                {autoCropSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => applySuggestion(suggestion)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium capitalize">
                      {suggestion.method.replace('-', ' ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Confidence: {Math.round(suggestion.confidence * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.region.width} × {suggestion.region.height}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {cropRegion && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Crop Info</h4>
                <div className="text-sm space-y-1">
                  <div>Position: {cropRegion.x}, {cropRegion.y}</div>
                  <div>Size: {cropRegion.width} × {cropRegion.height}</div>
                  <div>
                    Aspect: {(cropRegion.width / cropRegion.height).toFixed(2)}:1
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              
              <button
                onClick={downloadCrop}
                disabled={!cropRegion || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download Crop
              </button>
              
              <button
                onClick={handleCrop}
                disabled={!cropRegion || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Scissors className="w-4 h-4" />
                {isProcessing ? 'Processing...' : 'Apply Crop'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}