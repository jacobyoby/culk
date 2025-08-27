import { ImageRec } from '../types'

export interface XMPExportOptions {
  includeRating?: boolean
  includeFlag?: boolean
  includeLabel?: boolean
  includeKeywords?: boolean
  customTemplate?: string
}

export class XMPWriter {
  
  generateXMP(image: ImageRec, options: XMPExportOptions = {}): string {
    const {
      includeRating = true,
      includeFlag = true,
      includeLabel = false,
      includeKeywords = false,
      customTemplate
    } = options
    
    if (customTemplate) {
      return this.applyTemplate(customTemplate, image)
    }
    
    const timestamp = new Date().toISOString()
    const rating = includeRating ? image.rating : 0
    const flag = includeFlag ? this.mapFlagToXMP(image.flag) : undefined
    const label = includeLabel ? image.label : undefined
    
    let xmpContent = `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="AI Photo Culling 1.0.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:lr="http://ns.adobe.com/lightroom/1.0/"
      xmp:CreatorTool="AI Photo Culling"
      xmp:ModifyDate="${timestamp}"`
    
    if (rating > 0) {
      xmpContent += `\n      xmp:Rating="${rating}"`
    }
    
    if (flag !== undefined) {
      switch (flag) {
        case 'pick':
          xmpContent += `\n      photoshop:Urgency="1"`
          xmpContent += `\n      lr:Pick="1"`
          break
        case 'reject':
          xmpContent += `\n      photoshop:Urgency="0"`
          xmpContent += `\n      lr:Pick="-1"`
          break
      }
    }
    
    if (label) {
      xmpContent += `\n      photoshop:ColorMode="${this.mapLabelToColorMode(label)}"`
      xmpContent += `\n      lr:ColorLabel="${label}"`
    }
    
    xmpContent += '>\n'
    
    // Add hierarchical keywords if available
    if (includeKeywords && this.shouldIncludeKeywords(image)) {
      xmpContent += this.generateKeywords(image)
    }
    
    // Add custom fields for AI analysis results
    if (image.faces && image.faces.length > 0) {
      xmpContent += this.generateFaceData(image.faces)
    }
    
    if (image.focusScore !== undefined) {
      xmpContent += `      <photoshop:SupplementalCategories>
        <rdf:Bag>
          <rdf:li>AI_Focus_Score:${image.focusScore.toFixed(2)}</rdf:li>
        </rdf:Bag>
      </photoshop:SupplementalCategories>\n`
    }
    
    if (image.groupId) {
      xmpContent += `      <lr:HierarchicalSubject>
        <rdf:Bag>
          <rdf:li>AI_Group|${image.groupId}</rdf:li>
        </rdf:Bag>
      </lr:HierarchicalSubject>\n`
    }
    
    xmpContent += `    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`
    
    return xmpContent
  }
  
  private mapFlagToXMP(flag: 'pick' | 'reject' | null): string | undefined {
    switch (flag) {
      case 'pick': return 'pick'
      case 'reject': return 'reject'
      default: return undefined
    }
  }
  
  private mapLabelToColorMode(label: string): string {
    const colorMap: Record<string, string> = {
      'red': '1',
      'yellow': '2',
      'green': '3',
      'blue': '4',
      'purple': '5'
    }
    return colorMap[label.toLowerCase()] || '0'
  }
  
  private shouldIncludeKeywords(image: ImageRec): boolean {
    return !!(image.faces?.length || image.groupId || image.focusScore)
  }
  
  private generateKeywords(image: ImageRec): string {
    const keywords = []
    
    if (image.faces && image.faces.length > 0) {
      keywords.push(`Faces:${image.faces.length}`)
      
      const eyesClosedCount = image.faces.filter(face => 
        face.eyeState?.left === 'closed' || face.eyeState?.right === 'closed'
      ).length
      
      if (eyesClosedCount > 0) {
        keywords.push('Eyes_Closed')
      } else if (image.faces.every(face => 
        face.eyeState?.left === 'open' && face.eyeState?.right === 'open'
      )) {
        keywords.push('Eyes_Open')
      }
    }
    
    if (image.blurScore && image.blurScore > 100) {
      keywords.push('Blurry')
    } else if (image.focusScore && image.focusScore > 200) {
      keywords.push('Sharp')
    }
    
    if (image.groupId) {
      keywords.push('Grouped')
      if (image.isAutoPick) {
        keywords.push('Auto_Pick')
      }
    }
    
    if (keywords.length === 0) return ''
    
    return `      <lr:HierarchicalSubject>
        <rdf:Bag>
${keywords.map(kw => `          <rdf:li>AI_Analysis|${kw}</rdf:li>`).join('\n')}
        </rdf:Bag>
      </lr:HierarchicalSubject>\n`
  }
  
