'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Crop } from 'lucide-react'
import { ImageRec } from '@/lib/types'
import { getImageOrientation } from '@/lib/utils/image'
import { CropTool } from './crop-tool'
import { useImageActions } from '@/lib/store/hooks'

interface ImageViewerProps {
  image: ImageRec
  showMetadata?: boolean
  showFaceBoxes?: boolean
  showCropTool?: boolean
  onToggleCropTool?: () => void
  className?: string
}

export function ImageViewer({
  image,
  showMetadata = false,
  showFaceBoxes = false,
  showCropTool = false,
  onToggleCropTool,
  className = ''
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  
  const { updateCrop } = useImageActions()
  const orientation = getImageOrientation(image.metadata.orientation)
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)))
  }
  
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
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.5, prev * 0.8))}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={rotate}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
          title="Rotate"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={resetView}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={onToggleCropTool}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
          title="Crop Image"
        >
          <Crop className="w-5 h-5 text-white" />
        </button>
      </div>
      
      <div
        className="relative w-full h-full flex items-center justify-center cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <motion.div
          animate={{
            scale: zoom,
            x: position.x,
            y: position.y,
            rotate: rotation
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ transform: orientation.transform }}
        >
          {image.previewDataUrl ? (
            <img
              src={image.previewDataUrl}
              alt={image.fileName}
              className="max-w-full max-h-full object-contain"
              draggable={false}
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
        image={image}
        isOpen={showCropTool}
        onClose={() => onToggleCropTool?.()}
        onCropApplied={(blob, newPreviewUrl) => {
          console.log('Crop applied:', blob.size, 'bytes', 'New preview:', newPreviewUrl)
          onToggleCropTool?.()
        }}
        onImageUpdate={async (updatedImage) => {
          console.log('Image updated with crop info:', updatedImage)
          try {
            await updateCrop(image.id, updatedImage)
            console.log('Crop information saved to database')
          } catch (error) {
            console.error('Failed to save crop information:', error)
          }
        }}
      />
    </div>
  )
}