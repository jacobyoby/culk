'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { importer, ImportProgress } from '@/lib/fs/importer'
import { useSessions } from '@/lib/store/hooks'
import { checkFileSystemSupport } from '@/lib/fs/file-system-access'
import { calculateFileSize } from '@/lib/utils/image'

export default function ImportPage() {
  const router = useRouter()
  const sessions = useSessions()
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const support = checkFileSystemSupport()
  
  const handleImport = useCallback(async () => {
    if (!support.supported) {
      setError('Your browser does not support the File System Access API')
      return
    }
    
    setIsImporting(true)
    setError(null)
    setProgress(null)
    
    try {
      const session = await importer.importFolder({
        generateThumbnails: true,
        extractExif: true,
        maxConcurrent: 4,
        onProgress: setProgress
      })
      
      if (session) {
        router.push('/cull')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }, [router, support.supported])
  
  const handleCancel = useCallback(() => {
    importer.abort()
    setIsImporting(false)
  }, [])
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Import Photos</h1>
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {!support.supported && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">
                Your browser does not support the File System Access API.
                Please use a modern browser like Chrome, Edge, or Brave.
              </p>
            </div>
          </div>
        )}
        
        {!isImporting && !progress && (
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={handleImport}
              disabled={!support.supported}
              className="group relative overflow-hidden rounded-xl bg-card p-8 border border-border hover:border-primary transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-center space-y-4">
                <FolderOpen className="w-16 h-16 text-primary" />
                <h2 className="text-xl font-semibold">Select Folder</h2>
                <p className="text-muted-foreground text-center">
                  Choose a folder containing your RAW and JPEG files
                </p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            
            <div className="bg-card rounded-xl border border-border p-8">
              <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground">No import sessions yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="p-3 bg-muted rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{session.folderName}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.processedFiles}/{session.totalFiles} files
                          </p>
                        </div>
                        <div className="flex items-center space-x-1">
                          {session.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : session.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          <span className="text-sm capitalize">{session.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {isImporting && progress && (
          <div className="bg-card rounded-xl border border-border p-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Importing Files</h2>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.processed}/{progress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                  />
                </div>
              </div>
              
              {progress.currentFile && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Current file:</p>
                  <p className="text-sm font-mono truncate">{progress.currentFile}</p>
                </div>
              )}
              
              {progress.failed > 0 && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
                  <p className="text-sm text-destructive">
                    {progress.failed} file(s) failed to import
                  </p>
                </div>
              )}
              
              {progress.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Errors:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {progress.errors.map((err, i) => (
                      <div key={i} className="text-xs p-2 bg-muted rounded">
                        <p className="font-mono truncate">{err.file}</p>
                        <p className="text-destructive">{err.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          </div>
        )}
        
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Supported formats: JPEG, PNG, RAW (CR2, CR3, NEF, ARW, and more)</p>
          <p>All processing happens locally - no files are uploaded</p>
        </div>
      </div>
    </div>
  )
}