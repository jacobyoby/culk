'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Download, 
  FileText, 
  Table, 
  Code, 
  Settings, 
  BarChart3, 
  Users, 
  Star,
  Flag,
  X,
  Home
} from 'lucide-react'
import { useImages, useGroups, useCurrentProject } from '@/lib/store/hooks'
import { sessionExporter, ExportOptions } from '@/lib/export/session-exporter'
import { autoGrouper, GroupingOptions } from '@/lib/grouping/auto-grouper'

export default function ReviewPage() {
  const router = useRouter()
  const images = useImages()
  const groups = useGroups()
  const project = useCurrentProject()
  
  const [isExporting, setIsExporting] = useState(false)
  const [isGrouping, setIsGrouping] = useState(false)
  const [groupingProgress, setGroupingProgress] = useState<{ current: number; total: number; status: string } | null>(null)
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeXMP: true,
    includeJSON: false,
    includeCSV: false,
    includeGroups: true,
    includeMetadata: true
  })
  
  const stats = {
    total: images.length,
    rated: images.filter(img => img.rating > 0).length,
    picks: images.filter(img => img.flag === 'pick').length,
    rejects: images.filter(img => img.flag === 'reject').length,
    grouped: images.filter(img => img.groupId).length,
    groups: groups.length
  }
  
  const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: images.filter(img => img.rating === rating).length
  }))
  
  const handleExport = async () => {
    setIsExporting(true)
    try {
      await sessionExporter.downloadExport(exportOptions)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }
  
  const handleAutoGroup = async () => {
    if (isGrouping) {
      autoGrouper.abort()
      setIsGrouping(false)
      return
    }
    
    setIsGrouping(true)
    setGroupingProgress({ current: 0, total: images.length, status: 'Starting...' })
    
    try {
      const groupingOptions: GroupingOptions = {
        similarityThreshold: project?.settings.similarityThreshold || 15,
        onProgress: setGroupingProgress
      }
      
      await autoGrouper.regroupAll(groupingOptions)
      setGroupingProgress({ current: images.length, total: images.length, status: 'Completed!' })
    } catch (error) {
      console.error('Auto-grouping failed:', error)
      alert('Auto-grouping failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsGrouping(false)
      setTimeout(() => setGroupingProgress(null), 3000)
    }
  }
  
  if (images.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No Images to Review</h2>
          <p className="text-muted-foreground">
            Import some photos first to review and export
          </p>
          <button
            onClick={() => router.push('/import')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Import Photos
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold">Review & Export</h1>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/cull')}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Continue Culling
            </button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Images</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats.rated}</p>
                <p className="text-sm text-muted-foreground">Rated</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-500">{stats.picks}</p>
                <p className="text-sm text-muted-foreground">Picks</p>
              </div>
              <Flag className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-500">{stats.rejects}</p>
                <p className="text-sm text-muted-foreground">Rejects</p>
              </div>
              <X className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Rating Distribution</h3>
            <div className="space-y-3">
              {ratingDistribution.map(({ rating, count }) => (
                <div key={rating} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {Array.from({ length: rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-sm">{rating} star{rating !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Auto-Grouping</h3>
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>{stats.groups} groups containing {stats.grouped} images</p>
                <p>{stats.total - stats.grouped} ungrouped images</p>
              </div>
              
              {groupingProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{groupingProgress.current}/{groupingProgress.total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(groupingProgress.current / groupingProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{groupingProgress.status}</p>
                </div>
              )}
              
              <button
                onClick={handleAutoGroup}
                disabled={isGrouping}
                className={`w-full px-4 py-2 rounded-lg transition-colors ${
                  isGrouping
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isGrouping ? 'Cancel Grouping' : 'Auto-Group Similar Images'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-6">Export Options</h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-medium">Export Formats</h4>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeXMP}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeXMP: e.target.checked
                    }))}
                    className="rounded"
                  />
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>XMP Sidecars</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">
                    For Lightroom/Capture One
                  </span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeJSON}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeJSON: e.target.checked
                    }))}
                    className="rounded"
                  />
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    <span>JSON Export</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Complete session data
                  </span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeCSV}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeCSV: e.target.checked
                    }))}
                    className="rounded"
                  />
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4" />
                    <span>CSV Export</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Spreadsheet format
                  </span>
                </label>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Filter Options</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Minimum Rating
                  </label>
                  <select
                    value={exportOptions.filterByRating || ''}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      filterByRating: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full p-2 rounded border border-border bg-background"
                  >
                    <option value="">All ratings</option>
                    <option value="1">1 star and above</option>
                    <option value="2">2 stars and above</option>
                    <option value="3">3 stars and above</option>
                    <option value="4">4 stars and above</option>
                    <option value="5">5 stars only</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Flag Filter
                  </label>
                  <select
                    value={exportOptions.filterByFlag || 'all'}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      filterByFlag: e.target.value === 'all' ? undefined : 
                                   e.target.value === 'null' ? null :
                                   e.target.value as 'pick' | 'reject'
                    }))}
                    className="w-full p-2 rounded border border-border bg-background"
                  >
                    <option value="all">All images</option>
                    <option value="pick">Picks only</option>
                    <option value="reject">Rejects only</option>
                    <option value="null">Unflagged only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button
              onClick={handleExport}
              disabled={isExporting || (!exportOptions.includeXMP && !exportOptions.includeJSON && !exportOptions.includeCSV)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}