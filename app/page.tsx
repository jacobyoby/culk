'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FolderOpen, Settings, Info } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        console.log('Service Worker ready')
      })
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 to-black">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-8">
            <Camera className="w-24 h-24 text-primary" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            AI Photo Culling
          </h1>
          <p className="text-xl text-muted-foreground">
            Local-first RAW/JPEG culling with AI-powered features
          </p>
          {!isInstalled && (
            <p className="text-sm text-yellow-500">
              Install as PWA for offline access
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push('/import')}
            className="group relative overflow-hidden rounded-xl bg-card p-8 border border-border hover:border-primary transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center space-x-4">
              <FolderOpen className="w-12 h-12 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-semibold">Import Photos</h2>
                <p className="text-muted-foreground mt-1">
                  Load RAW/JPEG from folders
                </p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => router.push('/cull')}
            className="group relative overflow-hidden rounded-xl bg-card p-8 border border-border hover:border-primary transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center space-x-4">
              <Camera className="w-12 h-12 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-semibold">Start Culling</h2>
                <p className="text-muted-foreground mt-1">
                  Review and rate images
                </p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => router.push('/review')}
            className="group relative overflow-hidden rounded-xl bg-card p-8 border border-border hover:border-primary transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center space-x-4">
              <Settings className="w-12 h-12 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-semibold">Review & Export</h2>
                <p className="text-muted-foreground mt-1">
                  Export XMP sidecars
                </p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="group relative overflow-hidden rounded-xl bg-card p-8 border border-border hover:border-primary transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center space-x-4">
              <Info className="w-12 h-12 text-primary" />
              <div className="text-left">
                <h2 className="text-2xl font-semibold">Settings</h2>
                <p className="text-muted-foreground mt-1">
                  Configure thresholds
                </p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>All processing happens locally in your browser</p>
          <p>No images are uploaded to any server</p>
        </div>
      </div>
    </div>
  )
}