'use client'

import { useState, useRef, useCallback } from 'react'
import { faceDetectionWorkerManager } from '@/lib/ml/face-detection-worker-manager'
import { FaceDetection } from '@/lib/types'

export function FaceDetectionTest() {
  const [results, setResults] = useState<{
    faces: FaceDetection[]
    processingTime: number
    method: string
    error?: string
  } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !canvasRef.current) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        
        // Resize canvas to fit image
        const maxSize = 400
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width *= ratio
          height *= ratio
        }
        
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  const createTestFace = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    canvas.width = 400
    canvas.height = 400

    // Create a synthetic face for testing
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 400)
    
    // Face oval (large, occupying ~40% of image as required by BlazeFace)
    ctx.fillStyle = '#FFDBAC' // Skin tone
    ctx.beginPath()
    ctx.ellipse(200, 200, 80, 100, 0, 0, 2 * Math.PI)
    ctx.fill()
    
    // Eyes
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.ellipse(180, 180, 8, 12, 0, 0, 2 * Math.PI)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(220, 180, 8, 12, 0, 0, 2 * Math.PI)
    ctx.fill()
    
    // Nose
    ctx.fillStyle = '#E6B88A'
    ctx.beginPath()
    ctx.ellipse(200, 200, 4, 8, 0, 0, 2 * Math.PI)
    ctx.fill()
    
    // Mouth
    ctx.fillStyle = '#CD5C5C'
    ctx.beginPath()
    ctx.ellipse(200, 230, 12, 6, 0, 0, Math.PI)
    ctx.fill()
  }, [])

  const testFaceDetection = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsProcessing(true)
    setResults(null)

    try {
      const ctx = canvas.getContext('2d')!
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      const startTime = performance.now()
      
      try {
        // Test worker-based detection
        const result = await faceDetectionWorkerManager.detectFaces(imageData, {
          confidenceThreshold: 0.5,
          includeEyeState: true,
          calculateFocusScore: true
        })
        
        const processingTime = performance.now() - startTime
        
        setResults({
          faces: result.faces,
          processingTime,
          method: `${result.detectorUsed} (worker)`
        })
      } catch (error) {
        // Fallback to manual skin tone detection
        console.warn('Worker failed, using manual detection:', error)
        
        const faces = detectFacesBySkinTone(imageData)
        const processingTime = performance.now() - startTime
        
        setResults({
          faces,
          processingTime,
          method: 'manual fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (error) {
      setResults({
        faces: [],
        processingTime: 0,
        method: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const detectFacesBySkinTone = (imageData: ImageData): FaceDetection[] => {
    const { width, height, data } = imageData
    const skinPixels: Array<{ x: number; y: number }> = []

    // Find skin-tone pixels
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        if (isSkinTone(r, g, b)) {
          skinPixels.push({ x, y })
        }
      }
    }

    console.log(`Found ${skinPixels.length} skin tone pixels`)

    // Adjust minimum based on image size
    const imageArea = width * height
    const minSkinPixels = Math.max(50, Math.floor(imageArea * 0.005)) // At least 0.5% of image
    
    if (skinPixels.length < minSkinPixels) {
      console.log(`Not enough skin pixels: found ${skinPixels.length}, need ${minSkinPixels}`)
      return []
    }

    // Simple clustering
    const xs = skinPixels.map(p => p.x)
    const ys = skinPixels.map(p => p.y)
    
    let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0]
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i]
      if (xs[i] > maxX) maxX = xs[i]
    }
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] < minY) minY = ys[i]
      if (ys[i] > maxY) maxY = ys[i]
    }

    const faceWidth = maxX - minX
    const faceHeight = maxY - minY
    
    if (faceWidth < 20 || faceHeight < 20) {
      return []
    }

    const padding = 0.1
    const paddedMinX = Math.max(0, minX - faceWidth * padding)
    const paddedMinY = Math.max(0, minY - faceHeight * padding)
    const paddedMaxX = Math.min(width, maxX + faceWidth * padding)
    const paddedMaxY = Math.min(height, maxY + faceHeight * padding)

    return [{
      id: `face-test-${Date.now()}`,
      bbox: {
        x: (paddedMinX / width) * 100,
        y: (paddedMinY / height) * 100,
        width: ((paddedMaxX - paddedMinX) / width) * 100,
        height: ((paddedMaxY - paddedMinY) / height) * 100
      },
      confidence: Math.min(0.7, skinPixels.length / 500),
      eyeState: { left: 'unknown', right: 'unknown' },
      focusScore: 0
    }]
  }

  // RGB to YCbCr conversion
  const rgbToYCbCr = (r: number, g: number, b: number) => {
    const Y = 0.299 * r + 0.587 * g + 0.114 * b
    const Cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128
    const Cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128
    return { Y, Cb, Cr }
  }

  const isSkinTone = (r: number, g: number, b: number): boolean => {
    // Quick rejection of obviously non-skin colors
    if (r < 40 || g < 25 || b < 15) return false
    if (r > 250 && g > 250 && b > 250) return false // Too white
    if (Math.max(r, g, b) < 60) return false // Too dark
    
    // YCbCr-based skin detection (research proven)
    const { Y, Cb, Cr } = rgbToYCbCr(r, g, b)
    
    // Adaptive YCbCr ranges based on research
    const ycbcrSkin = (
      Y >= 50 && Y <= 235 &&
      Cb >= 85 && Cb <= 135 &&
      Cr >= 135 && Cr <= 180
    )
    
    // Alternative YCbCr range for different skin tones
    const ycbcrSkin2 = (
      Y >= 60 && Y <= 230 &&
      Cb >= 77 && Cb <= 127 &&
      Cr >= 133 && Cr <= 173
    )
    
    // HSV-based validation
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const diff = max - min
    
    if (diff === 0) return false
    
    const saturation = diff / max
    const value = max / 255
    
    let hue = 0
    if (max === r) {
      hue = ((g - b) / diff) % 6
    } else if (max === g) {
      hue = (b - r) / diff + 2
    } else {
      hue = (r - g) / diff + 4
    }
    hue = (hue * 60 + 360) % 360
    
    const hsvSkin = (
      (hue >= 0 && hue <= 25) || (hue >= 335 && hue <= 360)
    ) && saturation >= 0.2 && saturation <= 0.7 && value >= 0.3 && value <= 0.95
    
    // RGB-based conditions (from research)
    const rgbSkin1 = (
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.abs(r - g) > 15 &&
      (r - b) > 15
    )
    
    // Lighter skin tones
    const rgbSkin2 = (
      r > 200 && g > 210 && b > 170 &&
      Math.abs(r - g) < 15 &&
      r > b && g > b
    )
    
    // Final decision: must pass YCbCr AND (HSV OR RGB)
    return (ycbcrSkin || ycbcrSkin2) && (hsvSkin || rgbSkin1 || rgbSkin2)
  }

  const drawTestImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    canvas.width = 300
    canvas.height = 200
    
    // Clear canvas
    ctx.fillStyle = '#e5e5e5'
    ctx.fillRect(0, 0, 300, 200)
    
    // Draw a simple face using skin tones
    ctx.fillStyle = '#f0c297' // Skin tone
    ctx.fillRect(100, 60, 100, 120) // Face
    
    ctx.fillStyle = '#8B4513' // Hair
    ctx.fillRect(90, 40, 120, 40)
    
    ctx.fillStyle = '#000' // Eyes
    ctx.fillRect(120, 90, 10, 10)
    ctx.fillRect(170, 90, 10, 10)
    
    ctx.fillStyle = '#CD5C5C' // Mouth
    ctx.fillRect(140, 140, 20, 5)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Face Detection Test</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Test Image</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={createTestFace}
              className="mt-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Create Test Face
            </button>
          </div>
          
          <div className="relative border border-gray-300 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="max-w-full"
              width={300}
              height={200}
            />
            
            {/* Face boxes overlay */}
            {results?.faces.map((face, index) => (
              <div
                key={face.id || index}
                className="absolute border-2 border-green-500 bg-green-500/10"
                style={{
                  left: `${face.bbox.x}%`,
                  top: `${face.bbox.y}%`,
                  width: `${face.bbox.width}%`,
                  height: `${face.bbox.height}%`,
                }}
              >
                <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-1 rounded">
                  {(face.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={testFaceDetection}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isProcessing ? 'Processing...' : 'Test Face Detection'}
          </button>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Results</h3>
          
          {results && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className={`p-3 rounded mb-3 ${results.faces.length > 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <strong>
                  {results.faces.length > 0 ? `Found ${results.faces.length} face(s)` : 'No faces detected'}
                </strong>
              </div>
              
              <div className="space-y-2 text-sm">
                <div><strong>Method:</strong> {results.method}</div>
                <div><strong>Processing time:</strong> {results.processingTime.toFixed(2)}ms</div>
                {results.error && (
                  <div className="text-red-600"><strong>Error:</strong> {results.error}</div>
                )}
              </div>
              
              {results.faces.map((face, index) => (
                <div key={face.id || index} className="mt-3 p-3 bg-white rounded border">
                  <div className="font-medium">Face {index + 1}</div>
                  <div className="text-sm space-y-1 mt-2">
                    <div><strong>Confidence:</strong> {(face.confidence * 100).toFixed(1)}%</div>
                    <div><strong>Position:</strong> ({face.bbox.x.toFixed(1)}%, {face.bbox.y.toFixed(1)}%)</div>
                    <div><strong>Size:</strong> {face.bbox.width.toFixed(1)}% × {face.bbox.height.toFixed(1)}%</div>
                    {face.eyeState && (
                      <div><strong>Eyes:</strong> L:{face.eyeState.left}, R:{face.eyeState.right}</div>
                    )}
                    {typeof face.focusScore === 'number' && (
                      <div><strong>Focus score:</strong> {face.focusScore.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            <h4 className="font-semibold mb-2">Tips:</h4>
            <ul className="space-y-1">
              <li>• Use images with clear, well-lit faces</li>
              <li>• Face should be at least 50×50 pixels</li>
              <li>• Try the "Draw Test Face" button for a guaranteed test</li>
              <li>• Check browser console for detailed logs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}