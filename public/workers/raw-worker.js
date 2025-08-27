// RAW Processing Web Worker
let isLibRawInitialized = false;
let libRawInstance = null;

// Import LibRaw WASM when needed
async function initializeLibRaw() {
  if (isLibRawInitialized) return;
  
  try {
    // Dynamic import of LibRaw WASM
    const LibRaw = await import('libraw-wasm');
    libRawInstance = new LibRaw.default();
    isLibRawInitialized = true;
  } catch (error) {
    console.error('Failed to initialize LibRaw:', error);
    throw new Error('LibRaw initialization failed');
  }
}

// Process RAW file
async function processRawFile(fileBuffer, options = {}) {
  if (!isLibRawInitialized) {
    await initializeLibRaw();
  }

  const {
    brightness = 0,
    whiteBalance = 'auto',
    colorSpace = 'sRGB',
    quality = 90,
    size
  } = options;

  try {
    const uint8Array = new Uint8Array(fileBuffer);
    
    await libRawInstance.open(uint8Array, {
      brightness,
      wb: mapWhiteBalance(whiteBalance),
      colorSpace: mapColorSpace(colorSpace),
      quality
    });

    const metadata = await libRawInstance.metadata();
    const imageData = await libRawInstance.imageData();
    
    let processedData = imageData;
    let width = metadata.width;
    let height = metadata.height;

    if (size && (size.width !== width || size.height !== height)) {
      const resizeResult = await resizeImage(imageData, width, height, size.width, size.height);
      processedData = resizeResult.data;
      width = size.width;
      height = size.height;
    }

    return {
      imageData: processedData,
      metadata: convertMetadata(metadata),
      width,
      height,
      format: 'jpeg'
    };
  } finally {
    try {
      await libRawInstance.close();
    } catch (closeError) {
      console.warn('Error closing RAW processor:', closeError);
    }
  }
}

// Helper functions
function mapWhiteBalance(wb) {
  switch (wb) {
    case 'auto': return 0;
    case 'camera': return 1;
    case 'daylight': return 2;
    default: return 0;
  }
}

function mapColorSpace(colorSpace) {
  switch (colorSpace) {
    case 'sRGB': return 1;
    case 'AdobeRGB': return 2;
    case 'ProPhotoRGB': return 3;
    default: return 1;
  }
}

async function resizeImage(imageData, originalWidth, originalHeight, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    const imgBitmap = createImageBitmap(new Blob([imageData]));
    imgBitmap.then(bitmap => {
      const aspectRatio = originalWidth / originalHeight;
      let newWidth = targetWidth;
      let newHeight = targetHeight;

      if (targetWidth / targetHeight > aspectRatio) {
        newWidth = targetHeight * aspectRatio;
      } else {
        newHeight = targetWidth / aspectRatio;
      }

      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

      canvas.convertToBlob({ type: 'image/jpeg' }).then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            data: new Uint8Array(reader.result),
            width: newWidth,
            height: newHeight
          });
        };
        reader.readAsArrayBuffer(blob);
      });
    }).catch(reject);
  });
}

function convertMetadata(rawMetadata) {
  return {
    make: rawMetadata.make,
    model: rawMetadata.model,
    lens: rawMetadata.lens,
    dateTime: rawMetadata.datetime ? new Date(rawMetadata.datetime) : undefined,
    orientation: rawMetadata.orientation || 1,
    focalLength: rawMetadata.focal_length,
    aperture: rawMetadata.aperture,
    shutterSpeed: rawMetadata.shutter_speed,
    iso: rawMetadata.iso,
    whiteBalance: rawMetadata.white_balance,
    flash: rawMetadata.flash,
    width: rawMetadata.width,
    height: rawMetadata.height,
    colorSpace: rawMetadata.color_space,
    exposureCompensation: rawMetadata.exposure_compensation,
    meteringMode: rawMetadata.metering_mode,
    exposureMode: rawMetadata.exposure_mode
  };
}

// Worker message handler
self.onmessage = async function(event) {
  const { id, type, fileBuffer, options, maxWidth, maxHeight, width, height } = event.data;
  
  try {
    let result;

    switch (type) {
      case 'process':
        result = await processRawFile(fileBuffer, options);
        break;
        
      case 'preview':
        result = await processRawFile(fileBuffer, {
          size: { width: maxWidth || 1920, height: maxHeight || 1080 },
          quality: 85
        });
        break;
        
      case 'thumbnail':
        result = await processRawFile(fileBuffer, {
          size: { width: width || 200, height: height || 200 },
          quality: 75
        });
        break;
        
      default:
        throw new Error(`Unknown processing type: ${type}`);
    }

    self.postMessage({
      id,
      success: true,
      result
    });
    
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message || 'Unknown error'
    });
  }
};