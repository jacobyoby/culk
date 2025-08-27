export interface ImageMetadata {
  make?: string
  model?: string
  lens?: string
  focalLength?: number
  aperture?: number
  shutterSpeed?: string
  iso?: number
  dateTime?: Date
  width?: number
  height?: number
  orientation?: number
  gpsLatitude?: number
  gpsLongitude?: number
}

export interface ImageRec {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  fileHandle?: FileSystemFileHandle
  
  previewDataUrl?: string
  thumbnailDataUrl?: string
  
  metadata: ImageMetadata
  
  phash?: string
  focusScore?: number
  blurScore?: number
  exposureScore?: number
  
  faces?: FaceDetection[]
  
  autoCropRegion?: {
    x: number
    y: number
    width: number
    height: number
    confidence: number
    method: string
  }
  
  rating: number
  flag: 'pick' | 'reject' | null
  label?: string
  
  groupId?: string
  isAutoPick?: boolean
  
  createdAt: Date
  modifiedAt: Date
  importSessionId: string
}

export interface FaceDetection {
  id: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  landmarks?: {
    leftEye?: { x: number; y: number }
    rightEye?: { x: number; y: number }
    nose?: { x: number; y: number }
    mouth?: { x: number; y: number }
  }
  eyeState?: {
    left: 'open' | 'closed' | 'unknown'
    right: 'open' | 'closed' | 'unknown'
    confidence: number
  }
  focusScore?: number
}

export interface GroupRec {
  id: string
  memberIds: string[]
  autoPickId?: string
  representative?: string
  score?: number
  createdAt: Date
  modifiedAt: Date
}

export interface ProjectMeta {
  id: string
  name: string
  createdAt: Date
  modifiedAt: Date
  
  settings: {
    similarityThreshold: number
    blurThreshold: number
    minFaceConfidence: number
    autoPickWeights: {
      sharpness: number
      eyesOpen: number
      faceSize: number
      exposure: number
    }
    exportSettings: {
      includeXMP: boolean
      includeJSON: boolean
      includeCSV: boolean
      xmpTemplate?: string
    }
  }
  
  stats: {
    totalImages: number
    ratedImages: number
    picks: number
    rejects: number
    groups: number
  }
}

export interface ImportSession {
  id: string
  folderName: string
  startedAt: Date
  completedAt?: Date
  totalFiles: number
  processedFiles: number
  failedFiles: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errors: Array<{ file: string; error: string }>
}

export type ViewMode = 'filmstrip' | 'loupe' | 'compare' | 'survey'

export interface UIState {
  viewMode: ViewMode
  selectedImageIds: string[]
  currentImageId?: string
  zoom: number
  panX: number
  panY: number
  showFaceBoxes: boolean
  showMetadata: boolean
  showHistogram: boolean
  compareImages: string[]
  surveyImages: string[]
  filterMode?: 'all' | 'picks' | 'rejects' | 'unrated' | 'blurry' | 'eyes-closed'
  sortMode: 'capture-time' | 'import-time' | 'rating' | 'name'
  sortDirection: 'asc' | 'desc'
}