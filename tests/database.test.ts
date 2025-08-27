import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PhotoCullDB } from '../lib/store/db'
import { ImageRec } from '../lib/types'

describe('Database Operations', () => {
  let testDb: PhotoCullDB
  
  beforeEach(async () => {
    // Create a fresh database for each test
    testDb = new PhotoCullDB()
    await testDb.open()
    await testDb.clearAll()
  })
  
  afterEach(async () => {
    await testDb.close()
  })
  
  it('should add and retrieve images', async () => {
    const mockImage: ImageRec = {
      id: 'test-image-1',
      fileName: 'test.jpg',
      filePath: '/test/test.jpg',
      fileSize: 1024,
      fileType: 'image/jpeg',
      metadata: {},
      rating: 0,
      flag: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      importSessionId: 'test-session'
    }
    
    await testDb.images.add(mockImage)
    
    const retrieved = await testDb.images.get('test-image-1')
    expect(retrieved).toBeDefined()
    expect(retrieved?.fileName).toBe('test.jpg')
  })
  
  it('should update image ratings', async () => {
    const mockImage: ImageRec = {
      id: 'test-image-2',
      fileName: 'test2.jpg',
      filePath: '/test/test2.jpg',
      fileSize: 2048,
      fileType: 'image/jpeg',
      metadata: {},
      rating: 0,
      flag: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      importSessionId: 'test-session'
    }
    
    await testDb.images.add(mockImage)
    await testDb.updateImageRating('test-image-2', 5)
    
    const updated = await testDb.images.get('test-image-2')
    expect(updated?.rating).toBe(5)
  })
  
  it('should create and manage groups', async () => {
    const mockImages: ImageRec[] = [
      {
        id: 'img-1',
        fileName: 'test1.jpg',
        filePath: '/test/test1.jpg',
        fileSize: 1024,
        fileType: 'image/jpeg',
        metadata: {},
        rating: 0,
        flag: null,
        createdAt: new Date(),
        modifiedAt: new Date(),
        importSessionId: 'test-session'
      },
      {
        id: 'img-2',
        fileName: 'test2.jpg',
        filePath: '/test/test2.jpg',
        fileSize: 1024,
        fileType: 'image/jpeg',
        metadata: {},
        rating: 0,
        flag: null,
        createdAt: new Date(),
        modifiedAt: new Date(),
        importSessionId: 'test-session'
      }
    ]
    
    // Add images
    await testDb.images.bulkAdd(mockImages)
    
    // Create group
    const group = await testDb.createGroup(['img-1', 'img-2'], 'img-1')
    
    expect(group.memberIds).toEqual(['img-1', 'img-2'])
    expect(group.autoPickId).toBe('img-1')
    
    // Check that images are assigned to group
    const img1 = await testDb.images.get('img-1')
    const img2 = await testDb.images.get('img-2')
    
    expect(img1?.groupId).toBe(group.id)
    expect(img2?.groupId).toBe(group.id)
  })
})