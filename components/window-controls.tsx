'use client'

import { useRouter } from 'next/navigation'
import { X, Minimize2 } from 'lucide-react'

interface WindowControlsProps {
  className?: string
  showMinimize?: boolean
}

export function WindowControls({ className = '', showMinimize = true }: WindowControlsProps) {
  const router = useRouter()

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      // Electron app
      (window as any).electronAPI.minimize()
    } else if (typeof window !== 'undefined') {
      // PWA/Browser - try to minimize or go back
      if (window.history.length > 1) {
        window.history.back()
      } else {
        router.push('/')
      }
    }
  }

  const handleClose = () => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      // Electron app
      (window as any).electronAPI.close()
    } else if (typeof window !== 'undefined') {
      // PWA/Browser - close window or navigate away
      try {
        // Try to close the window (works for windows opened by JavaScript)
        window.close()
      } catch (e) {
        // If window.close() fails, try alternative methods
        if ('serviceWorker' in navigator) {
          // For PWAs, try to minimize to system tray or background
          try {
            (navigator as any).app?.exitApp?.()
          } catch (err) {
            // Last resort - navigate to home page
            router.push('/')
          }
        } else {
          // Regular browser tab - navigate to home
          router.push('/')
        }
      }
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showMinimize && (
        <button
          onClick={handleMinimize}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Minimize"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={handleClose}
        className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}