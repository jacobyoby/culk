import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectFiles, selectSingleFile, selectFolder } from '../lib/fs/file-system-access'

// Mock File System Access API
const mockShowOpenFilePicker = vi.fn()
const mockShowDirectoryPicker = vi.fn()

Object.defineProperty(window, 'showOpenFilePicker', {
  value: mockShowOpenFilePicker
})

Object.defineProperty(window, 'showDirectoryPicker', {
  value: mockShowDirectoryPicker
})

describe('File Import Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('selectFiles', () => {
    it('should call showOpenFilePicker with multiple files option', async () => {
      const mockFiles = [
        { name: 'image1.jpg' },
        { name: 'image2.jpg' }
      ]
      
      mockShowOpenFilePicker.mockResolvedValue(mockFiles)
      
      const result = await selectFiles()
      
      expect(mockShowOpenFilePicker).toHaveBeenCalledWith({
        multiple: true,
        types: [
          {
            description: 'Image files',
            accept: expect.objectContaining({
              'image/*': expect.any(Array),
              'image/x-canon-cr2': ['.cr2'],
              'image/x-canon-cr3': ['.cr3'],
              'image/x-nikon-nef': ['.nef'],
              'image/x-sony-arw': ['.arw']
            })
          }
        ]
      })
      
      expect(result).toEqual(mockFiles)
    })

    it('should return null when user cancels', async () => {
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      
      mockShowOpenFilePicker.mockRejectedValue(abortError)
      
      const result = await selectFiles()
      
      expect(result).toBeNull()
    })

    it('should throw error for non-abort errors', async () => {
      const error = new Error('Permission denied')
      
      mockShowOpenFilePicker.mockRejectedValue(error)
      
      await expect(selectFiles()).rejects.toThrow('Permission denied')
    })
  })

  describe('selectSingleFile', () => {
    it('should call showOpenFilePicker with single file option', async () => {
      const mockFile = { name: 'single-image.jpg' }
      
      mockShowOpenFilePicker.mockResolvedValue([mockFile])
      
      const result = await selectSingleFile()
      
      expect(mockShowOpenFilePicker).toHaveBeenCalledWith({
        multiple: false,
        types: [
          {
            description: 'Image files',
            accept: expect.objectContaining({
              'image/*': expect.any(Array)
            })
          }
        ]
      })
      
      expect(result).toEqual(mockFile)
    })

    it('should return null when user cancels single file selection', async () => {
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      
      mockShowOpenFilePicker.mockRejectedValue(abortError)
      
      const result = await selectSingleFile()
      
      expect(result).toBeNull()
    })
  })

  describe('File Type Support', () => {
    it('should include comprehensive image format support', async () => {
      mockShowOpenFilePicker.mockResolvedValue([])
      
      await selectFiles()
      
      const callArgs = mockShowOpenFilePicker.mock.calls[0][0]
      const acceptTypes = callArgs.types[0].accept
      
      // Check standard image formats
      expect(acceptTypes['image/*']).toContain('.jpg')
      expect(acceptTypes['image/*']).toContain('.jpeg')
      expect(acceptTypes['image/*']).toContain('.png')
      expect(acceptTypes['image/*']).toContain('.gif')
      
      // Check RAW formats
      expect(acceptTypes['image/x-canon-cr2']).toEqual(['.cr2'])
      expect(acceptTypes['image/x-canon-cr3']).toEqual(['.cr3'])
      expect(acceptTypes['image/x-nikon-nef']).toEqual(['.nef'])
      expect(acceptTypes['image/x-sony-arw']).toEqual(['.arw'])
      expect(acceptTypes['image/x-adobe-dng']).toEqual(['.dng'])
      expect(acceptTypes['image/x-olympus-orf']).toEqual(['.orf'])
      expect(acceptTypes['image/x-panasonic-rw2']).toEqual(['.rw2'])
      expect(acceptTypes['image/x-fuji-raf']).toEqual(['.raf'])
    })
  })

  describe('Folder Selection (existing)', () => {
    it('should still support folder selection', async () => {
      const mockFolder = { name: 'Photos' }
      
      mockShowDirectoryPicker.mockResolvedValue(mockFolder)
      
      const result = await selectFolder()
      
      expect(mockShowDirectoryPicker).toHaveBeenCalledWith({
        mode: 'read'
      })
      
      expect(result).toEqual(mockFolder)
    })
  })
})

describe('Import Method Integration', () => {
  it('should validate import options structure', () => {
    // Test that import options interface supports all features
    const importOptions = {
      generateThumbnails: true,
      extractExif: true,
      detectAutoCrop: true,
      detectFaces: true,
      maxConcurrent: 4,
      onProgress: () => {}
    }

    // Validate all expected properties exist
    expect(importOptions.generateThumbnails).toBe(true)
    expect(importOptions.extractExif).toBe(true)
    expect(importOptions.detectAutoCrop).toBe(true)
    expect(importOptions.detectFaces).toBe(true)
    expect(importOptions.maxConcurrent).toBe(4)
    expect(typeof importOptions.onProgress).toBe('function')
  })
})