'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Crop, Check, Sliders } from 'lucide-react'
import { ImageRec, ImageAdjustments } from '@/lib/types'
import { getImageOrientation } from '@/lib/utils/image'
import { adjustmentsToCSSFilter, getDefaultAdjustments } from '@/lib/utils/adjustments'
import { useImageAdjustments } from '@/lib/contexts/image-adjustments-context'
import { CropTool } from './crop-tool'
import { AdjustmentPanel } from './adjustment-panel'
import { useImageActions } from '@/lib/store/hooks'
import { ImageProcessingErrorBoundary } from './error-boundary'
import { IconButton } from '@/components/ui/button'

interface ImageViewerProps {
  image: ImageRec
  showMetadata?: boolean
  showFaceBoxes?: boolean
  showCropTool?: boolean
  showAdjustments?: boolean
  onToggleCropTool?: () => void
  onToggleAdjustments?: () => void
  className?: string
}


export function ImageViewer({
  image,
  showMetadata = false,
  showFaceBoxes = false,
  showCropTool = false,
  showAdjustments = false,
  onToggleCropTool,
  onToggleAdjustments,
  className = ''
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(image.previewDataUrl)
  const [currentCropRegion, setCurrentCropRegion] = useState(image.autoCropRegion)
  
  // Use context for adjustment management
  const { getAdjustments, setAdjustments: setContextAdjustments, getActivePreset, setActivePreset } = useImageAdjustments()
  
  // Get stored adjustments for this image
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(() => getAdjustments(image.id))
  
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  
  const { updateCrop } = useImageActions()
  const orientation = getImageOrientation(image.metadata.orientation)
  
  // Update preview URL and load adjustments when image prop changes
  useEffect(() => {
    setCurrentPreviewUrl(image.previewDataUrl)
    setCurrentCropRegion(image.autoCropRegion)
    // Load stored adjustments for this image or use defaults
    const storedAdjustments = getAdjustments(image.id)
    setAdjustments(storedAdjustments)
  }, [image.id, image.previewDataUrl, image.autoCropRegion, getAdjustments])
  
  // Save adjustments when they change
  useEffect(() => {
    setContextAdjustments(image.id, adjustments)
  }, [image.id, adjustments, setContextAdjustments])
  
  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      // Only revoke if it's a blob URL we created (not the original preview)
      if (currentPreviewUrl && currentPreviewUrl.startsWith('blob:') && currentPreviewUrl !== image.previewDataUrl) {
        URL.revokeObjectURL(currentPreviewUrl)
      }
    }
  }, [currentPreviewUrl, image.previewDataUrl])
  
  // Handle zoom on wheel, but only when hovering over the image
  const [isHoveringImage, setIsHoveringImage] = useState(false)
  
  useEffect(() => {
    if (!isHoveringImage) return
    
    const handleNativeWheel = (e: WheelEvent) => {
      // Only prevent scroll when actually hovering the image area
      e.preventDefault()
      e.stopPropagation()
      
      // Handle zoom with native event - smaller delta for smoother zoom
      const zoomSpeed = 0.002
      const delta = 1 - (e.deltaY * zoomSpeed)
      setZoom(prev => {
        const newZoom = prev * delta
        // Clamp between 0.1 and 10 for better range
        return Math.max(0.1, Math.min(10, newZoom))
      })
    }
    
    // Add listener to window to catch all wheel events when hovering
    window.addEventListener('wheel', handleNativeWheel, { passive: false })
    
    return () => {
      window.removeEventListener('wheel', handleNativeWheel)
    }
  }, [isHoveringImage])
  
  
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = { 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    })
  }
  
  const handleMouseUp = () => {
    isDragging.current = false
  }
  
  const resetView = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }
  
  const rotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }
  
  return (
    <div className={`relative bg-black overflow-hidden ${className}`} ref={containerRef}>
      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="absolute top-4 left-4 z-10 px-2 py-1 bg-black/70 rounded text-white text-sm">
          {Math.round(zoom * 100)}%
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <IconButton
          icon={ZoomIn}
          onClick={() => setZoom(prev => Math.min(10, prev * 1.5))}
          variant="glass"
          tooltip={`Zoom In (${Math.round(zoom * 100)}%)`}
        />
        <IconButton
          icon={ZoomOut}
          onClick={() => setZoom(prev => Math.max(0.1, prev * 0.67))}
          variant="glass"
          tooltip={`Zoom Out (${Math.round(zoom * 100)}%)`}
        />
        <IconButton
          icon={RotateCw}
          onClick={rotate}
          variant="glass"
          tooltip="Rotate"
        />
        <IconButton
          icon={Maximize2}
          onClick={resetView}
          variant="glass"
          tooltip="Reset View"
        />
        <IconButton
          icon={Crop}
          onClick={onToggleCropTool}
          variant={currentCropRegion ? 'success' : 'glass'}
          tooltip={currentCropRegion ? 'Crop Applied - Click to Modify' : 'Crop Image'}
          className="relative"
        >
          {currentCropRegion && (
            <Check className="w-3 h-3 text-green-400 absolute top-0 right-0 bg-black/50 rounded-full p-0.5" />
          )}
        </IconButton>
        <IconButton
          icon={Sliders}
          onClick={onToggleAdjustments}
          variant={Object.values(adjustments).some(val => val !== 0) ? 'glassActive' : 'glass'}
          tooltip={Object.values(adjustments).some(val => val !== 0) ? 'Adjustments Applied - Click to Modify' : 'Open Adjustments Panel'}
          badge={Object.values(adjustments).some(val => val !== 0)}
        />
      </div>
      
      <div
        className="relative w-full h-full flex items-center justify-center"
        onMouseLeave={() => handleMouseUp()}
        onMouseUp={handleMouseUp}
      >
        <ImageProcessingErrorBoundary 
          imageName={image.fileName}
          onRetry={() => {
            // Reset view and force reload
            resetView()
            setCurrentPreviewUrl(image.previewDataUrl)
          }}
        >
          <motion.div
            className="cursor-move"
            animate={{
              scale: zoom,
              x: position.x,
              y: position.y,
              rotate: rotation
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ transform: orientation.transform }}
            onMouseEnter={() => setIsHoveringImage(true)}
            onMouseLeave={() => {
              setIsHoveringImage(false)
              handleMouseUp()
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
          {currentPreviewUrl ? (
            <img
              src={currentPreviewUrl}
              alt={image.fileName}
              className="max-w-full max-h-full object-contain"
              style={{ filter: adjustmentsToCSSFilter(adjustments) }}
              draggable={false}
              key={currentPreviewUrl} // Force re-render when URL changes
            />
          ) : (
            <div className="w-96 h-96 bg-gray-800 flex items-center justify-center">
              <p className="text-gray-400">No preview available</p>
            </div>
          )}
          
          {(() => {
            console.log('Image viewer face data:', {
              showFaceBoxes,
              imageName: image.fileName,
              hasFaces: !!image.faces,
              faceCount: image.faces?.length || 0,
              faces: image.faces
            })
            return showFaceBoxes && image.faces && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {image.faces.map(face => (
                  <g key={face.id}>
                    <rect
                      x={`${face.bbox.x}%`}
                      y={`${face.bbox.y}%`}
                      width={`${face.bbox.width}%`}
                      height={`${face.bbox.height}%`}
                      fill="none"
                      stroke={face.eyeState?.left === 'closed' || face.eyeState?.right === 'closed' ? '#ef4444' : '#10b981'}
                      strokeWidth="2"
                    />
                    {face.eyeState && (
                      <text
                        x={`${face.bbox.x}%`}
                        y={`${face.bbox.y - 1}%`}
                        fill="white"
                        fontSize="12"
                        className="font-semibold"
                      >
                        {face.eyeState.left === 'open' && face.eyeState.right === 'open' ? '👁️' : '😴'}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            )
          })()}
          </motion.div>
        </ImageProcessingErrorBoundary>
      </div>
      
      {showMetadata && (
        <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 text-white text-sm">
          <p className="font-semibold">{image.fileName}</p>
          {image.metadata.dateTime && (
            <p>{new Date(image.metadata.dateTime).toLocaleString()}</p>
          )}
          {image.metadata.model && <p>{image.metadata.model}</p>}
          {image.metadata.lens && <p>{image.metadata.lens}</p>}
          <div className="flex gap-2 mt-1">
            {image.metadata.focalLength && <span>{image.metadata.focalLength}mm</span>}
            {image.metadata.aperture && <span>f/{image.metadata.aperture}</span>}
            {image.metadata.shutterSpeed && <span>{image.metadata.shutterSpeed}</span>}
            {image.metadata.iso && <span>ISO {image.metadata.iso}</span>}
          </div>
        </div>
      )}
      
      <CropTool
        image={{...image, previewDataUrl: currentPreviewUrl, autoCropRegion: currentCropRegion}}
        isOpen={showCropTool}
        onClose={() => onToggleCropTool?.()}
        onCropApplied={(blob, newPreviewUrl) => {
          console.log('Crop applied:', blob.size, 'bytes', 'New preview:', newPreviewUrl)
          // Update the local preview state immediately
          setCurrentPreviewUrl(newPreviewUrl)
          onToggleCropTool?.()
        }}
        onImageUpdate={async (updatedImage) => {
          console.log('Image updated with crop info:', updatedImage)
          // Update local state immediately for responsive UI
          if (updatedImage.previewDataUrl) {
            setCurrentPreviewUrl(updatedImage.previewDataUrl)
          }
          if (updatedImage.autoCropRegion) {
            setCurrentCropRegion(updatedImage.autoCropRegion)
          }
          
          // Then save to database
          try {
            await updateCrop(image.id, updatedImage)
            console.log('Crop information saved to database')
          } catch (error) {
            console.error('Failed to save crop information:', error)
          }
        }}
      />
      
      <AdjustmentPanel
        adjustments={adjustments}
        onAdjustmentsChange={setAdjustments}
        image={image}
        isOpen={showAdjustments}
        activePreset={getActivePreset(image.id)}
        onPresetChange={(preset) => {
          setActivePreset(image.id, preset)
        }}
        onToggle={() => {
          console.log('AdjustmentPanel onToggle called')
          onToggleAdjustments?.()
        }}
        onClose={() => {
          console.log('AdjustmentPanel onClose called')
          // For closing, we need to explicitly set showAdjustments to false
          // Since we can't directly control parent state, we'll use the toggle if it's currently open
          if (showAdjustments) {
            onToggleAdjustments?.()
          }
        }}
      />
    </div>
  )
}