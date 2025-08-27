'use client'

import React from 'react'
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { StatusMessage, MessageType } from '@/lib/utils/processing-state'

const messageConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-900/50',
    borderColor: 'border-green-700',
    iconColor: 'text-green-400',
    titleColor: 'text-green-200',
    messageColor: 'text-green-300',
    detailsColor: 'text-green-400'
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-900/50',
    borderColor: 'border-red-700',
    iconColor: 'text-red-400',
    titleColor: 'text-red-200',
    messageColor: 'text-red-300',
    detailsColor: 'text-red-400'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-900/50',
    borderColor: 'border-amber-700',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-200',
    messageColor: 'text-amber-300',
    detailsColor: 'text-amber-400'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-900/50',
    borderColor: 'border-blue-700',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-200',
    messageColor: 'text-blue-300',
    detailsColor: 'text-blue-400'
  }
} as const

interface StatusMessageProps {
  message: StatusMessage
  className?: string
  onDismiss?: () => void
}

export function StatusMessageComponent({ message, className, onDismiss }: StatusMessageProps) {
  const config = messageConfig[message.type]
  const Icon = config.icon
  
  return (
    <div className={clsx(
      "p-3 rounded-lg border transition-all duration-300 animate-in slide-in-from-top-2",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-start gap-2">
        <Icon className={clsx("w-4 h-4 mt-0.5 flex-shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          {message.title && (
            <p className={clsx("text-sm font-medium mb-1", config.titleColor)}>
              {message.title}
            </p>
          )}
          <p className={clsx("text-sm", config.messageColor)}>
            {message.message}
          </p>
          {message.details && (
            <p className={clsx("text-xs mt-1", config.detailsColor)}>
              ✓ {message.details}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={clsx(
              "flex-shrink-0 p-1 rounded hover:bg-black/20 transition-colors",
              config.iconColor
            )}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// Simple message variants for common cases
export function SuccessMessage({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <StatusMessageComponent
      message={{ type: 'success', message: children as string }}
      className={className}
    />
  )
}

export function ErrorMessage({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <StatusMessageComponent
      message={{ type: 'error', message: children as string }}
      className={className}
    />
  )
}

export function InfoMessage({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <StatusMessageComponent
      message={{ type: 'info', message: children as string }}
      className={className}
    />
  )
}

export function WarningMessage({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <StatusMessageComponent
      message={{ type: 'warning', message: children as string }}
      className={className}
    />
  )
}