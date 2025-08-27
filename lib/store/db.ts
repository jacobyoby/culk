import Dexie, { Table } from 'dexie'
import { ImageRec, GroupRec, ProjectMeta, ImportSession } from '../types'

export class PhotoCullDB extends Dexie {
  images!: Table<ImageRec, string>
  groups!: Table<GroupRec, string>
  projects!: Table<ProjectMeta, string>
  sessions!: Table<ImportSession, string>

  constructor() {
    super('PhotoCullDB')
    
    this.version(1).stores({
      images: 'id, fileName, filePath, groupId, rating, flag, importSessionId, createdAt, modifiedAt',
      groups: 'id, autoPickId, createdAt, modifiedAt',
      projects: 'id, name, createdAt, modifiedAt',
      sessions: 'id, folderName, status, startedAt, completedAt'
    })
    
    this.images = this.table('images')
    this.groups = this.table('groups')
    this.projects = this.table('projects')
    this.sessions = this.table('sessions')
  }
  
  async clearAll() {
    await this.transaction('rw', this.images, this.groups, this.projects, this.sessions, async () => {
      await Promise.all([
        this.images.clear(),
        this.groups.clear(),
        this.projects.clear(),
        this.sessions.clear()
      ])
    })
  }
  
  async getImagesByGroup(groupId: string): Promise<ImageRec[]> {
    return await this.images.where('groupId').equals(groupId).toArray()
  }
  
  async getImagesByRating(rating: number): Promise<ImageRec[]> {
    return await this.images.where('rating').equals(rating).toArray()
  }
  
  async getImagesByFlag(flag: 'pick' | 'reject'): Promise<ImageRec[]> {
    return await this.images.where('flag').equals(flag).toArray()
  }
  
  async getImagesBySession(sessionId: string): Promise<ImageRec[]> {
    return await this.images.where('importSessionId').equals(sessionId).toArray()
  }
  
  async updateImageRating(imageId: string, rating: number) {
    await this.images.update(imageId, { 
      rating, 
      modifiedAt: new Date() 
    })
  }
  
  async updateImageFlag(imageId: string, flag: 'pick' | 'reject' | null) {
    await this.images.update(imageId, { 
      flag, 
      modifiedAt: new Date() 
    })
  }

  async updateImageCrop(imageId: string, updates: Partial<ImageRec>) {
    await this.images.update(imageId, {
      ...updates,
      modifiedAt: new Date()
    })
  }
  
  async createGroup(memberIds: string[], autoPickId?: string): Promise<GroupRec> {
    const group: GroupRec = {
      id: crypto.randomUUID(),
      memberIds,
      autoPickId,
      createdAt: new Date(),
      modifiedAt: new Date()
    }
    
    await this.transaction('rw', this.groups, this.images, async () => {
      await this.groups.add(group)
      await Promise.all(
        memberIds.map(id => 
          this.images.update(id, { 
            groupId: group.id,
            modifiedAt: new Date()
          })
        )
      )
    })
    
    return group
  }
  
  async disbandGroup(groupId: string) {
    await this.transaction('rw', this.groups, this.images, async () => {
      const images = await this.getImagesByGroup(groupId)
      await Promise.all(
        images.map(img => 
          this.images.update(img.id, { 
            groupId: undefined,
            isAutoPick: false,
            modifiedAt: new Date()
          })
        )
      )
      await this.groups.delete(groupId)
    })
  }
  
  async getCurrentProject(): Promise<ProjectMeta | undefined> {
    const projects = await this.projects.toArray()
    return projects[0]
  }
  
  async initProject(name: string = 'Default Project'): Promise<ProjectMeta> {
    const existingProject = await this.getCurrentProject()
    if (existingProject) {
      return existingProject
    }
    
    const project: ProjectMeta = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
      modifiedAt: new Date(),
      settings: {
        similarityThreshold: 15,
        blurThreshold: 100,
        minFaceConfidence: 0.7,
        autoPickWeights: {
          sharpness: 0.4,
          eyesOpen: 0.3,
          faceSize: 0.2,
          exposure: 0.1
        },
        exportSettings: {
          includeXMP: true,
          includeJSON: false,
          includeCSV: false
        }
      },
      stats: {
        totalImages: 0,
        ratedImages: 0,
        picks: 0,
        rejects: 0,
        groups: 0
      }
    }
    
    await this.projects.add(project)
    return project
  }
  
  async updateProjectStats() {
    const project = await this.getCurrentProject()
    if (!project) return
    
    const [totalImages, picks, rejects, groups, images] = await Promise.all([
      this.images.count(),
      this.images.where('flag').equals('pick').count(),
      this.images.where('flag').equals('reject').count(),
      this.groups.count(),
      this.images.toArray()
    ])
    
    const ratedImages = images.filter(img => img.rating > 0).length
    
    await this.projects.update(project.id, {
      stats: {
        totalImages,
        ratedImages,
        picks,
        rejects,
        groups
      },
      modifiedAt: new Date()
    })
  }
}

export const db = new PhotoCullDB()