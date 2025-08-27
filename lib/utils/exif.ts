import ExifReader from 'exifreader'
import { ImageMetadata } from '../types'

export async function extractMetadata(file: File | Blob): Promise<ImageMetadata> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const tags = ExifReader.load(arrayBuffer)
    
    const metadata: ImageMetadata = {}
    
    if (tags.Make) metadata.make = tags.Make.description
    if (tags.Model) metadata.model = tags.Model.description
    if (tags.LensModel) metadata.lens = tags.LensModel.description
    if (tags.FocalLength) metadata.focalLength = tags.FocalLength.value as number
    if (tags.FNumber) metadata.aperture = tags.FNumber.value as number
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
  if (!aperture) return ''
  return `f/${aperture}`
}

export function formatFocalLength(focalLength: number): string {
  if (!focalLength) return ''
  return `${Math.round(focalLength)}mm`
}

export function formatISO(iso: number): string {
  if (!iso) return ''
  return `ISO ${iso}`
}