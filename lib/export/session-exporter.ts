import { db } from '../store/db'
import { ImageRec, GroupRec, ProjectMeta, ImportSession } from '../types'
import { xmpWriter, XMPExportOptions } from '../xmp/writer'

export interface ExportOptions {
  includeXMP?: boolean
  includeJSON?: boolean
  includeCSV?: boolean
  filterByRating?: number
  filterByFlag?: 'pick' | 'reject' | null
  includeGroups?: boolean
  includeMetadata?: boolean
  xmpOptions?: XMPExportOptions
}

export interface ExportResult {
  files: Array<{
    name: string
    content: string
    type: string
  }>
  summary: {
    totalImages: number
    exportedImages: number
    totalGroups: number
    exportedGroups: number
  }
}

export class SessionExporter {
  
  async exportSession(options: ExportOptions = {}): Promise<ExportResult> {
    const {
      includeXMP = true,
      includeJSON = false,
      includeCSV = false,
      filterByRating,
      filterByFlag,
      includeGroups = true,
      includeMetadata = true,
      xmpOptions = {}
    } = options
    
    // Get all data
    const allImages = await db.images.toArray()
    const groups = includeGroups ? await db.groups.toArray() : []
    const project = await db.getCurrentProject()
    
    // Filter images based on criteria
    let filteredImages = allImages
    
    if (filterByRating !== undefined) {
      filteredImages = filteredImages.filter(img => img.rating >= filterByRating)
    }
    
    if (filterByFlag !== undefined) {
      if (filterByFlag === null) {
        filteredImages = filteredImages.filter(img => img.flag === null)
      } else {
        filteredImages = filteredImages.filter(img => img.flag === filterByFlag)
      }
    }
    
    const files: Array<{ name: string; content: string; type: string }> = []
    
    // Generate XMP sidecars
    if (includeXMP && filteredImages.length > 0) {
      const xmpFiles = await xmpWriter.exportXMPSidecars(filteredImages, xmpOptions)
      xmpFiles.forEach(xmpFile => {
        files.push({
          name: xmpFile.fileName,
          content: xmpFile.content,
          type: 'application/xml'
        })
      })
    }
    
    // Generate JSON export
    if (includeJSON) {
      const jsonData = this.generateJSONExport(filteredImages, groups, project, includeMetadata)
      files.push({
        name: `photo-cull-session-${new Date().toISOString().split('T')[0]}.json`,
        content: JSON.stringify(jsonData, null, 2),
        type: 'application/json'
      })
    }
    
    // Generate CSV export
    if (includeCSV) {
      const csvData = this.generateCSVExport(filteredImages, includeMetadata)
      files.push({
        name: `photo-cull-session-${new Date().toISOString().split('T')[0]}.csv`,
        content: csvData,
        type: 'text/csv'
      })
    }
    
    return {
      files,
      summary: {
        totalImages: allImages.length,
        exportedImages: filteredImages.length,
        totalGroups: groups.length,
        exportedGroups: groups.filter(group => 
          group.memberIds.some(id => filteredImages.find(img => img.id === id))
        ).length
      }
    }
  }
  
  private generateJSONExport(
    images: ImageRec[],
    groups: GroupRec[],
    project: ProjectMeta | undefined,
    includeMetadata: boolean
  ) {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        tool: 'AI Photo Culling',
        includeMetadata
      },
      project: project ? {
        name: project.name,
        settings: project.settings,
        stats: project.stats
      } : null,
      images: images.map(image => ({
        id: image.id,
        fileName: image.fileName,
        filePath: image.filePath,
        fileSize: image.fileSize,
        fileType: image.fileType,
        
        rating: image.rating,
        flag: image.flag,
        label: image.label,
        
        groupId: image.groupId,
        isAutoPick: image.isAutoPick,
        
        ...(includeMetadata && {
          metadata: image.metadata,
          focusScore: image.focusScore,
          blurScore: image.blurScore,
          exposureScore: image.exposureScore,
          faces: image.faces?.map(face => ({
            bbox: face.bbox,
            confidence: face.confidence,
            eyeState: face.eyeState,
            focusScore: face.focusScore
          }))
        }),
        
        createdAt: image.createdAt,
        modifiedAt: image.modifiedAt,
        importSessionId: image.importSessionId
      })),
      
