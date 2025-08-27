import ExifReader from 'exifreader'
import { ImageMetadata } from '../types'

export async function extractMetadata(file: File | Blob): Promise<ImageMetadata> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const tags = ExifReader.load(arrayBuffer)
    
    const metadata: ImageMetadata = {}
    
    if (tags.Make) metadata.make = tags.Make.description
    if (tags.Model) metadata.model = tags.Model.description
    if (tags.LensModel || tags.LensInfo) {
      metadata.lens = tags.LensModel?.description || tags.LensInfo?.description
    }
    
    // Focal Length - try multiple sources and handle ratios
    if (tags.FocalLength) {
      let focalLengthValue = tags.FocalLength.value as any
      console.log('Raw focal length data:', {
        value: focalLengthValue, 
        description: tags.FocalLength.description,
        type: typeof focalLengthValue
      })
      
      // Try description first as it might have the correct value
      if (tags.FocalLength.description) {
        const descMatch = tags.FocalLength.description.match(/([0-9.]+)/);
        if (descMatch) {
          const descValue = parseFloat(descMatch[1]);
          if (!isNaN(descValue)) {
            metadata.focalLength = Math.round(descValue);
          }
        }
      } else {
        // Handle rational numbers (array of [numerator, denominator])
        if (Array.isArray(focalLengthValue) && focalLengthValue.length === 2) {
          focalLengthValue = focalLengthValue[0] / focalLengthValue[1]
        } else if (Array.isArray(focalLengthValue)) {
          focalLengthValue = focalLengthValue[0]
        }
        
        const focalLengthNum = parseFloat(focalLengthValue)
        if (!isNaN(focalLengthNum)) {
          if (focalLengthNum > 1000) {
            metadata.focalLength = Math.round(focalLengthNum / 100)
          } else {
            metadata.focalLength = Math.round(focalLengthNum)
          }
        }
      }
    }
    
    // Aperture - handle various formats and ratios
    if (tags.FNumber || tags.ApertureValue) {
      const apertureTag = tags.FNumber || tags.ApertureValue
      let apertureValue = apertureTag?.value
      console.log('Raw aperture data:', {
        value: apertureValue, 
        description: apertureTag?.description,
        type: typeof apertureValue
      })
      
      // Try description first as it might have the correct f-stop value
      if (apertureTag?.description) {
        const descMatch = apertureTag.description.match(/([0-9.]+)/)
        if (descMatch) {
          const descValue = parseFloat(descMatch[1])
          if (!isNaN(descValue)) {
            metadata.aperture = parseFloat(descValue.toFixed(1))
          }
        }
      } else {
        // Handle rational numbers (array of [numerator, denominator])
        if (Array.isArray(apertureValue) && apertureValue.length === 2) {
          apertureValue = apertureValue[0] / apertureValue[1]
        } else if (Array.isArray(apertureValue)) {
          apertureValue = apertureValue[0]
        }
        
        const apertureNum = parseFloat(apertureValue)
        if (!isNaN(apertureNum)) {
          if (apertureNum > 1000) {
            metadata.aperture = parseFloat((apertureNum / 1000).toFixed(1))
          } else if (apertureNum > 100) {
            metadata.aperture = parseFloat((apertureNum / 100).toFixed(1))
          } else if (apertureNum > 10) {
            metadata.aperture = parseFloat((apertureNum / 10).toFixed(1))
          } else {
            metadata.aperture = parseFloat(apertureNum.toFixed(1))
          }
        }
      }
    }
    if (tags.ExposureTime) metadata.shutterSpeed = tags.ExposureTime.description
    if (tags.ISOSpeedRatings) metadata.iso = tags.ISOSpeedRatings.value as number
    if (tags.DateTimeOriginal) {
      metadata.dateTime = parseExifDate(tags.DateTimeOriginal.description)
    }
    if (tags.ImageWidth) metadata.width = tags.ImageWidth.value as number
    if (tags.ImageHeight) metadata.height = tags.ImageHeight.value as number
    if (tags.Orientation) metadata.orientation = tags.Orientation.value as number
    
    if (tags.GPSLatitude && tags.GPSLatitudeRef) {
      metadata.gpsLatitude = convertDMSToDD(
        tags.GPSLatitude.description,
        tags.GPSLatitudeRef.value as string
      )
    }
    
    if (tags.GPSLongitude && tags.GPSLongitudeRef) {
      metadata.gpsLongitude = convertDMSToDD(
        tags.GPSLongitude.description,
        tags.GPSLongitudeRef.value as string
      )
    }
    
    return metadata
  } catch (error) {
    console.error('Failed to extract EXIF data:', error)
    return {}
  }
}

function parseExifDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  
  const parts = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!parts) return undefined
  
  const [, year, month, day, hour, minute, second] = parts
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  )
}

function convertDMSToDD(dms: string, ref: string): number {
  const parts = dms.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"/)
  if (!parts) return 0
  
  const [, degrees, minutes, seconds] = parts
  let dd = parseInt(degrees) + parseInt(minutes) / 60 + parseFloat(seconds) / 3600
  
  if (ref === 'S' || ref === 'W') {
    dd = -dd
  }
  
  return dd
}

export function formatExposureTime(shutterSpeed: string): string {
  if (!shutterSpeed) return ''
  
  const match = shutterSpeed.match(/1\/(\d+)/)
  if (match) {
    return `1/${match[1]}s`
  }
  
  const decimal = parseFloat(shutterSpeed)
  if (!isNaN(decimal)) {
    if (decimal < 1) {
      const denominator = Math.round(1 / decimal)
      return `1/${denominator}s`
    }
    return `${decimal}s`
  }
  
  return shutterSpeed
}

export function formatAperture(aperture: number): string {
  if (!aperture || isNaN(aperture)) return ''
  // Ensure we use a dot as decimal separator, not comma
  const apertureStr = aperture.toFixed(1).replace(',', '.')
  return `f/${apertureStr}`
}

export function formatFocalLength(focalLength: number): string {
  if (!focalLength || isNaN(focalLength)) return ''
  return `${Math.round(focalLength)}mm`
}

export function formatISO(iso: number): string {
  if (!iso) return ''
  return `ISO ${iso}`
}