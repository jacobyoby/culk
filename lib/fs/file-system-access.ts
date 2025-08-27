export interface FileSystemSupport {
  supported: boolean
  showDirectoryPicker: boolean
  showOpenFilePicker: boolean
  showSaveFilePicker: boolean
}

export function checkFileSystemSupport(): FileSystemSupport {
  return {
    supported: 'showDirectoryPicker' in window,
    showDirectoryPicker: 'showDirectoryPicker' in window,
    showOpenFilePicker: 'showOpenFilePicker' in window,
    showSaveFilePicker: 'showSaveFilePicker' in window,
  }
}

export async function selectFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API not supported')
  }

  try {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read'
    })
    return dirHandle
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function selectFiles(): Promise<FileSystemFileHandle[] | null> {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('File System Access API not supported')
  }

  try {
    const fileHandles = await window.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: 'Image files',
          accept: {
            'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'],
            'image/x-canon-cr2': ['.cr2'],
            'image/x-canon-cr3': ['.cr3'],
            'image/x-nikon-nef': ['.nef'],
            'image/x-sony-arw': ['.arw'],
            'image/x-adobe-dng': ['.dng'],
            'image/x-olympus-orf': ['.orf'],
            'image/x-panasonic-rw2': ['.rw2'],
            'image/x-fuji-raf': ['.raf'],
            'image/x-samsung-srw': ['.srw'],
            'image/x-pentax-pef': ['.pef'],
            'image/x-sigma-x3f': ['.x3f']
          }
        }
      ]
    })
    return fileHandles
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function selectSingleFile(): Promise<FileSystemFileHandle | null> {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('File System Access API not supported')
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Image files',
          accept: {
            'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'],
            'image/x-canon-cr2': ['.cr2'],
            'image/x-canon-cr3': ['.cr3'],
            'image/x-nikon-nef': ['.nef'],
            'image/x-sony-arw': ['.arw'],
            'image/x-adobe-dng': ['.dng'],
            'image/x-olympus-orf': ['.orf'],
            'image/x-panasonic-rw2': ['.rw2'],
            'image/x-fuji-raf': ['.raf'],
            'image/x-samsung-srw': ['.srw'],
            'image/x-pentax-pef': ['.pef'],
            'image/x-sigma-x3f': ['.x3f']
          }
        }
      ]
    })
    return fileHandle
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function* walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path = ''
): AsyncGenerator<{ handle: FileSystemFileHandle; path: string }> {
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name
    
    if (entry.kind === 'file') {
      yield { handle: entry, path: entryPath }
    } else if (entry.kind === 'directory') {
      yield* walkDirectory(entry, entryPath)
    }
  }
}

export function isImageFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop()
  const imageExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif',
    'raw', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'dng',
    'raf', 'srw', 'pef', 'x3f', 'kdc', 'mrw', 'nrw'
  ]
  return ext ? imageExtensions.includes(ext) : false
}

export function isRawFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop()
  const rawExtensions = [
    'raw', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'dng',
    'raf', 'srw', 'pef', 'x3f', 'kdc', 'mrw', 'nrw'
  ]
  return ext ? rawExtensions.includes(ext) : false
}

export async function readFileAsArrayBuffer(
  fileHandle: FileSystemFileHandle
): Promise<ArrayBuffer> {
  const file = await fileHandle.getFile()
  return await file.arrayBuffer()
}

export async function readFileAsDataURL(
  fileHandle: FileSystemFileHandle
): Promise<string> {
  const file = await fileHandle.getFile()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function getFileMetadata(fileHandle: FileSystemFileHandle) {
  const file = await fileHandle.getFile()
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified),
  }
}

export async function saveFile(
  content: string | ArrayBuffer | Blob,
  suggestedName?: string,
  types?: FilePickerAcceptType[]
): Promise<FileSystemFileHandle | null> {
  if (!('showSaveFilePicker' in window)) {
    throw new Error('File System Access API not supported')
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: types || [
        {
          description: 'All Files',
          accept: { '*/*': ['*'] },
        },
      ],
    })

    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()

    return handle
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function requestPermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = { mode }
  
  if ((await handle.queryPermission(options)) === 'granted') {
    return true
  }
  
  if ((await handle.requestPermission(options)) === 'granted') {
    return true
  }
  
  return false
}

declare global {
  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  }
  
  interface DirectoryPickerOptions {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: WellKnownDirectory | FileSystemHandle
  }
  
  interface OpenFilePickerOptions {
    multiple?: boolean
    types?: FilePickerAcceptType[]
    excludeAcceptAllOption?: boolean
    id?: string
    startIn?: WellKnownDirectory | FileSystemHandle
  }
  
  interface SaveFilePickerOptions {
    suggestedName?: string
    types?: FilePickerAcceptType[]
    excludeAcceptAllOption?: boolean
    id?: string
    startIn?: WellKnownDirectory | FileSystemHandle
  }
  
  interface FilePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }
  
  type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
}