  private generateFaceData(faces: any[]): string {
    const faceRegions = faces.map(face => {
      const { bbox, confidence, eyeState } = face
      return {
        x: bbox.x / 100, // Convert percentage to decimal
        y: bbox.y / 100,
        width: bbox.width / 100,
        height: bbox.height / 100,
        confidence: confidence.toFixed(3),
        eyesOpen: eyeState?.left === 'open' && eyeState?.right === 'open'
      }
    })
    
    return `      <mwg-rs:Regions rdf:parseType="Resource">
        <mwg-rs:AppliedToDimensions rdf:parseType="Resource">
          <stDim:w>1.0</stDim:w>
          <stDim:h>1.0</stDim:h>
          <stDim:unit>normalized</stDim:unit>
        </mwg-rs:AppliedToDimensions>
        <mwg-rs:RegionList>
          <rdf:Bag>
${faceRegions.map(region => `            <rdf:li rdf:parseType="Resource">
              <mwg-rs:Area rdf:parseType="Resource">
                <stArea:x>${region.x.toFixed(6)}</stArea:x>
                <stArea:y>${region.y.toFixed(6)}</stArea:y>
                <stArea:w>${region.width.toFixed(6)}</stArea:w>
                <stArea:h>${region.height.toFixed(6)}</stArea:h>
                <stArea:unit>normalized</stArea:unit>
              </mwg-rs:Area>
              <mwg-rs:Type>Face</mwg-rs:Type>
              <mwg-rs:Extensions rdf:parseType="Resource">
                <ai:Confidence>${region.confidence}</ai:Confidence>
                <ai:EyesOpen>${region.eyesOpen}</ai:EyesOpen>
              </mwg-rs:Extensions>
            </rdf:li>`).join('\n')}
          </rdf:Bag>
        </mwg-rs:RegionList>
      </mwg-rs:Regions>\n`
  }
  
  private applyTemplate(template: string, image: ImageRec): string {
    const variables = {
      '{{rating}}': image.rating.toString(),
      '{{flag}}': image.flag || '',
      '{{label}}': image.label || '',
      '{{fileName}}': image.fileName,
      '{{focusScore}}': image.focusScore?.toFixed(2) || '',
      '{{faceCount}}': image.faces?.length.toString() || '0',
      '{{groupId}}': image.groupId || '',
      '{{timestamp}}': new Date().toISOString(),
      '{{isAutoPick}}': image.isAutoPick ? 'true' : 'false'
    }
    
    let result = template
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value)
    })
    
    return result
  }
  
  async exportXMPSidecars(
    images: ImageRec[],
    options: XMPExportOptions = {}
  ): Promise<Array<{ fileName: string; content: string }>> {
    const results = []
    
    for (const image of images) {
      const xmpContent = this.generateXMP(image, options)
      const xmpFileName = this.getXMPFileName(image.fileName)
      
      results.push({
        fileName: xmpFileName,
        content: xmpContent
      })
    }
    
    return results
  }
  
  private getXMPFileName(originalFileName: string): string {
    const lastDotIndex = originalFileName.lastIndexOf('.')
    if (lastDotIndex === -1) {
      return `${originalFileName}.xmp`
    }
    
    const baseName = originalFileName.substring(0, lastDotIndex)
    return `${baseName}.xmp`
  }
  
  async downloadXMPSidecars(
    images: ImageRec[],
    options: XMPExportOptions = {}
  ): Promise<void> {
    const sidecarFiles = await this.exportXMPSidecars(images, options)
    
    if (sidecarFiles.length === 1) {
      // Single file download
      const file = sidecarFiles[0]
      this.downloadFile(file.content, file.fileName, 'application/xml')
    } else {
      // Multiple files - create a zip
      // Note: In a real implementation, you'd use a zip library like JSZip
      console.log('Multiple XMP files ready for download:', sidecarFiles.length)
      
      // For now, download each file individually
      sidecarFiles.forEach((file, index) => {
        setTimeout(() => {
          this.downloadFile(file.content, file.fileName, 'application/xml')
        }, index * 100) // Small delay between downloads
      })
    }
  }
  
  private downloadFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }
}

export const xmpWriter = new XMPWriter()