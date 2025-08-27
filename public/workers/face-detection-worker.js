// Face Detection Web Worker
importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js')

let faceDetectionManager = null
let isInitialized = false

// Worker message types
const MESSAGE_TYPES = {
  INITIALIZE: 'initialize',
  DETECT_FACES: 'detect_faces',
  UPDATE_SETTINGS: 'update_settings',
  DISPOSE: 'dispose'
}

// Initialize face detection manager
async function initializeFaceDetection(options = {}) {
  if (isInitialized) return

  try {
    // Dynamic import would be used in a more complex setup
    // For now, we'll implement a simplified version
    
    // Configure ONNX Runtime
    ort.env.wasm.simd = true
    ort.env.wasm.numThreads = Math.min(4, self.navigator?.hardwareConcurrency || 2)
    
    // Initialize with provided options
    const { faceConfidenceThreshold = 0.7 } = options
    
    // Store settings
    self.faceDetectionSettings = {
      faceConfidenceThreshold,
      eyeConfidenceThreshold: 0.6
    }
    
    isInitialized = true
    console.log('Face detection worker initialized')
  } catch (error) {
    console.error('Failed to initialize face detection worker:', error)
    throw error
  }
}

// Simple face detection using skin tone detection (fallback)
function detectFacesBySkinTone(imageData) {
  const { width, height, data } = imageData
  const skinPixels = []

  // Find skin-tone pixels using multiple color spaces
  for (let y = 0; y < height; y += 1) { // Check every pixel for better accuracy
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      if (isSkinToneMultiSpace(r, g, b)) {
        skinPixels.push({ x, y })
      }
    }
  }

  console.log(`Found ${skinPixels.length} skin pixels in ${width}x${height} image`)

  // Adjust minimum based on image size
  const imageArea = width * height
  const minSkinPixels = Math.max(50, Math.floor(imageArea * 0.005)) // At least 0.5% of image
  
  console.log(`Need at least ${minSkinPixels} skin pixels (0.5% of ${imageArea} pixels)`)
  
  if (skinPixels.length < minSkinPixels) {
    console.log(`Not enough skin pixels for face detection (found ${skinPixels.length}, need ${minSkinPixels})`)
    return []
  }

  // Cluster skin pixels into face regions
  const faces = clusterSkinPixels(skinPixels, imageData)
  console.log(`Clustered into ${faces.length} potential faces`)
  return faces
}

// RGB to YCbCr conversion
function rgbToYCbCr(r, g, b) {
  const Y = 0.299 * r + 0.587 * g + 0.114 * b
  const Cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128
  const Cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128
  return { Y, Cb, Cr }
}

// Research-based skin detection using multiple color spaces
function isSkinToneMultiSpace(r, g, b) {
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

// Legacy function for backward compatibility
function isSkinTone(r, g, b) {
  return isSkinToneMultiSpace(r, g, b)
}

// Morphological operations for cleaning up the density map
function applyMorphologicalOps(map, width, height) {
  // Apply erosion followed by dilation (opening) to remove noise
  let result = erode(map, width, height, 2)
  result = dilate(result, width, height, 3)
  return result
}

function erode(map, width, height, size) {
  const result = new Array(width * height).fill(0)
  
  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      const idx = y * width + x
      if (map[idx] === 0) continue
      
      let allSkin = true
      for (let dy = -size; dy <= size && allSkin; dy++) {
        for (let dx = -size; dx <= size && allSkin; dx++) {
          const nIdx = (y + dy) * width + (x + dx)
          if (map[nIdx] === 0) {
            allSkin = false
          }
        }
      }
      
      if (allSkin) {
        result[idx] = 1
      }
    }
  }
  
  return result
}

function dilate(map, width, height, size) {
  const result = [...map]
  
  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      const idx = y * width + x
      if (map[idx] === 0) continue
      
      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          const nIdx = (y + dy) * width + (x + dx)
          if (nIdx >= 0 && nIdx < result.length) {
            result[nIdx] = 1
          }
        }
      }
    }
  }
  
  return result
}

