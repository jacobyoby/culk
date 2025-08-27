'use client'

import { useState } from 'react'
import { 
  Grid3X3, 
  Maximize2, 
  Copy, 
  LayoutGrid, 
  Filter, 
  SortAsc, 
  Eye,
  Info,
  Settings
} from 'lucide-react'
import { ViewMode } from '@/lib/types'

interface ToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  filterMode: string
  onFilterModeChange: (filter: string) => void
  sortMode: string
  onSortModeChange: (sort: string) => void
  showFaceBoxes: boolean
  onToggleFaceBoxes: () => void
  showMetadata: boolean
  onToggleMetadata: () => void
  onOpenSettings: () => void
  className?: string
}

export function Toolbar({
  viewMode,
  onViewModeChange,
  filterMode,
  onFilterModeChange,
  sortMode,
  onSortModeChange,
  showFaceBoxes,
  onToggleFaceBoxes,
  showMetadata,
  onToggleMetadata,
  onOpenSettings,
  className = ''
}: ToolbarProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [showSorts, setShowSorts] = useState(false)
  
  const viewModes = [
    { id: 'filmstrip', icon: Grid3X3, label: 'Filmstrip' },
    { id: 'loupe', icon: Maximize2, label: 'Loupe' },
    { id: 'compare', icon: Copy, label: 'Compare' },
    { id: 'survey', icon: LayoutGrid, label: 'Survey' }
  ] as const
  
  const filters = [
    { id: 'all', label: 'All Images' },
    { id: 'picks', label: 'Picks Only' },
    { id: 'rejects', label: 'Rejects Only' },
    { id: 'unrated', label: 'Unrated' },
    { id: 'blurry', label: 'Blurry Images' },
    { id: 'eyes-closed', label: 'Eyes Closed' }
  ]
  
  const sorts = [
    { id: 'capture-time', label: 'Capture Time' },
    { id: 'import-time', label: 'Import Time' },
    { id: 'rating', label: 'Rating' },
    { id: 'name', label: 'File Name' }
  ]
  
  return (
    <div className={`bg-card border-b border-border p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex bg-muted rounded-lg p-1">
            {viewModes.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => onViewModeChange(id as ViewMode)}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-background'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                filterMode !== 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-background'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm">
                {filters.find(f => f.id === filterMode)?.label || 'Filter'}
              </span>
            </button>
            
            {showFilters && (
              <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-48">
                {filters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => {
                      onFilterModeChange(filter.id)
                      setShowFilters(false)
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      filterMode === filter.id ? 'bg-muted' : ''
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowSorts(!showSorts)}
              className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-background rounded-lg transition-colors"
            >
              <SortAsc className="w-4 h-4" />
              <span className="text-sm">
                {sorts.find(s => s.id === sortMode)?.label || 'Sort'}
              </span>
            </button>
            
            {showSorts && (
              <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-48">
                {sorts.map(sort => (
                  <button
                    key={sort.id}
                    onClick={() => {
                      onSortModeChange(sort.id)
                      setShowSorts(false)
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      sortMode === sort.id ? 'bg-muted' : ''
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFaceBoxes}
            className={`p-2 rounded-lg transition-colors ${
              showFaceBoxes
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-background'
            }`}
            title="Toggle face detection boxes"
          >
            <Eye className="w-4 h-4" />
          </button>
          
          <button
            onClick={onToggleMetadata}
            className={`p-2 rounded-lg transition-colors ${
              showMetadata
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-background'
            }`}
            title="Toggle metadata display"
          >
            <Info className="w-4 h-4" />
          </button>
          
          <button
            onClick={onOpenSettings}
            className="p-2 bg-muted hover:bg-background rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}