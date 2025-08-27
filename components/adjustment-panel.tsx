'use client'

import { useState, useEffect, useRef } from 'react'
import { Sliders, RotateCcw, ChevronDown, ChevronUp, X, Wand2, Sparkles, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { ImageAdjustments, ImageRec } from '@/lib/types'
import { getDefaultAdjustments, resetAdjustments } from '@/lib/utils/adjustments'
import { autoEnhanceFromCanvas, applyPreset, getAutoEnhancePresets, isEnhancementWorthwhile } from '@/lib/utils/auto-enhance'

interface AdjustmentPanelProps {
  adjustments: ImageAdjustments
  onAdjustmentsChange: (adjustments: ImageAdjustments) => void
  image?: ImageRec
  isOpen: boolean
  activePreset?: string | null
  onPresetChange?: (preset: string | null) => void
  onToggle: () => void
  onClose?: () => void
  className?: string
}

interface SliderControlProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

function SliderControl({ 
  label, 
  value, 
  onChange, 
  min = -100, 
  max = 100, 
  step = 1 
}: SliderControlProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-24 text-sm text-gray-300 text-right">{label}</label>
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                     [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0"
        />
        <span className="w-10 text-xs text-gray-400 text-center">{value > 0 ? '+' : ''}{value}</span>
      </div>
    </div>
  )
}

// Preset descriptions for tooltips
const PRESET_DESCRIPTIONS = {
  portrait: "Enhances skin tones, lifts shadows, and boosts vibrance for people photos",
  landscape: "Increases contrast and saturation for nature and outdoor scenes",
  lowLight: "Brightens dark images with aggressive shadow recovery",
  highKey: "Recovers highlights and balances bright, airy images",
  dramatic: "High contrast and vibrance for artistic, moody effects"
} as const

export function AdjustmentPanel({ 
  adjustments, 
  onAdjustmentsChange, 
  image,
  isOpen,
  activePreset: propActivePreset,
  onPresetChange,
  onToggle,
  onClose, 
  className = '' 
}: AdjustmentPanelProps) {
  const [expandedSection, setExpandedSection] = useState<'basic' | 'advanced' | null>('basic')
  const [isProcessing, setIsProcessing] = useState(false)
  const [enhanceResult, setEnhanceResult] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Use prop-based active preset or fall back to local state
  const activePreset = propActivePreset !== undefined ? propActivePreset : null

  // Listen for auto enhance events from keyboard shortcuts
  useEffect(() => {
    const handleAutoEnhanceEvent = (event: CustomEvent) => {
      if (image && event.detail.imageId === image.id) {
        handleAutoEnhance()
      }
    }

    document.addEventListener('autoEnhance', handleAutoEnhanceEvent as EventListener)
    return () => document.removeEventListener('autoEnhance', handleAutoEnhanceEvent as EventListener)
  }, [image])

  // Clear any pending timeouts when image changes
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    // Clear status message immediately (but not preset, as that's stored per image)
    setEnhanceResult(null)
  }, [image?.id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const handleReset = () => {
    onAdjustmentsChange(resetAdjustments())
    setEnhanceResult(null)
    onPresetChange?.(null)
  }

  const handleAutoEnhance = async () => {
    if (!image?.previewDataUrl) {
      setEnhanceResult('No image preview available')
      return
    }

    setIsProcessing(true)
    setEnhanceResult(null)
    onPresetChange?.(null) // Clear preset selection when auto-enhancing
    
    let img: HTMLImageElement | null = null
    let canvas: HTMLCanvasElement | null = null
    
    try {
      // Create a canvas from the image preview
      img = new Image()
      
      await new Promise((resolve, reject) => {
        if (!img) return reject(new Error('Image creation failed'))
        
        const cleanup = () => {
          img!.onload = null
          img!.onerror = null
        }
        
        img.onload = () => {
          cleanup()
          resolve(undefined)
        }
        
        img.onerror = () => {
          cleanup()
          reject(new Error('Failed to load image'))
        }
        
        img.src = image.previewDataUrl!
      })

      canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { 
        // Optimize for frequent reads
        willReadFrequently: true 
      })
      
      if (!ctx || !img) {
        throw new Error('Could not get canvas context')
      }

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const result = await autoEnhanceFromCanvas(canvas, image.metadata, true)
      
      if (isEnhancementWorthwhile(result)) {
        onAdjustmentsChange(result.adjustments)
        const confidencePercent = Math.round(result.confidence * 100)
        const confidenceLabel = confidencePercent >= 80 ? 'High' : confidencePercent >= 60 ? 'Good' : 'Moderate'
        setEnhanceResult(`Auto-enhanced with ${confidenceLabel} confidence (${confidencePercent}%)`)
      } else {
        setEnhanceResult('No significant improvements detected')
      }
    } catch (error) {
      console.error('Auto enhance failed:', error)
      setEnhanceResult('Auto enhance failed')
    } finally {
      // Clean up resources
      if (img) {
        img.onload = null
        img.onerror = null
        img.src = ''
        img = null
      }
      
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        canvas.width = 0
        canvas.height = 0
        canvas = null
      }
      
      setIsProcessing(false)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      // Set new timeout and store reference
      timeoutRef.current = setTimeout(() => {
        setEnhanceResult(null)
        timeoutRef.current = null
      }, 3000)
    }
  }

  const handlePresetApply = (presetName: string) => {
    const presetAdjustments = applyPreset(presetName)
    onAdjustmentsChange(presetAdjustments)
    onPresetChange?.(presetName)
    setEnhanceResult(`Applied ${presetName} preset`)
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    // Set new timeout and store reference
    timeoutRef.current = setTimeout(() => {
      setEnhanceResult(null)
      timeoutRef.current = null
    }, 2000)
  }

  const updateAdjustment = (key: keyof ImageAdjustments, value: number) => {
    onAdjustmentsChange({
      ...adjustments,
      [key]: value
    })
    // Clear preset selection when manual adjustments are made
    onPresetChange?.(null)
  }

  const hasAdjustments = Object.values(adjustments).some(val => val !== 0)

  if (!isOpen) {
    return null
  }

  return (
    <div className={`absolute top-16 right-4 w-80 max-w-[calc(100vw-2rem)] bg-black/90 backdrop-blur-sm rounded-lg 
                     border border-gray-700 shadow-xl z-20 ${className}
                     sm:w-80 xs:w-72 xs:right-2 xs:top-12`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-medium">Adjustments</h3>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Close button clicked')
              // Use onClose if available, otherwise fall back to onToggle
              if (onClose) {
                onClose()
              } else {
                onToggle()
              }
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors 
                       relative z-10 cursor-pointer"
            title="Close"
            type="button"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Prominent Auto-Enhance Section */}
        <div className="mb-6 p-3 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-white">Auto Enhance</span>
            </div>
            <kbd className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded border border-gray-600">E</kbd>
          </div>
          <button
            onClick={handleAutoEnhance}
            disabled={isProcessing || !image?.previewDataUrl}
            className="w-full min-h-[44px] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                       disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg 
                       transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
            aria-label="Auto enhance current image"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 animate-spin border-2 border-white border-t-transparent rounded-full" />
                <span>Analyzing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Wand2 className="w-5 h-5" />
                <span>Auto Enhance</span>
              </div>
            )}
          </button>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleReset}
            disabled={!hasAdjustments}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 
                       disabled:cursor-not-allowed hover:bg-gray-700 rounded transition-colors
                       focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-black"
            title="Reset All Adjustments"
            aria-label="Reset all adjustments to default"
          >
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </div>
          </button>
        </div>

        {/* Status Message */}
        {enhanceResult && (
          <div className="mb-4 p-3 rounded-lg border transition-all duration-300 animate-in slide-in-from-top-2">
            {enhanceResult.includes('confidence') ? (
              <div className="bg-green-900/50 border-green-700">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-sm text-green-200 font-medium">Auto-Enhancement Applied</p>
                </div>
                <p className="text-xs text-green-300">{enhanceResult}</p>
                <p className="text-xs text-green-400 mt-1">✓ Adjustments saved to this image</p>
              </div>
            ) : enhanceResult.includes('preset') ? (
              <div className="bg-purple-900/50 border-purple-700">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <p className="text-sm text-purple-200">{enhanceResult}</p>
                </div>
                <p className="text-xs text-purple-300 mt-1">✓ Style applied to this image only</p>
              </div>
            ) : enhanceResult.includes('failed') ? (
              <div className="bg-red-900/50 border-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <p className="text-sm text-red-200">Enhancement Failed</p>
                </div>
                <p className="text-xs text-red-300 mt-1">Try adjusting manually or check image quality</p>
              </div>
            ) : enhanceResult.includes('No significant') ? (
              <div className="bg-amber-900/50 border-amber-700">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <p className="text-sm text-amber-200">No Enhancement Needed</p>
                </div>
                <p className="text-xs text-amber-300 mt-1">Image appears well-exposed already</p>
              </div>
            ) : (
              <div className="bg-blue-900/50 border-blue-700">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <p className="text-sm text-blue-200">{enhanceResult}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Presets */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">Style Presets</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.keys(getAutoEnhancePresets()).map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetApply(preset)}
                className={`px-4 py-3 text-sm rounded-lg capitalize transition-all duration-200 
                           transform hover:scale-[1.02] active:scale-[0.98] font-medium min-h-[44px]
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black group ${
                  activePreset === preset
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 ring-2 ring-purple-500 hover:bg-purple-700'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-600 hover:border-gray-500 focus:ring-gray-500'
                }`}
                title={PRESET_DESCRIPTIONS[preset as keyof typeof PRESET_DESCRIPTIONS] || `Apply ${preset} preset`}
                aria-label={`Apply ${preset.replace(/([A-Z])/g, ' $1').toLowerCase()} preset: ${PRESET_DESCRIPTIONS[preset as keyof typeof PRESET_DESCRIPTIONS]}`}
              >
                <div className="flex items-center justify-center gap-2">
                  {activePreset === preset && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                  <span>{preset.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Basic Adjustments */}
        <div className="mb-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'basic' ? null : 'basic')}
            className="flex items-center justify-between w-full text-left text-sm text-gray-300 
                       hover:text-white transition-colors mb-2"
          >
            <span>Basic</span>
            {expandedSection === 'basic' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedSection === 'basic' && (
            <div className="space-y-3 pl-2">
              <SliderControl
                label="Brightness"
                value={adjustments.brightness}
                onChange={(value) => updateAdjustment('brightness', value)}
              />
              <SliderControl
                label="Contrast"
                value={adjustments.contrast}
                onChange={(value) => updateAdjustment('contrast', value)}
              />
              <SliderControl
                label="Saturation"
                value={adjustments.saturation}
                onChange={(value) => updateAdjustment('saturation', value)}
              />
            </div>
          )}
        </div>

        {/* Advanced Adjustments */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'advanced' ? null : 'advanced')}
            className="flex items-center justify-between w-full text-left text-sm text-gray-300 
                       hover:text-white transition-colors mb-2"
          >
            <span>Advanced</span>
            {expandedSection === 'advanced' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedSection === 'advanced' && (
            <div className="space-y-3 pl-2">
              <SliderControl
                label="Highlights"
                value={adjustments.highlights}
                onChange={(value) => updateAdjustment('highlights', value)}
              />
              <SliderControl
                label="Shadows"
                value={adjustments.shadows}
                onChange={(value) => updateAdjustment('shadows', value)}
              />
              <SliderControl
                label="Vibrance"
                value={adjustments.vibrance}
                onChange={(value) => updateAdjustment('vibrance', value)}
              />
            </div>
          )}
        </div>
        
        {hasAdjustments && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Adjustments are applied in real-time and not saved to the original image.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}