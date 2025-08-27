import { describe, it, expect } from 'vitest'
import { hammingDistance, areSimilar } from '../lib/similarity/phash'

describe('pHash Similarity', () => {
  it('should calculate hamming distance correctly', () => {
    const hash1 = '1111000011110000'
    const hash2 = '1111000011110001'
    
    const distance = hammingDistance(hash1, hash2)
    expect(distance).toBe(1)
  })
  
  it('should identify similar images', () => {
    const hash1 = '1111000011110000'
    const hash2 = '1111000011110001' // 1 bit different
    
    const similar = areSimilar(hash1, hash2, 5)
    expect(similar).toBe(true)
  })
  
  it('should identify dissimilar images', () => {
    const hash1 = '1111000011110000'
    const hash2 = '0000111100001111' // 16 bits different
    
    const similar = areSimilar(hash1, hash2, 5)
    expect(similar).toBe(false)
  })
  
  it('should handle identical hashes', () => {
    const hash1 = '1111000011110000'
    const hash2 = '1111000011110000'
    
    const distance = hammingDistance(hash1, hash2)
    expect(distance).toBe(0)
    
    const similar = areSimilar(hash1, hash2, 5)
    expect(similar).toBe(true)
  })
})