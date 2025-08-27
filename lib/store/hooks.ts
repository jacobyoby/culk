import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { ImageRec, GroupRec, ProjectMeta, ImportSession } from '../types'

export function useImages() {
  return useLiveQuery(() => db.images.toArray()) ?? []
}

export function useImage(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.images.get(id) : undefined),
    [id]
  )
}

export function useImagesByGroup(groupId: string | undefined) {
  return useLiveQuery(
    () => (groupId ? db.getImagesByGroup(groupId) : []),
    [groupId]
  ) ?? []
}

export function useImagesByRating(rating: number) {
  return useLiveQuery(
    () => db.getImagesByRating(rating),
    [rating]
  ) ?? []
}

export function useImagesByFlag(flag: 'pick' | 'reject' | null) {
  return useLiveQuery(
    () => flag ? db.getImagesByFlag(flag) : [],
    [flag]
  ) ?? []
}

export function useGroups() {
  return useLiveQuery(() => db.groups.toArray()) ?? []
}

export function useGroup(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.groups.get(id) : undefined),
    [id]
  )
}

export function useCurrentProject() {
  return useLiveQuery(() => db.getCurrentProject())
}

export function useImageActions() {
  return {
    updateRating: (imageId: string, rating: number) => db.updateImageRating(imageId, rating),
    updateFlag: (imageId: string, flag: 'pick' | 'reject' | null) => db.updateImageFlag(imageId, flag),
    updateCrop: (imageId: string, updates: Partial<ImageRec>) => db.updateImageCrop(imageId, updates)
  }
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.toArray()) ?? []
}

export function useSession(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.sessions.get(id) : undefined),
    [id]
  )
}

export function useFilteredImages(filter?: string) {
  return useLiveQuery(async () => {
    let images = await db.images.toArray()
    
    if (!filter || filter === 'all') {
      return images
    }
    
    switch (filter) {
      case 'picks':
        return images.filter(img => img.flag === 'pick')
      case 'rejects':
        return images.filter(img => img.flag === 'reject')
      case 'unrated':
        return images.filter(img => img.rating === 0)
      case 'blurry':
        return images.filter(img => 
          img.blurScore !== undefined && img.blurScore > (100)
        )
      case 'eyes-closed':
        return images.filter(img => 
          img.faces?.some(face => 
            face.eyeState?.left === 'closed' || 
            face.eyeState?.right === 'closed'
          )
        )
      default:
        return images
    }
  }, [filter]) ?? []
}

export function useSortedImages(
  sortMode: 'capture-time' | 'import-time' | 'rating' | 'name' = 'import-time',
  sortDirection: 'asc' | 'desc' = 'asc'
) {
  return useLiveQuery(async () => {
    const images = await db.images.toArray()
    
    const sorted = images.slice().sort((a, b) => {
      let comparison = 0
      
      switch (sortMode) {
        case 'capture-time':
          const aTime = a.metadata.dateTime?.getTime() ?? 0
          const bTime = b.metadata.dateTime?.getTime() ?? 0
          comparison = aTime - bTime
          break
        case 'import-time':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
        case 'rating':
          comparison = a.rating - b.rating
          break
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName)
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }, [sortMode, sortDirection]) ?? []
}