'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sliders, RotateCcw, ChevronDown, ChevronUp, X, Wand2, Sparkles } from 'lucide-react'
import { ImageAdjustments, ImageRec } from '@/lib/types'
import { getDefaultAdjustments, resetAdjustments } from '@/lib/utils/adjustments'
import { autoEnhanceFromCanvas, applyPreset, getAutoEnhancePresets, isEnhancementWorthwhile } from '@/lib/utils/auto-enhance'
import { Button, LoadingButton, IconButton } from '@/components/ui/button'
import { useProcessingState, formatEnhancementMessage, formatPresetMessage } from '@/lib/utils/processing-state'
import { StatusMessageComponent } from '@/components/ui/status-message'
import { withImageProcessingErrorHandling, withCanvasErrorHandling } from '@/lib/utils/error-handling'
import { createCanvasFromImage } from '@/lib/utils/canvas'

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
  const processingState = useProcessingState({
    successDuration: 3000,
    errorDuration: 5000
  })
  
  // Destructure processing state methods to avoid dependency issues
  const { clearMessages, startProcessing, setSuccess, setError, isProcessing, result, error } = processingState
  
  // Use prop-based active preset or fall back to local state
  const activePreset = propActivePreset !== undefined ? propActivePreset : null

  // Define handleAutoEnhance callback first
  const handleAutoEnhance = useCallback(async () => {
    if (!image?.previewDataUrl) {
      setError('No image preview available')
      return
    }

    onPresetChange?.(null) // Clear preset selection when auto-enhancing
    startProcessing() // Start processing state
    
    const result = await withImageProcessingErrorHandling(async () => {
      const { canvas, cleanup } = await createCanvasFromImage(image.previewDataUrl!, {
        willReadFrequently: true
      })
      
      try {
        const enhanceResult = await autoEnhanceFromCanvas(canvas, image.metadata, true)
        
        if (isEnhancementWorthwhile(enhanceResult)) {
          onAdjustmentsChange(enhanceResult.adjustments)
          return {
            applied: true,
            confidence: enhanceResult.confidence,
            adjustments: enhanceResult.adjustments
          }
        } else {
          return {
            applied: false
          }
        }
      } finally {
        cleanup()
      }
    }, 'Auto enhance')
    
    if (result) {
      const message = formatEnhancementMessage(result)
      setSuccess(`${message.title}: ${message.message}`)
    } else {
      setError('Auto enhance failed')
    }
  }, [image?.previewDataUrl, image?.metadata, onAdjustmentsChange, onPresetChange, startProcessing, setSuccess, setError])

  // Store handleAutoEnhance ref to avoid dependency issues
  const handleAutoEnhanceRef = useRef(handleAutoEnhance)
  handleAutoEnhanceRef.current = handleAutoEnhance

  // Listen for auto enhance events from keyboard shortcuts
  useEffect(() => {
    const handleAutoEnhanceEvent = (event: CustomEvent) => {
      if (image?.id && event.detail.imageId === image.id) {
        handleAutoEnhanceRef.current()
      }
    }

    document.addEventListener('autoEnhance', handleAutoEnhanceEvent as EventListener)
    return () => {
      document.removeEventListener('autoEnhance', handleAutoEnhanceEvent as EventListener)
    }
  }, [image?.id])

  // Clear status messages when image changes
  useEffect(() => {
    clearMessages()
  }, [image?.id, clearMessages])

  const handleReset = () => {
    onAdjustmentsChange(resetAdjustments())
    clearMessages()
    onPresetChange?.(null)
  }

  const handlePresetApply = (presetName: string) => {
    const presetAdjustments = applyPreset(presetName)
    onAdjustmentsChange(presetAdjustments)
    onPresetChange?.(presetName)
    
    const message = formatPresetMessage(presetName)
    setSuccess(`${message.title}: ${message.message}`)
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
          <IconButton
            icon={X}
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
            variant="ghost"
            size="iconSm"
            className="text-gray-400 hover:text-white hover:bg-gray-700 relative z-10"
            tooltip="Close"
          />
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
          <LoadingButton
            onClick={() => {
              console.log('Auto enhance button clicked')
              handleAutoEnhance()
            }}
            loading={isProcessing}
            loadingText="Analyzing..."
            disabled={!image?.previewDataUrl}
            icon={Wand2}
            variant="success"
            fullWidth
            className="min-h-[44px] font-medium transform hover:scale-[1.02] active:scale-[0.98] focus:ring-offset-black"
          >
            Auto Enhance
          </LoadingButton>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end mb-4">
          <Button
            onClick={handleReset}
            disabled={!hasAdjustments}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white focus:ring-offset-black"
            title="Reset All Adjustments"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            <span>Reset</span>
          </Button>
        </div>

        {/* Status Message */}
        {(result || error) && (
          <div className="mb-4">
            <StatusMessageComponent
              message={{
                type: error ? 'error' : 'success',
                message: result || error || '',
                details: result ? 'Adjustments saved to this image' : undefined
              }}
            />
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
              <Button
                key={preset}
                onClick={() => handlePresetApply(preset)}
                variant={activePreset === preset ? 'default' : 'outline'}
                className={`min-h-[44px] font-medium capitalize transform hover:scale-[1.02] active:scale-[0.98] focus:ring-offset-black ${
                  activePreset === preset 
                    ? 'bg-purple-600 hover:bg-purple-700 border-purple-500 shadow-lg shadow-purple-500/25' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-700 border-gray-600 hover:border-gray-500'
                }`}
                title={PRESET_DESCRIPTIONS[preset as keyof typeof PRESET_DESCRIPTIONS] || `Apply ${preset} preset`}
              >
                <div className="flex items-center justify-center gap-2">
                  {activePreset === preset && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                  <span>{preset.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                </div>
              </Button>
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