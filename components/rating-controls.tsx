'use client'

import { Star, Flag, X } from 'lucide-react'
import { ImageRec } from '@/lib/types'
import { db } from '@/lib/store/db'

interface RatingControlsProps {
  image: ImageRec
  onUpdate?: () => void
  className?: string
}

export function RatingControls({ image, onUpdate, className = '' }: RatingControlsProps) {
  const handleRating = async (rating: number) => {
    await db.updateImageRating(image.id, rating)
    onUpdate?.()
  }
  
  const handleFlag = async (flag: 'pick' | 'reject' | null) => {
    await db.updateImageFlag(image.id, flag)
    onUpdate?.()
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(rating => (
          <button
            key={rating}
            onClick={() => handleRating(rating)}
            className="p-1 hover:bg-muted rounded transition-colors"
            title={`${rating} stars`}
          >
            <Star
              className={`w-5 h-5 ${
                image.rating >= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
      
      <div className="h-6 w-px bg-border mx-2" />
      
      <div className="flex gap-1">
        <button
          onClick={() => handleFlag(image.flag === 'pick' ? null : 'pick')}
          className={`p-2 rounded transition-colors ${
            image.flag === 'pick'
              ? 'bg-green-600 text-white'
              : 'hover:bg-muted text-muted-foreground'
          }`}
          title="Pick"
        >
          <Flag className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => handleFlag(image.flag === 'reject' ? null : 'reject')}
          className={`p-2 rounded transition-colors ${
            image.flag === 'reject'
              ? 'bg-red-600 text-white'
              : 'hover:bg-muted text-muted-foreground'
          }`}
          title="Reject"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {image.rating > 0 && (
        <button
          onClick={() => handleRating(0)}
          className="px-2 py-1 text-xs hover:bg-muted rounded transition-colors text-muted-foreground"
          title="Clear rating"
        >
          Clear
        </button>
      )}
    </div>
  )
}