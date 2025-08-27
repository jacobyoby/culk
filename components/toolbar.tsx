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
import { Button, IconButton } from '@/components/ui/button'
import { Dropdown, DropdownOption } from '@/components/ui/dropdown'

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
  const viewModes = [
    { id: 'filmstrip', icon: Grid3X3, label: 'Filmstrip' },
    { id: 'loupe', icon: Maximize2, label: 'Loupe' },
    { id: 'compare', icon: Copy, label: 'Compare' },
    { id: 'survey', icon: LayoutGrid, label: 'Survey' }
  ] as const
  
  const filters: DropdownOption[] = [
    { id: 'all', label: 'All Images' },
    { id: 'picks', label: 'Picks Only' },
    { id: 'rejects', label: 'Rejects Only' },
    { id: 'unrated', label: 'Unrated' },
    { id: 'blurry', label: 'Blurry Images' },
    { id: 'eyes-closed', label: 'Eyes Closed' }
  ]
  
  const sorts: DropdownOption[] = [
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
              <IconButton
                key={id}
                icon={Icon}
                onClick={() => onViewModeChange(id as ViewMode)}
                active={viewMode === id}
                variant={viewMode === id ? 'default' : 'ghost'}
                tooltip={label}
                className="rounded-md"
              />
            ))}
          </div>
          
          <Dropdown
            options={filters}
            value={filterMode}
            onValueChange={onFilterModeChange}
            badge={filterMode !== 'all'}
            trigger={
              <Button
                variant={filterMode !== 'all' ? 'default' : 'muted'}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">
                  {filters.find(f => f.id === filterMode)?.label || 'Filter'}
                </span>
              </Button>
            }
          />
          
          <Dropdown
            options={sorts}
            value={sortMode}
            onValueChange={onSortModeChange}
            trigger={
              <Button variant="muted" className="flex items-center gap-2">
                <SortAsc className="w-4 h-4" />
                <span className="text-sm">
                  {sorts.find(s => s.id === sortMode)?.label || 'Sort'}
                </span>
              </Button>
            }
          />
        </div>
        
        <div className="flex items-center gap-2">
          <IconButton
            icon={Eye}
            onClick={onToggleFaceBoxes}
            active={showFaceBoxes}
            variant="muted"
            tooltip="Toggle face detection boxes"
          />
          
          <IconButton
            icon={Info}
            onClick={onToggleMetadata}
            active={showMetadata}
            variant="muted"
            tooltip="Toggle metadata display"
          />
          
          <IconButton
            icon={Settings}
            onClick={onOpenSettings}
            variant="muted"
            tooltip="Settings"
          />
        </div>
      </div>
    </div>
  )
}