// Flood fill to find connected components
function floodFill(startX, startY, map, width, height, visited) {
  const cluster = []
  const queue = [{ x: startX, y: startY }]
  const key = `${startX},${startY}`
  
  if (visited.has(key)) return cluster
  
  visited.add(key)
  
  while (queue.length > 0) {
    const { x, y } = queue.shift()
    const idx = y * width + x
    
    if (map[idx] === 0) continue
    
    cluster.push({ x, y })
    
    // Check 8-connected neighbors
    const neighbors = [
      { x: x - 1, y: y - 1 }, { x: x, y: y - 1 }, { x: x + 1, y: y - 1 },
      { x: x - 1, y: y }, { x: x + 1, y: y },
      { x: x - 1, y: y + 1 }, { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }
    ]
    
    for (const neighbor of neighbors) {
      if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
        const nKey = `${neighbor.x},${neighbor.y}`
        if (!visited.has(nKey)) {
          const nIdx = neighbor.y * width + neighbor.x
          if (map[nIdx] === 1) {
            visited.add(nKey)
            queue.push(neighbor)
          }
        }
      }
    }
  }
  
  return cluster
}

// Calculate face-like score based on facial features
function calculateFacelikeScore(data, width, height, x, y, w, h) {
  let score = 0
  let features = 0
  
  // Convert to grayscale for feature detection
  const grayscale = []
  for (let gy = y; gy < y + h && gy < height; gy++) {
    for (let gx = x; gx < x + w && gx < width; gx++) {
      const idx = (gy * width + gx) * 4
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      grayscale.push(gray)
    }
  }
  
  const regionWidth = Math.min(w, width - x)
  const regionHeight = Math.min(h, height - y)
  
  if (regionWidth < 10 || regionHeight < 10) return 0
  
  // Feature 1: Eye regions (darker areas in upper 1/3)
  const eyeRegionScore = detectEyeRegions(grayscale, regionWidth, regionHeight)
  if (eyeRegionScore > 0.3) {
    score += eyeRegionScore
    features++
  }
  
  // Feature 2: Mouth region (darker area in lower 1/3)
  const mouthRegionScore = detectMouthRegion(grayscale, regionWidth, regionHeight)
  if (mouthRegionScore > 0.2) {
    score += mouthRegionScore * 0.7
    features++
  }
  
  // Feature 3: Nose region (lighter area in middle)
  const noseRegionScore = detectNoseRegion(grayscale, regionWidth, regionHeight)
  if (noseRegionScore > 0.2) {
    score += noseRegionScore * 0.5
    features++
  }
  
  // Feature 4: Face symmetry
  const symmetryScore = calculateSymmetry(grayscale, regionWidth, regionHeight)
  if (symmetryScore > 0.6) {
    score += symmetryScore * 0.3
    features++
  }
  
  // Normalize by number of features found
  return features > 0 ? score / Math.max(features, 2) : 0
}

function detectEyeRegions(grayscale, width, height) {
  const eyeY = Math.floor(height * 0.2)
  const eyeHeight = Math.floor(height * 0.3)
  const leftEyeX = Math.floor(width * 0.2)
  const rightEyeX = Math.floor(width * 0.7)
  const eyeWidth = Math.floor(width * 0.15)
  
  let leftEyeScore = 0
  let rightEyeScore = 0
  
  // Check for dark regions in eye areas
  const avgBrightness = grayscale.reduce((sum, val) => sum + val, 0) / grayscale.length
  
  // Left eye region
  for (let y = eyeY; y < eyeY + eyeHeight && y < height; y++) {
    for (let x = leftEyeX; x < leftEyeX + eyeWidth && x < width; x++) {
      const idx = y * width + x
      if (idx < grayscale.length && grayscale[idx] < avgBrightness * 0.8) {
        leftEyeScore++
      }
    }
  }
  
  // Right eye region
  for (let y = eyeY; y < eyeY + eyeHeight && y < height; y++) {
    for (let x = rightEyeX; x < rightEyeX + eyeWidth && x < width; x++) {
      const idx = y * width + x
      if (idx < grayscale.length && grayscale[idx] < avgBrightness * 0.8) {
        rightEyeScore++
      }
    }
  }
  
  const maxPossiblePixels = eyeWidth * eyeHeight * 2
  return (leftEyeScore + rightEyeScore) / maxPossiblePixels
}

