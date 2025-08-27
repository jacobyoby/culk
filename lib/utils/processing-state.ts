import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Shared processing state management with timeout handling
 */
export interface ProcessingState {
  isProcessing: boolean
  result: string | null
  error: string | null
}

export interface UseProcessingStateOptions {
  successDuration?: number
  errorDuration?: number
  onSuccess?: (result: string) => void
  onError?: (error: string) => void
}

export function useProcessingState(options: UseProcessingStateOptions = {}) {
  const {
    successDuration = 3000,
    errorDuration = 5000,
    onSuccess,
    onError
  } = options
  
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    result: null,
    error: null
  })
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  const startProcessing = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    setState({
      isProcessing: true,
      result: null,
      error: null
    })
  }, [])
  
  const setSuccess = useCallback((result: string) => {
    setState({
      isProcessing: false,
      result,
      error: null
    })
    
    onSuccess?.(result)
    
    // Clear success message after duration
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, result: null }))
      timeoutRef.current = null
    }, successDuration)
  }, [successDuration, onSuccess])
  
  const setError = useCallback((error: string) => {
    setState({
      isProcessing: false,
      result: null,
      error
    })
    
    onError?.(error)
    
    // Clear error message after duration
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, error: null }))
      timeoutRef.current = null
    }, errorDuration)
  }, [errorDuration, onError])
  
  const clearMessages = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setState(prev => ({
      ...prev,
      result: null,
      error: null
    }))
  }, [])
  
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setState({
      isProcessing: false,
      result: null,
      error: null
    })
  }, [])
  
  return {
    ...state,
    startProcessing,
    setSuccess,
    setError,
    clearMessages,
    reset
  }
}

/**
 * Processing state message component types
 */
export type MessageType = 'success' | 'error' | 'warning' | 'info'

export interface StatusMessage {
  type: MessageType
  title?: string
  message: string
  details?: string
}

/**
 * Create status messages with consistent formatting
 */
export function createStatusMessage(
  type: MessageType,
  message: string,
  title?: string,
  details?: string
): StatusMessage {
  return { type, title, message, details }
}

/**
 * Common processing operation wrapper
 */
export async function withProcessingState<T>(
  operation: () => Promise<T>,
  processingState: ReturnType<typeof useProcessingState>,
  successMessage?: string,
  errorMessage?: string
): Promise<T | null> {
  processingState.startProcessing()
  
  try {
    const result = await operation()
    processingState.setSuccess(successMessage || 'Operation completed successfully')
    return result
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'Operation failed')
    processingState.setError(message)
    return null
  }
}

/**
 * Auto-enhancement processing with confidence reporting
 */
export interface EnhancementResult {
  applied: boolean
  confidence?: number
  adjustments?: any
  method?: string
}

export function formatEnhancementMessage(result: EnhancementResult): StatusMessage {
  if (!result.applied) {
    return createStatusMessage(
      'info',
      'No Enhancement Needed',
      'Image appears well-exposed already'
    )
  }
  
  if (result.confidence && result.confidence >= 0.8) {
    return createStatusMessage(
      'success',
      'Auto-Enhancement Applied',
      `High confidence enhancement (${Math.round(result.confidence * 100)}%)`,
      'Adjustments saved to this image'
    )
  } else if (result.confidence && result.confidence >= 0.6) {
    return createStatusMessage(
      'success',
      'Auto-Enhancement Applied',
      `Good confidence enhancement (${Math.round(result.confidence * 100)}%)`,
      'Adjustments saved to this image'
    )
  } else {
    return createStatusMessage(
      'warning',
      'Enhancement Applied',
      `Moderate confidence enhancement (${Math.round((result.confidence || 0.5) * 100)}%)`,
      'You may want to fine-tune manually'
    )
  }
}

/**
 * Preset application message formatter
 */
export function formatPresetMessage(presetName: string): StatusMessage {
  return createStatusMessage(
    'success',
    `Applied ${presetName} preset`,
    'Style applied to this image only'
  )
}