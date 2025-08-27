'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from './button'
import { clsx } from 'clsx'

export interface DropdownOption {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

export interface DropdownProps {
  options: DropdownOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  trigger?: React.ReactNode
  position?: 'left' | 'right'
  badge?: boolean
}

export function Dropdown({ 
  options, 
  value, 
  onValueChange, 
  placeholder = "Select option",
  className,
  trigger,
  position = 'left',
  badge
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(opt => opt.id === value)
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  const handleSelect = (optionId: string) => {
    onValueChange(optionId)
    setIsOpen(false)
  }
  
  return (
    <div className={clsx("relative", className)} ref={dropdownRef}>
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </div>
      ) : (
        <Button
          variant={badge || value !== undefined ? "default" : "muted"}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2"
        >
          {selectedOption?.icon && <selectedOption.icon className="w-4 h-4" />}
          <span>{selectedOption?.label || placeholder}</span>
          <ChevronDown className={clsx(
            "w-4 h-4 transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      )}
      
      {isOpen && (
        <div className={clsx(
          "absolute top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-48 max-h-60 overflow-y-auto",
          position === 'right' ? 'right-0' : 'left-0'
        )}>
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => !option.disabled && handleSelect(option.id)}
              disabled={option.disabled}
              className={clsx(
                "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg disabled:opacity-50 disabled:cursor-not-allowed",
                value === option.id && "bg-muted font-medium"
              )}
            >
              {option.icon && <option.icon className="w-4 h-4" />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}