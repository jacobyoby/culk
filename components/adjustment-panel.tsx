'use client'

import { useState } from 'react'
import { Sliders, RotateCcw, ChevronDown, ChevronUp, X } from 'lucide-react'
import { ImageAdjustments } from '@/lib/types'
import { getDefaultAdjustments, resetAdjustments } from '@/lib/utils/adjustments'

interface AdjustmentPanelProps {
  adjustments: ImageAdjustments
  onAdjustmentsChange: (adjustments: ImageAdjustments) => void
  isOpen: boolean
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

export function AdjustmentPanel({ 
  adjustments, 
  onAdjustmentsChange, 
  isOpen, 
  onToggle,
  onClose, 
  className = '' 
}: AdjustmentPanelProps) {
  const [expandedSection, setExpandedSection] = useState<'basic' | 'advanced' | null>('basic')

  const handleReset = () => {
    onAdjustmentsChange(resetAdjustments())
  }

  const updateAdjustment = (key: keyof ImageAdjustments, value: number) => {
    onAdjustmentsChange({
      ...adjustments,
      [key]: value
    })
  }

  const hasAdjustments = Object.values(adjustments).some(val => val !== 0)

  if (!isOpen) {
    return null
  }

  return (
    <div className={`absolute top-16 right-4 w-80 bg-black/90 backdrop-blur-sm rounded-lg 
                     border border-gray-700 shadow-xl z-20 ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-medium">Adjustments</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={!hasAdjustments}
              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed
                         hover:bg-gray-700 rounded transition-colors"
              title="Reset All"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
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