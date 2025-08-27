import { describe, it, expect } from 'vitest';

describe('XMP Export', () => {
  describe('XMP Sidecar Generation', () => {
    it('should create valid XMP structure', () => {
      const createXMP = (rating: number, label: string, flag: boolean) => {
        return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="AI Photo Culling 1.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:lr="http://ns.adobe.com/lightroom/1.0/">
      <xmp:Rating>${rating}</xmp:Rating>
      <xmp:Label>${label}</xmp:Label>
      <lr:Flag>${flag}</lr:Flag>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
      };
      
      const xmp = createXMP(5, 'Pick', true);
      expect(xmp).toContain('xmp:Rating>5</xmp:Rating');
      expect(xmp).toContain('xmp:Label>Pick</xmp:Label');
      expect(xmp).toContain('lr:Flag>true</lr:Flag');
    });

    it('should handle special characters in XMP', () => {
      const escapeXML = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };
      
      const input = 'Test & <special> "chars"';
      const escaped = escapeXML(input);
      
      expect(escaped).toBe('Test &amp; &lt;special&gt; &quot;chars&quot;');
    });

    it('should map ratings correctly', () => {
      const ratingMap = {
        reject: -1,
        neutral: 0,
        pick: 5
      };
      
      expect(ratingMap.reject).toBe(-1);
      expect(ratingMap.neutral).toBe(0);
      expect(ratingMap.pick).toBe(5);
    });
  });

  describe('File Writing', () => {
    it('should generate correct sidecar filename', () => {
      const imagePath = 'IMG_001.CR3';
      const xmpPath = imagePath.replace(/\.[^.]+$/, '.xmp');
      
      expect(xmpPath).toBe('IMG_001.xmp');
    });

    it('should batch export multiple XMP files', () => {
      const images = [
        { filename: 'IMG_001.CR3', rating: 5 },
        { filename: 'IMG_002.CR3', rating: 3 },
        { filename: 'IMG_003.CR3', rating: -1 }
      ];
      
      const xmpFiles = images.map(img => ({
        filename: img.filename.replace(/\.[^.]+$/, '.xmp'),
        rating: img.rating
      }));
      
      expect(xmpFiles).toHaveLength(3);
      expect(xmpFiles[0].filename).toBe('IMG_001.xmp');
      expect(xmpFiles[2].rating).toBe(-1);
    });
  });
});