      groups: groups.map(group => ({
        id: group.id,
        memberIds: group.memberIds,
        autoPickId: group.autoPickId,
        representative: group.representative,
        score: group.score,
        createdAt: group.createdAt,
        modifiedAt: group.modifiedAt
      }))
    }
    
    return exportData
  }
  
  private generateCSVExport(images: ImageRec[], includeMetadata: boolean): string {
    const headers = [
      'File Name',
      'File Path',
      'File Size',
      'File Type',
      'Rating',
      'Flag',
      'Label',
      'Group ID',
      'Auto Pick',
      'Created At',
      'Modified At'
    ]
    
    if (includeMetadata) {
      headers.push(
        'Camera Make',
        'Camera Model',
        'Lens',
        'Focal Length',
        'Aperture',
        'Shutter Speed',
        'ISO',
        'Date Taken',
        'Width',
        'Height',
        'Focus Score',
        'Blur Score',
        'Face Count',
        'Eyes Open Count'
      )
    }
    
    const rows = images.map(image => {
      const baseRow = [
        this.escapeCsvValue(image.fileName),
        this.escapeCsvValue(image.filePath),
        image.fileSize.toString(),
        this.escapeCsvValue(image.fileType),
        image.rating.toString(),
        image.flag || '',
        image.label || '',
        image.groupId || '',
        image.isAutoPick ? 'true' : 'false',
        image.createdAt.toISOString(),
        image.modifiedAt.toISOString()
      ]
      
      if (includeMetadata) {
        const eyesOpenCount = image.faces?.filter(face => 
          face.eyeState?.left === 'open' && face.eyeState?.right === 'open'
        ).length || 0
        
        baseRow.push(
          image.metadata.make || '',
          image.metadata.model || '',
          image.metadata.lens || '',
          image.metadata.focalLength?.toString() || '',
          image.metadata.aperture?.toString() || '',
          image.metadata.shutterSpeed || '',
          image.metadata.iso?.toString() || '',
          image.metadata.dateTime?.toISOString() || '',
          image.metadata.width?.toString() || '',
          image.metadata.height?.toString() || '',
          image.focusScore?.toFixed(2) || '',
          image.blurScore?.toFixed(2) || '',
          image.faces?.length.toString() || '0',
          eyesOpenCount.toString()
        )
      }
      
      return baseRow
    })
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
  
  async downloadExport(options: ExportOptions = {}): Promise<void> {
    const result = await this.exportSession(options)
    
    if (result.files.length === 0) {
      throw new Error('No files to export')
    }
    
    if (result.files.length === 1) {
      // Single file download
      const file = result.files[0]
      this.downloadFile(file.content, file.name, file.type)
    } else {
      // Multiple files - would ideally create a ZIP
      // For now, download each file individually with a delay
      result.files.forEach((file, index) => {
        setTimeout(() => {
          this.downloadFile(file.content, file.name, file.type)
        }, index * 200)
      })
    }
  }
  
  private downloadFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }
  
  async getExportPreview(options: ExportOptions = {}): Promise<{
    imageCount: number
    groupCount: number
    fileTypes: string[]
    estimatedSize: number
  }> {
    const result = await this.exportSession(options)
    
    const fileTypes = [...new Set(result.files.map(f => f.type))]
    const estimatedSize = result.files.reduce((total, file) => 
      total + new Blob([file.content]).size, 0
    )
    
    return {
      imageCount: result.summary.exportedImages,
      groupCount: result.summary.exportedGroups,
      fileTypes,
      estimatedSize
    }
  }
}

export const sessionExporter = new SessionExporter()