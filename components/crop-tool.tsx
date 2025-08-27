'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crop, Download, RotateCcw, Scissors, Sparkles } from 'lucide-react'
import { ImageRec } from '@/lib/types'
import { detectAutoCropRegion, applyCrop, CropRegion } from '@/lib/utils/crop'
import { Button, LoadingButton } from '@/components/ui/button'
import { createCanvasFromImage, canvasToBlob, downloadBlob, getImageData } from '@/lib/utils/canvas'
import { getFacesForImage, generateFaceAwareCrop } from '@/lib/utils/face-detection'
import { withImageProcessingErrorHandling, withFileErrorHandling } from '@/lib/utils/error-handling'

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
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (imageRef.current) {
        imageRef.current.onload = null
        imageRef.current.onerror = null
        imageRef.current = null
      }
    }
  }, [isOpen, image.previewDataUrl])
  
  const loadImage = async () => {
    if (!image.previewDataUrl || !canvasRef.current) return
    
    const result = await withImageProcessingErrorHandling(async () => {
      const { canvas: sourceCanvas, cleanup } = await createCanvasFromImage(image.previewDataUrl!)
      
      try {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Could not get canvas context')
        
        canvas.width = sourceCanvas.width
        canvas.height = sourceCanvas.height
        ctx.drawImage(sourceCanvas, 0, 0)
        
        // Initialize crop to full image
        setCropRegion({
          x: 0,
          y: 0,
          width: sourceCanvas.width,
          height: sourceCanvas.height
        })
        
        // Generate auto-crop suggestions
        const imageData = getImageData(sourceCanvas)
        await generateAutoCropSuggestions(imageData)
      } finally {
        cleanup()
      }
    }, 'Load image for cropping')
    
    if (!result) {
      console.error('Failed to load image for cropping')
    }
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

    // Add face-aware crop suggestions
    try {
      const faces = await getFacesForImage(image, { confidenceThreshold: 0.6 })
      
      if (faces && faces.length > 0) {
        const faceAwareCrop = generateFaceAwareCrop(
          imageData.width,
          imageData.height,
          faces
        )
        suggestions.push({
          region: faceAwareCrop,
          confidence: faceAwareCrop.confidence,
          method: faceAwareCrop.method
        })
        console.log('Added face-aware crop suggestion:', faceAwareCrop)
      }
    } catch (error) {
      console.warn('Failed to generate face-aware crop suggestions:', error)
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
    
    const result = await withFileErrorHandling(
      async () => {
        if (image.fileHandle) {
          const file = await image.fileHandle.getFile()
          return await applyCrop(file, cropRegion)
        }
        throw new Error('No file handle available')
      },
      image.fileName,
      async () => {
        if (image.previewDataUrl) {
          return await applyCropFromPreview(image.previewDataUrl, cropRegion)
        }
        throw new Error('No image source available for cropping')
      }
    )
    
    if (result) {
      try {
        // Create new preview URL from cropped image
        const newPreviewUrl = URL.createObjectURL(result)
        
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
        onCropApplied?.(result, newPreviewUrl)
        onImageUpdate?.(updatedImage)
        
        console.log('Crop applied successfully:', {
          originalSize: `${image.metadata.width}x${image.metadata.height}`,
          cropRegion,
          newPreview: newPreviewUrl
        })
      } catch (error) {
        console.error('Failed to process cropped image:', error)
        alert('Failed to process cropped image: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    } else {
      alert('Failed to apply crop. Please try again.')
    }
    
    setIsProcessing(false)
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
    
    const result = await withFileErrorHandling(
      async () => {
        if (image.fileHandle) {
          const file = await image.fileHandle.getFile()
          return await applyCrop(file, cropRegion)
        }
        throw new Error('No file handle available')
      },
      image.fileName,
      async () => {
        if (image.previewDataUrl) {
          return await applyCropFromPreview(image.previewDataUrl, cropRegion)
        }
        throw new Error('No image source available for cropping')
      }
    )
    
    if (result) {
      downloadBlob(result, `cropped_${image.fileName}`)
    } else {
      alert('Failed to download crop. Please try again.')
    }
    
    setIsProcessing(false)
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
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="hover:bg-muted"
          >
            ×
          </Button>
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
                <Button
                  onClick={() => autoCropSuggestions.length > 0 && applySuggestion(autoCropSuggestions[0])}
                  disabled={autoCropSuggestions.length === 0}
                  size="sm"
                  variant="default"
                >
                  Apply Best
                </Button>
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
              <Button
                onClick={handleReset}
                variant="secondary"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              
              <LoadingButton
                onClick={downloadCrop}
                disabled={!cropRegion}
                loading={isProcessing}
                loadingText="Processing..."
                icon={Download}
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Download Crop
              </LoadingButton>
              
              <LoadingButton
                onClick={handleCrop}
                disabled={!cropRegion}
                loading={isProcessing}
                loadingText="Processing..."
                icon={Scissors}
                variant="default"
              >
                Apply Crop
              </LoadingButton>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}