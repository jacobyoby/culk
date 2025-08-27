export async function generateThumbnail(
  file: File | Blob,
  maxWidth: number,
  maxHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    img.onload = () => {
      const { width, height } = calculateAspectRatio(
        img.width,
        img.height,
        maxWidth,
        maxHeight
      )
      
      canvas.width = width
      canvas.height = height
      
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        'image/jpeg',
        0.8
      )
      
      URL.revokeObjectURL(img.src)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

export function calculateAspectRatio(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight)
  
  return {
    width: Math.round(srcWidth * ratio),
    height: Math.round(srcHeight * ratio)
  }
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function getImageDimensions(
  file: File | Blob
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  
  try {
    const img = await loadImageElement(url)
    return { width: img.width, height: img.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(parts[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)
  
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  
  return new Blob([u8arr], { type: mime })
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function calculateFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

export function getImageOrientation(orientation?: number): {
  transform: string
  width: number
  height: number
} {
  switch (orientation) {
    case 2:
      return { transform: 'scaleX(-1)', width: 1, height: 1 }
    case 3:
      return { transform: 'rotate(180deg)', width: 1, height: 1 }
    case 4:
      return { transform: 'scaleY(-1)', width: 1, height: 1 }
    case 5:
      return { transform: 'rotate(-90deg) scaleX(-1)', width: 0, height: 1 }
    case 6:
      return { transform: 'rotate(90deg)', width: 0, height: 1 }
    case 7:
      return { transform: 'rotate(90deg) scaleX(-1)', width: 0, height: 1 }
    case 8:
      return { transform: 'rotate(-90deg)', width: 0, height: 1 }
    default:
      return { transform: '', width: 1, height: 1 }
  }
}