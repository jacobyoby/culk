'use client'

import { createContext, useContext, useRef, ReactNode } from 'react'
import { ImageAdjustments } from '@/lib/types'
import { LRUCache } from '@/lib/utils/lru-cache'
import { getDefaultAdjustments } from '@/lib/utils/adjustments'

interface ImageAdjustmentContextType {
  getAdjustments: (imageId: string) => ImageAdjustments
  setAdjustments: (imageId: string, adjustments: ImageAdjustments) => void
  getActivePreset: (imageId: string) => string | null
  setActivePreset: (imageId: string, preset: string | null) => void
  clearAdjustments: (imageId: string) => void
  clearAllAdjustments: () => void
}

const ImageAdjustmentContext = createContext<ImageAdjustmentContextType | null>(null)

interface ImageAdjustmentProviderProps {
  children: ReactNode
  maxCacheSize?: number
}

export function ImageAdjustmentProvider({ 
  children, 
  maxCacheSize = 100 
}: ImageAdjustmentProviderProps) {
  // Use refs to maintain cache instances across re-renders
  const adjustmentsCacheRef = useRef<LRUCache<string, ImageAdjustments>>(new LRUCache(maxCacheSize))
  const presetsCacheRef = useRef<LRUCache<string, string>>(new LRUCache(maxCacheSize))

  const getAdjustments = (imageId: string): ImageAdjustments => {
    return adjustmentsCacheRef.current.get(imageId) || getDefaultAdjustments()
  }

  const setAdjustments = (imageId: string, adjustments: ImageAdjustments): void => {
    // Only store if adjustments are non-default to save memory
    const isDefault = Object.values(adjustments).every(val => val === 0)
    
    if (isDefault) {
      adjustmentsCacheRef.current.delete(imageId)
    } else {
      adjustmentsCacheRef.current.set(imageId, adjustments)
    }
  }

  const getActivePreset = (imageId: string): string | null => {
    return presetsCacheRef.current.get(imageId) || null
  }

  const setActivePreset = (imageId: string, preset: string | null): void => {
    if (preset) {
      presetsCacheRef.current.set(imageId, preset)
    } else {
      presetsCacheRef.current.delete(imageId)
    }
  }

  const clearAdjustments = (imageId: string): void => {
    adjustmentsCacheRef.current.delete(imageId)
    presetsCacheRef.current.delete(imageId)
  }

  const clearAllAdjustments = (): void => {
    adjustmentsCacheRef.current.clear()
    presetsCacheRef.current.clear()
  }

  const value: ImageAdjustmentContextType = {
    getAdjustments,
    setAdjustments,
    getActivePreset,
    setActivePreset,
    clearAdjustments,
    clearAllAdjustments,
  }

  return (
    <ImageAdjustmentContext.Provider value={value}>
      {children}
    </ImageAdjustmentContext.Provider>
  )
}

export function useImageAdjustments(): ImageAdjustmentContextType {
  const context = useContext(ImageAdjustmentContext)
  
  if (!context) {
    throw new Error('useImageAdjustments must be used within an ImageAdjustmentProvider')
  }
  
  return context
}

// Hook for managing adjustments for a specific image
export function useImageAdjustmentsForImage(imageId: string) {
  const { getAdjustments, setAdjustments, getActivePreset, setActivePreset } = useImageAdjustments()
  
  return {
    adjustments: getAdjustments(imageId),
    setAdjustments: (adjustments: ImageAdjustments) => setAdjustments(imageId, adjustments),
    activePreset: getActivePreset(imageId),
    setActivePreset: (preset: string | null) => setActivePreset(imageId, preset),
  }
}