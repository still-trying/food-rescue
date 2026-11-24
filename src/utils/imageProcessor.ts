export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_DIMENSION_PX = 1280
const OUTPUT_QUALITY = 0.82

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

const ALLOWED_IMAGE_TYPES: readonly AllowedImageMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

const MIME_TO_EXT: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime)
}

/**
 * Inspect file magic bytes to verify the image is genuinely JPEG, PNG, or WebP
 * rather than trusting the spoofable File.type or filename extension.
 */
export async function detectImageMimeFromBytes(
  file: Blob
): Promise<AllowedImageMime | null> {
  const buffer = await file.slice(0, 12).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (bytes.length < 4) {
    return null
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

export type PreparedPhoto = {
  blob: Blob
  contentType: AllowedImageMime
  extension: string
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: AllowedImageMime,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality)
  })
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image.'))
    }
    img.src = url
  })
}

/**
 * Validate magic bytes, strip EXIF metadata (including GPS coordinates) by
 * re-encoding onto an offscreen canvas, and downscale oversized images.
 */
export async function prepareFoodPhotoForUpload(
  file: File
): Promise<PreparedPhoto> {
  const detectedMime = await detectImageMimeFromBytes(file)
  if (!detectedMime) {
    throw new Error('Please select a valid JPG, PNG, or WebP image.')
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('Image size must be 5 MB or smaller.')
  }

  const image = await loadImageElement(file)
  const scale = Math.min(
    1,
    MAX_DIMENSION_PX / Math.max(image.naturalWidth || 1, image.naturalHeight || 1)
  )
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Unable to process the selected image in this browser.')
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  // Prefer WebP for smaller uploads; fall back to JPEG if WebP encoding is unsupported.
  let outputMime: AllowedImageMime = 'image/webp'
  let outputBlob = await canvasToBlob(canvas, outputMime, OUTPUT_QUALITY)

  if (!outputBlob || outputBlob.type !== 'image/webp') {
    outputMime = 'image/jpeg'
    outputBlob = await canvasToBlob(canvas, outputMime, OUTPUT_QUALITY)
  }

  if (!outputBlob) {
    throw new Error('Unable to compress the selected image.')
  }

  return {
    blob: outputBlob,
    contentType: outputMime,
    extension: MIME_TO_EXT[outputMime],
  }
}

