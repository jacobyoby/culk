'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, ThumbsUp, ThumbsDown, Eye, EyeOff, AlertCircle, Crop, Settings2, Grid3X3 } from 'lucide-react'
import { ImageRec, ThumbnailSize } from '@/lib/types'
import { RatingControls } from './rating-controls'

interface FilmstripProps {
  images: ImageRec[]
  selectedImageId?: string
  onImageSelect: (imageId: string) => void
  onUpdate?: () => void
  showMetadata?: boolean
  thumbnailSize?: ThumbnailSize
  onThumbnailSizeChange?: (size: ThumbnailSize) => void
  className?: string
}

const THUMBNAIL_SIZES = {
  small: { width: 'w-16', height: 'h-16', label: 'Small (64px)' },
  medium: { width: 'w-24', height: 'h-24', label: 'Medium (96px)' },
  large: { width: 'w-32', height: 'h-32', label: 'Large (128px)' },
  xlarge: { width: 'w-40', height: 'h-40', label: 'X-Large (160px)' }
} as const

export function Filmstrip({
  images,
  selectedImageId,
  onImageSelect,
  onUpdate,
  showMetadata = false,
  thumbnailSize = 'medium',
  onThumbnailSizeChange,
  className = ''
}: FilmstripProps) {
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null)
  const [showSizeSelector, setShowSizeSelector] = useState(false)
  const filmstripRef = useRef<HTMLDivElement>(null)
  const selectorRef = useRef<HTMLDivElement>(null)
  
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

  // Close size selector when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowSizeSelector(false)
      }
    }

    if (showSizeSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSizeSelector])
  
  const getStatusIcon = (image: ImageRec) => {
    if (image.flag === 'pick') return <ThumbsUp className="w-3 h-3 text-green-400" />
    if (image.flag === 'reject') return <ThumbsDown className="w-3 h-3 text-red-400" />
    if (image.blurScore && image.blurScore > 100) return <AlertCircle className="w-3 h-3 text-orange-400" />
    if (image.faces?.some(f => f.eyeState?.left === 'closed' || f.eyeState?.right === 'closed')) {
      return <EyeOff className="w-3 h-3 text-yellow-400" />
    }
    if (image.autoCropRegion && image.autoCropRegion.confidence > 0.7) {
      return <Crop className="w-3 h-3 text-blue-400" />
    }
    return null
  }
  
  const currentSize = THUMBNAIL_SIZES[thumbnailSize]
  const thumbnailClasses = `${currentSize.width} ${currentSize.height}`
  
  return (
    <div className={`bg-card border-t border-border ${className}`}>
      {/* Filmstrip Header with Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {images.length} images
          </span>
        </div>
        
        {onThumbnailSizeChange && (
          <div className="relative" ref={selectorRef}>
            <button
              onClick={() => setShowSizeSelector(!showSizeSelector)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
              title="Thumbnail Size"
            >
              <Settings2 className="w-4 h-4" />
              {currentSize.label}
            </button>
            
            {showSizeSelector && (
              <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-36">
                {(Object.keys(THUMBNAIL_SIZES) as ThumbnailSize[]).map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      onThumbnailSizeChange(size)
                      setShowSizeSelector(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      size === thumbnailSize ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    {THUMBNAIL_SIZES[size].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div
        ref={filmstripRef}
        className="flex gap-3 p-4 overflow-x-auto no-scrollbar"
        style={{ minHeight: thumbnailSize === 'xlarge' ? '200px' : thumbnailSize === 'large' ? '160px' : thumbnailSize === 'medium' ? '120px' : '88px' }}
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
                      ? image.flag === 'pick' 
                        ? 'border-green-500 shadow-lg shadow-green-500/20 scale-105'
                        : image.flag === 'reject'
                        ? 'border-red-500 shadow-lg shadow-red-500/20 scale-105 opacity-75'
                        : 'border-primary shadow-lg scale-105'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {image.thumbnailDataUrl ? (
                    <img
                      src={image.thumbnailDataUrl}
                      alt={image.fileName}
                      className={`${thumbnailClasses} object-cover`}
                      draggable={false}
                      loading="lazy"
                    />
                  ) : (
                    <div className={`${thumbnailClasses} bg-muted flex items-center justify-center`}>
                      <span className={`text-muted-foreground ${
                        thumbnailSize === 'small' ? 'text-xs' : 'text-sm'
                      }`}>
                        No preview
                      </span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Status Icons - sized based on thumbnail size */}
                  <div className={`absolute flex gap-1 ${
                    thumbnailSize === 'small' ? 'top-1 right-1' : 'top-2 right-2'
                  }`}>
                    {getStatusIcon(image)}
                    {image.groupId && (
                      <div className={`bg-blue-500 rounded-full border border-white ${
                        thumbnailSize === 'small' ? 'w-2 h-2' : 'w-3 h-3'
                      }`} />
                    )}
                  </div>
                  
                  {/* Rating Stars - sized and positioned based on thumbnail size */}
                  {image.rating > 0 && (
                    <div className={`absolute flex ${
                      thumbnailSize === 'small' 
                        ? 'bottom-1 left-1' 
                        : 'bottom-2 left-2'
                    }`}>
                      {Array.from({ length: image.rating }).map((_, i) => (
                        <Star key={i} className={`fill-yellow-400 text-yellow-400 ${
                          thumbnailSize === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3'
                        }`} />
                      ))}
                    </div>
                  )}
                  
                  {/* Enhanced Metadata Overlay - only for larger thumbnails */}
                  {showMetadata && (isSelected || isHovered) && thumbnailSize !== 'small' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-0 left-0 right-0 bg-black/90 text-white p-2"
                    >
                      <p className={`truncate font-medium ${
                        thumbnailSize === 'xlarge' ? 'text-sm' : 'text-xs'
                      }`}>
                        {image.fileName}
                      </p>
                      {thumbnailSize === 'xlarge' && (
                        <>
                          {image.metadata.dateTime && (
                            <p className="opacity-75 text-xs">
                              {new Date(image.metadata.dateTime).toLocaleDateString()}
                            </p>
                          )}
                          {(image.focusScore || image.blurScore) && (
                            <p className="opacity-75 text-xs">
                              {image.focusScore ? `Focus: ${Math.round(image.focusScore)}` : ''}
                              {image.blurScore ? ` Blur: ${Math.round(image.blurScore)}` : ''}
                            </p>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
                
                {/* Quick Rating Controls - only show for medium+ thumbnails on hover */}
                {isHovered && thumbnailSize !== 'small' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-10"
                  >
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-2">
                      <RatingControls
                        image={image}
                        onUpdate={onUpdate}
                        className={thumbnailSize === 'xlarge' ? 'scale-90 origin-center' : 'scale-75 origin-center'}
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
          <div className="flex flex-col items-center gap-2">
            <Grid3X3 className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium">No images to display</p>
            <p className="text-sm text-muted-foreground/75">Import some photos to get started</p>
          </div>
        </div>
      )}
    </div>
  )
}