function detectMouthRegion(grayscale, width, height) {
  const mouthY = Math.floor(height * 0.7)
  const mouthHeight = Math.floor(height * 0.2)
  const mouthX = Math.floor(width * 0.3)
  const mouthWidth = Math.floor(width * 0.4)
  
  let darkPixels = 0
  let totalPixels = 0
  
  const avgBrightness = grayscale.reduce((sum, val) => sum + val, 0) / grayscale.length
  
  for (let y = mouthY; y < mouthY + mouthHeight && y < height; y++) {
    for (let x = mouthX; x < mouthX + mouthWidth && x < width; x++) {
      const idx = y * width + x
      if (idx < grayscale.length) {
        totalPixels++
        if (grayscale[idx] < avgBrightness * 0.9) {
          darkPixels++
        }
      }
    }
  }
  
  return totalPixels > 0 ? darkPixels / totalPixels : 0
}

function detectNoseRegion(grayscale, width, height) {
  const noseY = Math.floor(height * 0.4)
  const noseHeight = Math.floor(height * 0.3)
  const noseX = Math.floor(width * 0.4)
  const noseWidth = Math.floor(width * 0.2)
  
  let brightPixels = 0
  let totalPixels = 0
  
  const avgBrightness = grayscale.reduce((sum, val) => sum + val, 0) / grayscale.length
  
  for (let y = noseY; y < noseY + noseHeight && y < height; y++) {
    for (let x = noseX; x < noseX + noseWidth && x < width; x++) {
      const idx = y * width + x
      if (idx < grayscale.length) {
        totalPixels++
        if (grayscale[idx] > avgBrightness * 1.05) {
          brightPixels++
        }
      }
    }
  }
  
  return totalPixels > 0 ? brightPixels / totalPixels : 0
}

function calculateSymmetry(grayscale, width, height) {
  const midX = Math.floor(width / 2)
  let symmetryScore = 0
  let comparisons = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < midX; x++) {
      const leftIdx = y * width + x
      const rightIdx = y * width + (width - 1 - x)
      
      if (leftIdx < grayscale.length && rightIdx < grayscale.length) {
        const diff = Math.abs(grayscale[leftIdx] - grayscale[rightIdx])
        symmetryScore += 1 - (diff / 255)
        comparisons++
      }
    }
  }
  
  return comparisons > 0 ? symmetryScore / comparisons : 0
}

