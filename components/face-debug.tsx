'use client'

import { useState, useEffect } from 'react'
import { useImages } from '@/lib/store/hooks'

export function FaceDebug() {
  const images = useImages()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  const selectedImageData = images.find(img => img.id === selectedImage)
  
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-bold mb-4">Face Detection Debug</h3>
      
      <div className="mb-4">
        <p><strong>Total images:</strong> {images.length}</p>
        <p><strong>Images with faces:</strong> {images.filter(img => img.faces && img.faces.length > 0).length}</p>
        <p><strong>Total faces found:</strong> {images.reduce((sum, img) => sum + (img.faces?.length || 0), 0)}</p>
      </div>
      
      {images.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Inspect Image:</label>
          <select 
            value={selectedImage || ''} 
            onChange={(e) => setSelectedImage(e.target.value || null)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select an image...</option>
            {images.map(img => (
              <option key={img.id} value={img.id}>
                {img.fileName} ({img.faces?.length || 0} faces)
              </option>
            ))}
          </select>
        </div>
      )}
      
      {selectedImageData && (
        <div className="bg-white p-4 rounded border">
          <h4 className="font-bold mb-2">{selectedImageData.fileName}</h4>
          <div className="text-sm space-y-1">
            <p><strong>ID:</strong> {selectedImageData.id}</p>
            <p><strong>File Size:</strong> {(selectedImageData.fileSize / 1024).toFixed(1)} KB</p>
            <p><strong>Has Thumbnail:</strong> {selectedImageData.thumbnailDataUrl ? 'Yes' : 'No'}</p>
            <p><strong>Has Preview:</strong> {selectedImageData.previewDataUrl ? 'Yes' : 'No'}</p>
            <p><strong>Faces Data:</strong> {selectedImageData.faces ? 'Present' : 'Missing'}</p>
            <p><strong>Face Count:</strong> {selectedImageData.faces?.length || 0}</p>
          </div>
          
          {selectedImageData.faces && selectedImageData.faces.length > 0 && (
            <div className="mt-4">
              <h5 className="font-bold mb-2">Face Details:</h5>
              {selectedImageData.faces.map((face, index) => (
                <div key={face.id} className="bg-gray-50 p-2 rounded mb-2 text-xs">
                  <p><strong>Face {index + 1}:</strong></p>
                  <p>ID: {face.id}</p>
                  <p>Confidence: {(face.confidence * 100).toFixed(1)}%</p>
                  <p>Position: ({face.bbox.x.toFixed(1)}%, {face.bbox.y.toFixed(1)}%)</p>
                  <p>Size: {face.bbox.width.toFixed(1)}% × {face.bbox.height.toFixed(1)}%</p>
                  <p>Eyes: L:{face.eyeState?.left || 'unknown'}, R:{face.eyeState?.right || 'unknown'}</p>
                  <p>Focus Score: {face.focusScore?.toFixed(2) || 'N/A'}</p>
                </div>
              ))}
            </div>
          )}
          
          {(!selectedImageData.faces || selectedImageData.faces.length === 0) && (
            <div className="mt-4 p-3 bg-yellow-100 rounded">
              <p className="text-sm text-yellow-800">
                No faces detected for this image. This could mean:
              </p>
              <ul className="text-sm text-yellow-800 mt-2 ml-4 list-disc">
                <li>Face detection failed during import</li>
                <li>No faces present in the image</li>
                <li>Face detection algorithm needs tuning</li>
                <li>Import was done before face detection was enabled</li>
              </ul>
            </div>
          )}
        </div>
      )}
      
      {images.length === 0 && (
        <div className="p-3 bg-blue-100 rounded">
          <p className="text-sm text-blue-800">
            No images found. Import some photos to test face detection.
          </p>
        </div>
      )}
      
      <div className="mt-4 p-3 bg-gray-200 rounded">
        <h5 className="font-bold mb-2 text-sm">Debug Info:</h5>
        <div className="text-xs space-y-1">
          <p>Face detection is enabled in import settings</p>
          <p>Check browser console during import for face detection logs</p>
          <p>Face boxes appear with 'F' key in cull view when showFaceBoxes is true</p>
          <p>Face detection requires thumbnails to be generated during import</p>
        </div>
      </div>
    </div>
  )
}