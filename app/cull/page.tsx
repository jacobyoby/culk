'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useHotkeys } from 'react-hotkeys-hook'
import { ArrowLeft, Home } from 'lucide-react'
import { ImageViewer } from '@/components/image-viewer'
import { Filmstrip } from '@/components/filmstrip'
import { Toolbar } from '@/components/toolbar'
import { RatingControls } from '@/components/rating-controls'
import { WindowControls } from '@/components/window-controls'
import { useImages, useFilteredImages } from '@/lib/store/hooks'
import { ViewMode, UIState, ImageAdjustments } from '@/lib/types'
import { getDefaultAdjustments } from '@/lib/utils/adjustments'
import { db } from '@/lib/store/db'

export default function CullPage() {
  const router = useRouter()
  const allImages = useImages()
  
  const [uiState, setUIState] = useState<UIState>({
    viewMode: 'filmstrip' as ViewMode,
    selectedImageIds: [],
    currentImageId: undefined,
    zoom: 1,
    panX: 0,
    panY: 0,
    showFaceBoxes: false,
    showMetadata: false,
    showHistogram: false,
    compareImages: [],
    surveyImages: [],
    filterMode: 'all',
    sortMode: 'import-time',
    sortDirection: 'asc',
    showCropTool: false,
    showAdjustments: false,
    thumbnailSize: 'medium' as const,
    adjustments: getDefaultAdjustments()
  })
  
  const filteredImages = useFilteredImages(uiState.filterMode)
  const currentImage = filteredImages.find(img => img.id === uiState.currentImageId)
  
  useEffect(() => {
    if (filteredImages.length > 0 && !uiState.currentImageId) {
      setUIState(prev => ({
        ...prev,
        currentImageId: filteredImages[0].id
      }))
    }
  }, [filteredImages, uiState.currentImageId])
  
  const handleImageSelect = useCallback((imageId: string) => {
    setUIState(prev => ({
      ...prev,
      currentImageId: imageId,
      selectedImageIds: [imageId]
    }))
  }, [])
  
  const handleNextImage = useCallback(() => {
    if (!uiState.currentImageId) return
    const currentIndex = filteredImages.findIndex(img => img.id === uiState.currentImageId)
    if (currentIndex < filteredImages.length - 1) {
      const nextImage = filteredImages[currentIndex + 1]
      handleImageSelect(nextImage.id)
    }
  }, [filteredImages, uiState.currentImageId, handleImageSelect])
  
  const handlePrevImage = useCallback(() => {
    if (!uiState.currentImageId) return
    const currentIndex = filteredImages.findIndex(img => img.id === uiState.currentImageId)
    if (currentIndex > 0) {
      const prevImage = filteredImages[currentIndex - 1]
      handleImageSelect(prevImage.id)
    }
  }, [filteredImages, uiState.currentImageId, handleImageSelect])
  
  const forceUpdate = useCallback(() => {
    // Force re-render by updating a timestamp
    setUIState(prev => ({ ...prev, lastUpdate: Date.now() }))
  }, [])
  
  // Keyboard shortcuts
  useHotkeys('right, space', handleNextImage, { preventDefault: true, enableOnFormTags: true })
  useHotkeys('left', handlePrevImage, { preventDefault: true, enableOnFormTags: true })
  
  useHotkeys('1', async (e) => {
    e.preventDefault()
    if (currentImage) {
      await db.updateImageRating(currentImage.id, 1)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('2', async (e) => {
    e.preventDefault()
    if (currentImage) {
      await db.updateImageRating(currentImage.id, 2)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('3', async (e) => {
    e.preventDefault()
    if (currentImage) {
      await db.updateImageRating(currentImage.id, 3)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('4', async (e) => {
    e.preventDefault()
    if (currentImage) {
      await db.updateImageRating(currentImage.id, 4)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('5', async (e) => {
    e.preventDefault()
    if (currentImage) {
      await db.updateImageRating(currentImage.id, 5)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('0', async (e) => {
    e.preventDefault()
    if (currentImage) {
      await db.updateImageRating(currentImage.id, 0)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('p', async (e) => {
    e.preventDefault()
    if (currentImage) {
      const newFlag = currentImage.flag === 'pick' ? null : 'pick'
      await db.updateImageFlag(currentImage.id, newFlag)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('x', async (e) => {
    e.preventDefault()
    if (currentImage) {
      const newFlag = currentImage.flag === 'reject' ? null : 'reject'
      await db.updateImageFlag(currentImage.id, newFlag)
      forceUpdate()
    }
  }, { enableOnFormTags: true })
  
  useHotkeys('f', () => {
    setUIState(prev => ({ ...prev, showFaceBoxes: !prev.showFaceBoxes }))
  }, { preventDefault: true, enableOnFormTags: true })
  
  useHotkeys('i', () => {
    setUIState(prev => ({ ...prev, showMetadata: !prev.showMetadata }))
  }, { preventDefault: true, enableOnFormTags: true })
  
  useHotkeys('c', () => {
    if (currentImage) {
      setUIState(prev => ({ ...prev, showCropTool: true }))
    }
  }, { preventDefault: true, enableOnFormTags: true })
  
  useHotkeys('a', () => {
    setUIState(prev => ({ ...prev, showAdjustments: !prev.showAdjustments }))
  }, { preventDefault: true, enableOnFormTags: true })
  
  // Auto enhance shortcut - always works regardless of panel state
  useHotkeys('e', () => {
    console.log('E key pressed for auto enhance', { 
      hasCurrentImage: !!currentImage, 
      imageId: currentImage?.id,
      fileName: currentImage?.fileName 
    })
    
    if (currentImage) {
      // Always ensure adjustments panel is open for visual feedback
      setUIState(prev => ({ ...prev, showAdjustments: true }))
      
      // Trigger auto enhance immediately - no need to wait
      const event = new CustomEvent('autoEnhance', { detail: { imageId: currentImage.id } })
      console.log('Dispatching auto enhance event', event.detail)
      document.dispatchEvent(event)
    } else {
      console.warn('No current image selected for auto enhance')
    }
  }, { preventDefault: true, enableOnFormTags: true })
  
  if (allImages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No Images Found</h2>
          <p className="text-muted-foreground">
            Import some photos first to start culling
          </p>
          <button
            onClick={() => router.push('/import')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Import Photos
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Photo Culling</h1>
          <span className="text-sm text-muted-foreground">
            {filteredImages.length} images
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {currentImage && (
            <>
              <span className="text-sm text-muted-foreground">
                {filteredImages.findIndex(img => img.id === uiState.currentImageId) + 1} of {filteredImages.length}
              </span>
              <RatingControls
                image={currentImage}
                onUpdate={forceUpdate}
              />
            </>
          )}
          
        </div>
      </div>
      
      <Toolbar
        viewMode={uiState.viewMode}
        onViewModeChange={(mode) => setUIState(prev => ({ ...prev, viewMode: mode }))}
        filterMode={uiState.filterMode || 'all'}
        onFilterModeChange={(filter) => setUIState(prev => ({ ...prev, filterMode: filter }))}
        sortMode={uiState.sortMode}
        onSortModeChange={(sort) => setUIState(prev => ({ ...prev, sortMode: sort }))}
        showFaceBoxes={uiState.showFaceBoxes}
        onToggleFaceBoxes={() => {
          console.log('Face boxes toggle clicked, current state:', uiState.showFaceBoxes)
          setUIState(prev => ({ ...prev, showFaceBoxes: !prev.showFaceBoxes }))
        }}
        showMetadata={uiState.showMetadata}
        onToggleMetadata={() => setUIState(prev => ({ ...prev, showMetadata: !prev.showMetadata }))}
        onOpenSettings={() => router.push('/settings')}
      />
      
      <div className="flex-1 flex flex-col">
        {uiState.viewMode === 'filmstrip' && (
          <>
            <div className="flex-1 min-h-0">
              {currentImage && (
                <ImageViewer
                  image={currentImage}
                  showMetadata={uiState.showMetadata}
                  showFaceBoxes={uiState.showFaceBoxes}
                  showCropTool={uiState.showCropTool}
                  showAdjustments={uiState.showAdjustments}
                  onToggleCropTool={() => setUIState(prev => ({ ...prev, showCropTool: !prev.showCropTool }))}
                  onToggleAdjustments={() => setUIState(prev => ({ ...prev, showAdjustments: !prev.showAdjustments }))}
                  className="w-full h-full"
                />
              )}
            </div>
            <Filmstrip
              images={filteredImages}
              selectedImageId={uiState.currentImageId}
              onImageSelect={handleImageSelect}
              onUpdate={forceUpdate}
              showMetadata={uiState.showMetadata}
              thumbnailSize={uiState.thumbnailSize}
              onThumbnailSizeChange={(size) => setUIState(prev => ({ ...prev, thumbnailSize: size }))}
              className="flex-shrink-0"
            />
          </>
        )}
        
        {uiState.viewMode === 'loupe' && currentImage && (
          <ImageViewer
            image={currentImage}
            showMetadata={uiState.showMetadata}
            showFaceBoxes={uiState.showFaceBoxes}
            showCropTool={uiState.showCropTool}
            showAdjustments={uiState.showAdjustments}
            onToggleCropTool={() => setUIState(prev => ({ ...prev, showCropTool: !prev.showCropTool }))}
            onToggleAdjustments={() => setUIState(prev => ({ ...prev, showAdjustments: !prev.showAdjustments }))}
            className="flex-1"
          />
        )}
        
        {uiState.viewMode === 'compare' && (
          <div className="flex-1 grid grid-cols-2 gap-2 p-2">
            {filteredImages.slice(0, 2).map(image => (
              <ImageViewer
                key={image.id}
                image={image}
                showMetadata={uiState.showMetadata}
                showFaceBoxes={uiState.showFaceBoxes}
                showCropTool={image.id === uiState.currentImageId && uiState.showCropTool}
                showAdjustments={image.id === uiState.currentImageId && uiState.showAdjustments}
                onToggleCropTool={image.id === uiState.currentImageId ? () => setUIState(prev => ({ ...prev, showCropTool: !prev.showCropTool })) : undefined}
                onToggleAdjustments={image.id === uiState.currentImageId ? () => setUIState(prev => ({ ...prev, showAdjustments: !prev.showAdjustments })) : undefined}
                className="min-h-0"
              />
            ))}
          </div>
        )}
        
        {uiState.viewMode === 'survey' && (
          <div className="flex-1 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4 overflow-y-auto">
            {filteredImages.map(image => (
              <div
                key={image.id}
                onClick={() => handleImageSelect(image.id)}
                className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  image.id === uiState.currentImageId
                    ? 'border-primary scale-105'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {image.thumbnailDataUrl ? (
                  <img
                    src={image.thumbnailDataUrl}
                    alt={image.fileName}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">No preview</span>
                  </div>
                )}
                
                {image.rating > 0 && (
                  <div className="absolute bottom-1 left-1 flex">
                    {Array.from({ length: Math.min(5, image.rating) }).map((_, i) => (
                      <div key={i} className="w-2 h-2 bg-yellow-400 rounded-full mr-0.5" />
                    ))}
                  </div>
                )}
                
                {image.flag && (
                  <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${
                    image.flag === 'pick' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="border-t border-border p-2 text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4">
          <span>←/→ Navigate</span>
          <span>1-5 Rate</span>
          <span>P Thumbs Up</span>
          <span>X Thumbs Down</span>
          <span>F Faces</span>
          <span>I Info</span>
          <span>C Crop</span>
          <span>A Adjust</span>
          <span>E Auto Enhance</span>
        </div>
      </div>
    </div>
  )
}