function clusterSkinPixels(skinPixels, imageData) {
  const { width, height, data } = imageData
  
  // Create a density map for better clustering
  const densityMap = new Array(width * height).fill(0)
  
  // Fill density map with skin pixels
  skinPixels.forEach(pixel => {
    const idx = pixel.y * width + pixel.x
    densityMap[idx] = 1
  })
  
  // Apply morphological operations to clean up the map
  const cleanedMap = applyMorphologicalOps(densityMap, width, height)
  
  // Find connected components using flood fill
  const visited = new Set()
  const clusters = []
  
  for (const pixel of skinPixels) {
    const key = `${pixel.x},${pixel.y}`
    if (visited.has(key)) continue
    
    const cluster = floodFill(pixel.x, pixel.y, cleanedMap, width, height, visited)
    
    if (cluster.length >= 100) { // More substantial minimum for face regions
      const xs = cluster.map(p => p.x)
      const ys = cluster.map(p => p.y)
      
      let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0]
      for (let i = 1; i < xs.length; i++) {
        if (xs[i] < minX) minX = xs[i]
        if (xs[i] > maxX) maxX = xs[i]
      }
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] < minY) minY = ys[i]
        if (ys[i] > maxY) maxY = ys[i]
      }
      
      const clusterWidth = maxX - minX
      const clusterHeight = maxY - minY
      
      // Enhanced validation with facial feature detection
      const aspectRatio = clusterWidth / clusterHeight
      const minSize = Math.min(width, height) * 0.04 // At least 4% of image dimension
      const maxSize = Math.min(width, height) * 0.7  // At most 70% of image dimension
      
      const isValidSize = clusterWidth >= minSize && clusterHeight >= minSize &&
                         clusterWidth <= maxSize && clusterHeight <= maxSize
      const isValidAspectRatio = aspectRatio >= 0.5 && aspectRatio <= 2.0 // More face-like proportions
      
      // Check for facial features within the cluster region
      const faceScore = calculateFacelikeScore(data, width, height, minX, minY, clusterWidth, clusterHeight)
      
      console.log(`Cluster: ${clusterWidth.toFixed(1)}x${clusterHeight.toFixed(1)}, ratio: ${aspectRatio.toFixed(2)}, face score: ${faceScore.toFixed(3)}, pixels: ${cluster.length}`)
      
      if (isValidSize && isValidAspectRatio && faceScore > 0.3) {
        clusters.push(cluster)
        console.log(`Valid cluster accepted with face score: ${faceScore.toFixed(3)}`)
      } else {
        console.log(`Rejected cluster: size=${isValidSize}, ratio=${isValidAspectRatio}, faceScore=${faceScore.toFixed(3)} < 0.3`)
      }
    }
  }

  // Convert clusters to face bounding boxes with final validation
  const faces = clusters.map((cluster, index) => {
    const xs = cluster.map(p => p.x)
    const ys = cluster.map(p => p.y)
    
    // Avoid spreading large arrays to prevent stack overflow
    let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0]
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i]
      if (xs[i] > maxX) maxX = xs[i]
    }
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] < minY) minY = ys[i]
      if (ys[i] > maxY) maxY = ys[i]
    }
    
    // Conservative padding for faces
    const padding = 0.15
    const faceWidth = maxX - minX
    const faceHeight = maxY - minY
    
    const paddedMinX = Math.max(0, minX - faceWidth * padding)
    const paddedMinY = Math.max(0, minY - faceHeight * padding)
    const paddedMaxX = Math.min(width, maxX + faceWidth * padding)
    const paddedMaxY = Math.min(height, maxY + faceHeight * padding)

    const finalWidth = paddedMaxX - paddedMinX
    const finalHeight = paddedMaxY - paddedMinY
    const finalAspectRatio = finalWidth / finalHeight

    return {
      id: `face-worker-${Date.now()}-${index}`,
      bbox: {
        x: (paddedMinX / width) * 100,
        y: (paddedMinY / height) * 100,
        width: (finalWidth / width) * 100,
        height: (finalHeight / height) * 100
      },
      confidence: Math.min(0.85, (cluster.length / 100) * (finalAspectRatio >= 0.7 && finalAspectRatio <= 1.5 ? 1.2 : 0.8)), // Boost confidence for face-like ratios
      eyeState: analyzeEyeStateHeuristic(
        { width, height, data: imageData.data }, 
        {
          x: (paddedMinX / width) * 100,
          y: (paddedMinY / height) * 100,
          width: (finalWidth / width) * 100,
          height: (finalHeight / height) * 100
        }
      ),
      focusScore: calculateFaceFocusScore(imageData, {
        x: (paddedMinX / width) * 100,
        y: (paddedMinY / height) * 100,
        width: (finalWidth / width) * 100,
        height: (finalHeight / height) * 100
      })
    }
  }).filter(face => {
    // Final filtering: reject faces that are too large (likely false positives)
    const faceArea = face.bbox.width * face.bbox.height
    const imageArea = 100 * 100 // 100% * 100%
    const areaRatio = faceArea / imageArea
    
    console.log(`Face area ratio: ${areaRatio.toFixed(3)} (${face.bbox.width.toFixed(1)}% x ${face.bbox.height.toFixed(1)}%)`)
    
    // More lenient: reject faces that take up more than 90% of the image
    const accepted = areaRatio <= 0.9
    console.log(`Face ${accepted ? 'accepted' : 'rejected'} (area ratio: ${areaRatio.toFixed(3)})`)
    return accepted
  })

  console.log(`Final faces after area filtering: ${faces.length}`)
  return faces
}

function analyzeEyeStateHeuristic(imageData, face) {
  const { width, height, data } = imageData
  const { x, y, width: faceWidth, height: faceHeight } = face
  
  // Convert to pixels
  const faceX = (x / 100) * width
  const faceY = (y / 100) * height
  const faceW = (faceWidth / 100) * width
  const faceH = (faceHeight / 100) * height
  
  // Approximate eye regions (upper 40% of face)
  const eyeRegionY = faceY + faceH * 0.2
  const eyeRegionHeight = faceH * 0.3
  
  const leftEyeX = faceX + faceW * 0.2
  const rightEyeX = faceX + faceW * 0.7
  const eyeWidth = faceW * 0.2
  
  const leftEyeState = analyzeEyeRegionHeuristic(
    data, width, height,
    leftEyeX, eyeRegionY, eyeWidth, eyeRegionHeight
  )
  
  const rightEyeState = analyzeEyeRegionHeuristic(
    data, width, height,
    rightEyeX, eyeRegionY, eyeWidth, eyeRegionHeight
  )
  
  return {
    left: leftEyeState,
    right: rightEyeState
  }
}

