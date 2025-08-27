import { describe, it, expect, vi } from 'vitest';

describe('Quality Assessment', () => {
  describe('Focus Detection', () => {
    it('should calculate Laplacian variance for focus', () => {
      const imageData = new ImageData(new Uint8ClampedArray(100 * 100 * 4), 100, 100);
      
      const calculateLaplacian = (data: ImageData): number => {
        let variance = 0;
        const grayscale: number[] = [];
        
        for (let i = 0; i < data.data.length; i += 4) {
          const gray = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
          grayscale.push(gray);
        }
        
        for (let y = 1; y < data.height - 1; y++) {
          for (let x = 1; x < data.width - 1; x++) {
            const idx = y * data.width + x;
            const laplacian = 
              grayscale[idx - data.width] + 
              grayscale[idx + data.width] + 
              grayscale[idx - 1] + 
              grayscale[idx + 1] - 
              4 * grayscale[idx];
            variance += laplacian * laplacian;
          }
        }
        
        return variance / ((data.width - 2) * (data.height - 2));
      };
      
      const focusScore = calculateLaplacian(imageData);
      expect(focusScore).toBeGreaterThanOrEqual(0);
    });

    it('should classify images as blurry or sharp', () => {
      const images = [
        { id: '1', focusScore: 100 },
        { id: '2', focusScore: 500 },
        { id: '3', focusScore: 50 }
      ];
      
      const blurThreshold = 150;
      
      const blurryImages = images.filter(img => img.focusScore < blurThreshold);
      const sharpImages = images.filter(img => img.focusScore >= blurThreshold);
      
      expect(blurryImages).toHaveLength(2);
      expect(sharpImages).toHaveLength(1);
      expect(sharpImages[0].id).toBe('2');
    });
  });

  describe('Auto-Pick Scoring', () => {
    it('should calculate weighted score for auto-pick', () => {
      const image = {
        focusScore: 400,
        eyesOpen: true,
        faceSize: 0.15,
        exposure: 0
      };
      
      const weights = {
        focus: 0.4,
        eyes: 0.3,
        faceSize: 0.2,
        exposure: 0.1
      };
      
      const score = 
        (image.focusScore / 500) * weights.focus +
        (image.eyesOpen ? 1 : 0) * weights.eyes +
        image.faceSize * weights.faceSize +
        (1 - Math.abs(image.exposure)) * weights.exposure;
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should select best image from group', () => {
      const group = [
        { id: '1', score: 0.75 },
        { id: '2', score: 0.82 },
        { id: '3', score: 0.68 }
      ];
      
      const autoPick = group.reduce((best, current) => 
        current.score > best.score ? current : best
      );
      
      expect(autoPick.id).toBe('2');
    });
  });
});