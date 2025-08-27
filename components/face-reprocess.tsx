'use client'

import { useState } from 'react'
import { useImages } from '@/lib/store/hooks'
import { faceDetectionWorkerManager } from '@/lib/ml/face-detection-worker-manager'
import { db } from '@/lib/store/db'

export function FaceReprocess() {
  const images = useImages()
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<string>('')
  
  const reprocessFaces = async () => {
    if (processing) return
    
    setProcessing(true)
    setResults('Starting face reprocessing...\n')
    
    try {
      let processed = 0
      let detected = 0
      
      for (const image of images) {
        if (!image.thumbnailDataUrl) {
          setResults(prev => prev + `Skipping ${image.fileName}: no thumbnail\n`)
          continue
        }
        
        setResults(prev => prev + `Processing ${image.fileName}...\n`)
        
        try {
          // Create canvas from thumbnail
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = image.thumbnailDataUrl!
          })
          
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')!
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          const imageData = ctx.getImageData(0, 0, img.width, img.height)
          
          // Initialize face detection if needed
          if (!faceDetectionWorkerManager.isAvailable()) {
            setResults(prev => prev + `Initializing face detection worker...\n`)
            await faceDetectionWorkerManager.initialize()
          }
          
          // Detect faces
          const faceResult = await faceDetectionWorkerManager.detectFaces(imageData, {
            confidenceThreshold: 0.5,
            includeEyeState: true,
            calculateFocusScore: true
          })
          
          // Update database
          await db.images.update(image.id, {
            faces: faceResult.faces
          })
          
          processed++
          if (faceResult.faces.length > 0) {
            detected++
            setResults(prev => prev + `  ✓ Found ${faceResult.faces.length} face(s)\n`)
          } else {
            setResults(prev => prev + `  - No faces detected\n`)
          }
          
        } catch (error) {
          setResults(prev => prev + `  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
        }
      }
      
      setResults(prev => prev + `\nCompleted! Processed ${processed} images, found faces in ${detected} images.\n`)
      
    } catch (error) {
      setResults(prev => prev + `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
    } finally {
      setProcessing(false)
    }
  }
  
  const clearResults = () => setResults('')
  
  if (images.length === 0) {
    return (
      <div className="p-4 bg-yellow-100 rounded-lg">
        <p className="text-yellow-800">No images found. Import some photos first.</p>
      </div>
    )
  }
  
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-bold mb-4">Face Detection Reprocessing</h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          This will run face detection on all {images.length} imported images and update the database.
        </p>
        <div className="flex gap-2">
          <button
            onClick={reprocessFaces}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {processing ? 'Processing...' : `Reprocess ${images.length} Images`}
          </button>
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Results
          </button>
        </div>
      </div>
      
      {results && (
        <div className="bg-white p-4 rounded border">
          <h4 className="font-bold mb-2">Processing Results:</h4>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded max-h-64 overflow-y-auto">
            {results}
          </pre>
        </div>
      )}
    </div>
  )
}