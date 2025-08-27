'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Flag, X, Eye, EyeOff, AlertCircle, Crop } from 'lucide-react'
import { ImageRec } from '@/lib/types'
import { RatingControls } from './rating-controls'

interface FilmstripProps {
  images: ImageRec[]
  selectedImageId?: string
  onImageSelect: (imageId: string) => void
  onUpdate?: () => void
  showMetadata?: boolean
  className?: string
}

export function Filmstrip({
  images,
  selectedImageId,
  onImageSelect,
  onUpdate,
  showMetadata = false,
  className = ''
}: FilmstripProps) {
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (selectedImageId && filmstripRef.current) {
      const selectedElement = filmstripRef.current.querySelector(
        `[data-image-id="${selectedImageId}"]`
      )
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        })
      }
    }
  }, [selectedImageId])
  
  const getStatusIcon = (image: ImageRec) => {
    if (image.flag === 'pick') return <Flag className="w-3 h-3 text-green-400" />
    if (image.flag === 'reject') return <X className="w-3 h-3 text-red-400" />
    if (image.blurScore && image.blurScore > 100) return <AlertCircle className="w-3 h-3 text-orange-400" />
    if (image.faces?.some(f => f.eyeState?.left === 'closed' || f.eyeState?.right === 'closed')) {
      return <EyeOff className="w-3 h-3 text-yellow-400" />
    }
    if (image.autoCropRegion && image.autoCropRegion.confidence > 0.7) {
      return <Crop className="w-3 h-3 text-blue-400" />
    }
    return null
  }
  
  return (
    <div className={`bg-card border-t border-border ${className}`}>
      <div
        ref={filmstripRef}
        className="flex gap-2 p-4 overflow-x-auto no-scrollbar"
      >
        <AnimatePresence>
          {images.map((image, index) => {
            const isSelected = image.id === selectedImageId
            const isHovered = image.id === hoveredImageId
            
            return (
              <motion.div
                key={image.id}
                data-image-id={image.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="flex-shrink-0 relative group"
                onMouseEnter={() => setHoveredImageId(image.id)}
                onMouseLeave={() => setHoveredImageId(null)}
              >
                <div
                  onClick={() => onImageSelect(image.id)}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-primary shadow-lg scale-105'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {image.thumbnailDataUrl ? (
                    <img
                      src={image.thumbnailDataUrl}
                      alt={image.fileName}
                      className="w-20 h-20 object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No preview</span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="absolute top-1 right-1 flex gap-1">
                    {getStatusIcon(image)}
                    {image.groupId && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full border border-white" />
                    )}
                  </div>
                  
                  {image.rating > 0 && (
                    <div className="absolute bottom-1 left-1 flex">
                      {Array.from({ length: image.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  )}
                  
                  {showMetadata && (isSelected || isHovered) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-2"
                    >
                      <p className="truncate font-medium">{image.fileName}</p>
                      {image.metadata.dateTime && (
                        <p className="opacity-75">
                          {new Date(image.metadata.dateTime).toLocaleDateString()}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>
                
                {(isSelected || isHovered) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-10"
                  >
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-2">
                      <RatingControls
                        image={image}
                        onUpdate={onUpdate}
                        className="scale-75 origin-center"
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      
      {images.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No images to display</p>
        </div>
      )}
    </div>
  )
}