function analyzeEyeRegionHeuristic(data, imageWidth, imageHeight, eyeX, eyeY, eyeWidth, eyeHeight) {
  let darkPixels = 0
  let totalPixels = 0
  
  const startX = Math.max(0, Math.floor(eyeX))
  const endX = Math.min(imageWidth, Math.floor(eyeX + eyeWidth))
  const startY = Math.max(0, Math.floor(eyeY))
  const endY = Math.min(imageHeight, Math.floor(eyeY + eyeHeight))
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * imageWidth + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      
      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      
      if (luminance < 80) { // Dark threshold for iris/pupil
        darkPixels++
      }
      totalPixels++
    }
  }
  
  if (totalPixels === 0) return 'unknown'
  
  const darkRatio = darkPixels / totalPixels
  
  // Heuristic: open eyes have more dark pixels (iris/pupil visible)
  if (darkRatio > 0.15) return 'open'
  if (darkRatio < 0.05) return 'closed'
  return 'unknown'
}

function calculateFaceFocusScore(imageData, face) {
  const { width, height, data } = imageData
  const { x, y, width: faceWidth, height: faceHeight } = face
  
  // Convert percentages to pixels
  const faceX = Math.floor((x / 100) * width)
  const faceY = Math.floor((y / 100) * height)
  const faceW = Math.floor((faceWidth / 100) * width)
  const faceH = Math.floor((faceHeight / 100) * height)
  
  // Calculate Laplacian variance for focus score
  let sum = 0
  let count = 0
  
  for (let fy = 1; fy < faceH - 1; fy++) {
    for (let fx = 1; fx < faceW - 1; fx++) {
      const y = faceY + fy
      const x = faceX + fx
      
      if (y < height - 1 && x < width - 1) {
        const idx = (y * width + x) * 4
        
        // Convert to grayscale
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        
        // Laplacian operator
        const neighbors = [
          // Get neighboring pixels' grayscale values
          0.299 * data[((y-1) * width + x) * 4] + 0.587 * data[((y-1) * width + x) * 4 + 1] + 0.114 * data[((y-1) * width + x) * 4 + 2],
          0.299 * data[((y+1) * width + x) * 4] + 0.587 * data[((y+1) * width + x) * 4 + 1] + 0.114 * data[((y+1) * width + x) * 4 + 2],
          0.299 * data[(y * width + (x-1)) * 4] + 0.587 * data[(y * width + (x-1)) * 4 + 1] + 0.114 * data[(y * width + (x-1)) * 4 + 2],
          0.299 * data[(y * width + (x+1)) * 4] + 0.587 * data[(y * width + (x+1)) * 4 + 1] + 0.114 * data[(y * width + (x+1)) * 4 + 2]
        ]
        
        const laplacian = Math.abs(-4 * gray + neighbors[0] + neighbors[1] + neighbors[2] + neighbors[3])
        sum += laplacian * laplacian
        count++
      }
    }
  }
  
  return count > 0 ? sum / count : 0
}

// Process face detection request
async function processFaceDetection(imageData, options = {}) {
  const startTime = performance.now()
  
  try {
    // For now, use fallback detection (skin tone based)
    // In a full implementation, this would try ONNX models first
    const faces = detectFacesBySkinTone(imageData)
    
    const processingTime = performance.now() - startTime
    
    return {
      faces,
      processingTime,
      detectorUsed: 'fallback',
      eyeDetectionAvailable: false
    }
  } catch (error) {
    throw new Error(`Face detection failed: ${error.message}`)
  }
}

// Worker message handler
self.onmessage = async function(event) {
  const { id, type, payload } = event.data
  
  try {
    let result
    
    switch (type) {
      case MESSAGE_TYPES.INITIALIZE:
        await initializeFaceDetection(payload.options)
        result = { success: true }
        break
        
      case MESSAGE_TYPES.DETECT_FACES:
        result = await processFaceDetection(payload.imageData, payload.options)
        break
        
      case MESSAGE_TYPES.UPDATE_SETTINGS:
        self.faceDetectionSettings = { ...self.faceDetectionSettings, ...payload.settings }
        result = { success: true }
        break
        
      case MESSAGE_TYPES.DISPOSE:
        isInitialized = false
        faceDetectionManager = null
        result = { success: true }
        break
        
      default:
        throw new Error(`Unknown message type: ${type}`)
    }

    self.postMessage({
      id,
      success: true,
      result
    })
    
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message || 'Unknown error'
    })
  }
}