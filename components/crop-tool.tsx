'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crop, Download, RotateCcw, Scissors, Sparkles } from 'lucide-react'
import { ImageRec } from '@/lib/types'
import { detectAutoCropRegion, applyCrop, CropRegion } from '@/lib/utils/crop'

interface CropToolProps {
  image: ImageRec
  isOpen: boolean
  onClose: () => void
  onCropApplied?: (croppedBlob: Blob) => void
}

export function CropTool({ image, isOpen, onClose, onCropApplied }: CropToolProps) {
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
  const imageRef = useRef<HTMLImageElement>(null)
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
    if (!cropRegion || !image.fileHandle) return
    
    setIsProcessing(true)
    try {
      const file = await image.fileHandle.getFile()
      const croppedBlob = await applyCrop(file, cropRegion)
      onCropApplied?.(croppedBlob)
    } catch (error) {
      console.error('Failed to apply crop:', error)
      alert('Failed to apply crop: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
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
    if (!cropRegion || !image.fileHandle) return
    
    setIsProcessing(true)
    try {
      const file = await image.fileHandle.getFile()
      const croppedBlob = await applyCrop(file, cropRegion)
      
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
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Auto Crop Suggestions
              </h3>
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