/**
 * Shared error handling utilities to reduce duplication
 */

export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly imageName?: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

export class CanvasError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'CanvasError'
  }
}

export class FileAccessError extends Error {
  constructor(
    message: string,
    public readonly fileName?: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'FileAccessError'
  }
}

export class FaceDetectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'FaceDetectionError'
  }
}

/**
 * Safely execute an async operation with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    console.error(errorMessage || 'Operation failed:', error)
    return null
  }
}

/**
 * Safely execute a sync operation with error handling
 */
export function safeSync<T>(
  operation: () => T,
  errorMessage?: string
): T | null {
  try {
    return operation()
  } catch (error) {
    console.error(errorMessage || 'Operation failed:', error)
    return null
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  backoffFactor: number = 2
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries - 1) {
        throw lastError
      }
      
      const delay = initialDelay * Math.pow(backoffFactor, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

/**
 * Create user-friendly error messages
 */
export function formatErrorMessage(error: unknown, context?: string): string {
  if (error instanceof ImageProcessingError) {
    return `Image processing failed: ${error.message}${error.imageName ? ` (${error.imageName})` : ''}`
  }
  
  if (error instanceof CanvasError) {
    return `Canvas operation failed: ${error.message}`
  }
  
  if (error instanceof FileAccessError) {
    return `File access failed: ${error.message}${error.fileName ? ` (${error.fileName})` : ''}`
  }
  
  if (error instanceof FaceDetectionError) {
    return `Face detection failed: ${error.message}`
  }
  
  if (error instanceof Error) {
    return context ? `${context}: ${error.message}` : error.message
  }
  
  return context ? `${context}: Unknown error` : 'An unknown error occurred'
}

/**
 * Log error with context
 */
export function logError(error: unknown, context: string, additionalData?: Record<string, any>) {
  const message = formatErrorMessage(error, context)
  console.error(message, {
    error,
    context,
    timestamp: new Date().toISOString(),
    ...additionalData
  })
}

/**
 * Handle file operation errors
 */
export async function withFileErrorHandling<T>(
  operation: () => Promise<T>,
  fileName?: string,
  fallback?: () => Promise<T>
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    const fileError = new FileAccessError(
      formatErrorMessage(error, 'File operation failed'),
      fileName,
      error instanceof Error ? error : undefined
    )
    
    logError(fileError, 'File operation', { fileName })
    
    if (fallback) {
      try {
        console.log('Attempting fallback operation...')
        return await fallback()
      } catch (fallbackError) {
        logError(fallbackError, 'Fallback operation', { fileName })
        return null
      }
    }
    
    return null
  }
}

/**
 * Handle canvas operation errors
 */
export function withCanvasErrorHandling<T>(
  operation: () => T,
  errorMessage?: string
): T | null {
  try {
    return operation()
  } catch (error) {
    const canvasError = new CanvasError(
      errorMessage || formatErrorMessage(error, 'Canvas operation failed'),
      error instanceof Error ? error : undefined
    )
    
    logError(canvasError, 'Canvas operation')
    return null
  }
}

/**
 * Handle image processing errors
 */
export async function withImageProcessingErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  imageName?: string
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    const processingError = new ImageProcessingError(
      formatErrorMessage(error, 'Processing failed'),
      operationName,
      imageName,
      error instanceof Error ? error : undefined
    )
    
    logError(processingError, 'Image processing', { 
      operation: operationName, 
      imageName 
    })
    
    return null
  }
}

/**
 * Handle face detection errors
 */
export async function withFaceDetectionErrorHandling<T>(
  operation: () => Promise<T>,
  imageName?: string
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    const faceError = new FaceDetectionError(
      formatErrorMessage(error, 'Face detection failed'),
      error instanceof Error ? error : undefined
    )
    
    logError(faceError, 'Face detection', { imageName })
    return null
  }
}

/**
 * Create error boundary compatible error info
 */
export function createErrorInfo(error: Error, componentStack?: string) {
  return {
    error,
    errorInfo: {
      componentStack: componentStack || 'No component stack available'
    },
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
  }
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof FileAccessError) {
    return true // Can often retry or use fallback
  }
  
  if (error instanceof ImageProcessingError) {
    return error.operation !== 'critical' // Depends on operation type
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('permission')
  }
  
  return false
}

/**
 * Get error recovery suggestions
 */
export function getRecoverysuggestion(error: unknown): string {
  if (error instanceof FileAccessError) {
    return 'Try selecting the file again or check file permissions'
  }
  
  if (error instanceof CanvasError) {
    return 'Try refreshing the page or using a different browser'
  }
  
  if (error instanceof FaceDetectionError) {
    return 'The image may not contain faces or the quality may be too low'
  }
  
  if (error instanceof ImageProcessingError) {
    return 'Try with a different image or check the file format'
  }
  
  return 'Please try again or contact support if the problem persists'
}