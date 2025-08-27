'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Save, RotateCcw, Trash2 } from 'lucide-react'
import { useCurrentProject } from '@/lib/store/hooks'
import { db } from '@/lib/store/db'
import { ProjectMeta } from '@/lib/types'

export default function SettingsPage() {
  const router = useRouter()
  const project = useCurrentProject()
  
  const [settings, setSettings] = useState({
    similarityThreshold: 15,
    blurThreshold: 100,
    minFaceConfidence: 0.7,
    autoPickWeights: {
      sharpness: 0.4,
      eyesOpen: 0.3,
      faceSize: 0.2,
      exposure: 0.1
    },
    exportSettings: {
      includeXMP: true,
      includeJSON: false,
      includeCSV: false
    }
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  
  useEffect(() => {
    if (project) {
      setSettings(project.settings)
    }
  }, [project])
  
  const handleSave = async () => {
    if (!project) return
    
    setIsSaving(true)
    try {
      await db.projects.update(project.id, {
        settings,
        modifiedAt: new Date()
      })
      
      // Show success feedback
      setTimeout(() => setIsSaving(false), 1000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setIsSaving(false)
    }
  }
  
  const handleReset = () => {
    setSettings({
      similarityThreshold: 15,
      blurThreshold: 100,
      minFaceConfidence: 0.7,
      autoPickWeights: {
        sharpness: 0.4,
        eyesOpen: 0.3,
        faceSize: 0.2,
        exposure: 0.1
      },
      exportSettings: {
        includeXMP: true,
        includeJSON: false,
        includeCSV: false
      }
    })
    setShowConfirmReset(false)
  }
  
  const handleClearData = async () => {
    if (confirm('This will delete all imported images, groups, and session data. Are you sure?')) {
      await db.clearAll()
      router.push('/')
    }
  }
  
  const totalWeights = Object.values(settings.autoPickWeights).reduce((sum, weight) => sum + weight, 0)
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
        
        <div className="grid gap-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Image Analysis</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Similarity Threshold
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={settings.similarityThreshold}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        similarityThreshold: parseInt(e.target.value)
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-8">{settings.similarityThreshold}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower values = more similar images grouped together
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Blur Detection Threshold
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={settings.blurThreshold}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        blurThreshold: parseInt(e.target.value)
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12">{settings.blurThreshold}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher values = more sensitive blur detection
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Face Detection Confidence
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={settings.minFaceConfidence}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        minFaceConfidence: parseFloat(e.target.value)
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12">{settings.minFaceConfidence}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum confidence required for face detection
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Auto-Pick Weights</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure how auto-pick scores are calculated for grouped images
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(settings.autoPickWeights).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-2 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={value}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        autoPickWeights: {
                          ...prev.autoPickWeights,
                          [key]: parseFloat(e.target.value)
                        }
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-8">{value.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Total weight: {totalWeights.toFixed(1)} 
                {totalWeights !== 1.0 && (
                  <span className="text-orange-500 ml-2">
                    (weights should sum to 1.0 for optimal results)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Export Defaults</h2>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.exportSettings.includeXMP}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    exportSettings: {
                      ...prev.exportSettings,
                      includeXMP: e.target.checked
                    }
                  }))}
                  className="rounded"
                />
                <span>Include XMP sidecars by default</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.exportSettings.includeJSON}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    exportSettings: {
                      ...prev.exportSettings,
                      includeJSON: e.target.checked
                    }
                  }))}
                  className="rounded"
                />
                <span>Include JSON export by default</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.exportSettings.includeCSV}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    exportSettings: {
                      ...prev.exportSettings,
                      includeCSV: e.target.checked
                    }
                  }))}
                  className="rounded"
                />
                <span>Include CSV export by default</span>
              </label>
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-destructive p-6">
            <h2 className="text-xl font-semibold mb-4 text-destructive">Danger Zone</h2>
            
            <div className="space-y-4">
              <button
                onClick={handleClearData}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Data
              </button>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all imported images, ratings, groups, and session data.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {showConfirmReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Reset Settings</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to reset all settings to their default values?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}