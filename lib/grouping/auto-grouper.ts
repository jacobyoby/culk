import { db } from '../store/db'
import { ImageRec, GroupRec, ProjectMeta } from '../types'
import { hammingDistance, areSimilar } from '../similarity/phash'
import { calculateSSIM } from '../similarity/ssim'

export interface GroupingOptions {
  similarityThreshold?: number
  ssimThreshold?: number
  useSSIMRefinement?: boolean
  maxGroupSize?: number
  onProgress?: (progress: { current: number; total: number; status: string }) => void
}

export class AutoGrouper {
  private abortController: AbortController | null = null
  
  async groupSimilarImages(options: GroupingOptions = {}): Promise<GroupRec[]> {
    const {
      similarityThreshold = 15,
      ssimThreshold = 0.8,
      useSSIMRefinement = true,
      maxGroupSize = 10,
      onProgress
    } = options
    
    this.abortController = new AbortController()
    
    try {
      const images = await db.images.toArray()
      const ungroupedImages = images.filter(img => !img.groupId && img.phash)
      
      if (ungroupedImages.length === 0) {
        return []
      }
      
      onProgress?.({ 
        current: 0, 
        total: ungroupedImages.length, 
        status: 'Starting grouping process...' 
      })
      
      const groups: GroupRec[] = []
      const processedIds = new Set<string>()
      
      for (let i = 0; i < ungroupedImages.length; i++) {
        if (this.abortController.signal.aborted) break
        if (processedIds.has(ungroupedImages[i].id)) continue
        
        const baseImage = ungroupedImages[i]
        onProgress?.({
          current: i + 1,
          total: ungroupedImages.length,
          status: `Grouping ${baseImage.fileName}...`
        })
        
        const similarImages = await this.findSimilarImages(
          baseImage,
          ungroupedImages,
          processedIds,
          similarityThreshold,
          useSSIMRefinement ? ssimThreshold : undefined,
          maxGroupSize
        )
        
        if (similarImages.length > 1) {
          const group = await this.createGroup(similarImages)
          groups.push(group)
          
          // Mark all images in group as processed
          similarImages.forEach(img => processedIds.add(img.id))
        } else {
          processedIds.add(baseImage.id)
        }
      }
      
      await db.updateProjectStats()
      
      return groups
      
    } catch (error) {
      console.error('Grouping failed:', error)
      throw error
    }
  }
  
  private async findSimilarImages(
    baseImage: ImageRec,
    candidates: ImageRec[],
    processedIds: Set<string>,
    pHashThreshold: number,
    ssimThreshold?: number,
    maxGroupSize?: number
  ): Promise<ImageRec[]> {
    const similar = [baseImage]
    
    for (const candidate of candidates) {
      if (this.abortController?.signal.aborted) break
      if (processedIds.has(candidate.id)) continue
      if (candidate.id === baseImage.id) continue
      if (maxGroupSize && similar.length >= maxGroupSize) break
      
      if (!baseImage.phash || !candidate.phash) continue
      
      // First pass: pHash similarity
      if (areSimilar(baseImage.phash, candidate.phash, pHashThreshold)) {
        // Second pass: SSIM refinement (optional)
        if (ssimThreshold && baseImage.previewDataUrl && candidate.previewDataUrl) {
          try {
            const ssimScore = await this.calculateSSIMBetweenImages(baseImage, candidate)
            if (ssimScore >= ssimThreshold) {
              similar.push(candidate)
            }
          } catch (error) {
            // If SSIM fails, fall back to pHash only
            similar.push(candidate)
          }
        } else {
          similar.push(candidate)
        }
      }
    }
    
    return similar
  }
  
  private async calculateSSIMBetweenImages(img1: ImageRec, img2: ImageRec): Promise<number> {
    if (!img1.previewDataUrl || !img2.previewDataUrl) {
      throw new Error('Preview images required for SSIM calculation')
    }
    
    const [imgData1, imgData2] = await Promise.all([
      this.dataUrlToImageData(img1.previewDataUrl),
      this.dataUrlToImageData(img2.previewDataUrl)
    ])
    
    const result = calculateSSIM(imgData1, imgData2)
    return result.ssim
  }
  
  private dataUrlToImageData(dataUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        resolve(imageData)
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = dataUrl
    })
  }
  
  private async createGroup(images: ImageRec[]): Promise<GroupRec> {
    // Sort by quality score to pick the best as representative
    const sortedImages = [...images].sort((a, b) => {
      const scoreA = this.calculateImageScore(a)
      const scoreB = this.calculateImageScore(b)
      return scoreB - scoreA
    })
    
    const bestImage = sortedImages[0]
    const memberIds = images.map(img => img.id)
    
    const group = await db.createGroup(memberIds, bestImage.id)
    
    // Mark the best image as auto-pick
    await db.images.update(bestImage.id, {
      isAutoPick: true,
      modifiedAt: new Date()
    })
    
    return group
  }
  
  private calculateImageScore(image: ImageRec): number {
    let score = 0
    
    // Focus/sharpness score (higher is better)
    if (image.focusScore) {
      score += image.focusScore * 0.4
    }
    
    // Eye state (open eyes are better)
    if (image.faces && image.faces.length > 0) {
      const eyesOpenRatio = image.faces.filter(face => 
        face.eyeState?.left === 'open' && face.eyeState?.right === 'open'
      ).length / image.faces.length
      score += eyesOpenRatio * 0.3
    }
    
    // Face size (larger faces are often better)
    if (image.faces && image.faces.length > 0) {
      const avgFaceSize = image.faces.reduce((sum, face) => 
        sum + (face.bbox.width * face.bbox.height), 0
      ) / image.faces.length
      score += avgFaceSize * 0.2
    }
    
    // Exposure score (if available)
    if (image.exposureScore) {
      score += image.exposureScore * 0.1
    }
    
    // Prefer images with existing ratings
    if (image.rating > 0) {
      score += image.rating * 0.1
    }
    
    return score
  }
  
  async disbandAllGroups(): Promise<void> {
    const groups = await db.groups.toArray()
    
    for (const group of groups) {
      await db.disbandGroup(group.id)
    }
    
    await db.updateProjectStats()
  }
  
  async regroupAll(options: GroupingOptions = {}): Promise<GroupRec[]> {
    await this.disbandAllGroups()
    return this.groupSimilarImages(options)
  }
  
  abort(): void {
    this.abortController?.abort()
  }
}

export const autoGrouper = new AutoGrouper()