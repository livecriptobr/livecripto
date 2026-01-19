export async function uploadToBunny(params: {
  path: string
  content: Buffer
  contentType?: string
}): Promise<string> {
  const { path, content, contentType = 'audio/mpeg' } = params

  const storageUrl = `https://${process.env.BUNNY_STORAGE_HOST}/${process.env.BUNNY_STORAGE_ZONE}/${path}`

  // Convert Buffer to Uint8Array for fetch compatibility
  const body = new Uint8Array(content)

  const response = await fetch(storageUrl, {
    method: 'PUT',
    headers: {
      AccessKey: process.env.BUNNY_STORAGE_KEY!,
      'Content-Type': contentType,
    },
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Bunny upload failed: ${error}`)
  }

  return `https://${process.env.BUNNY_CDN_HOST}/${path}`
}

export async function deleteFromBunny(path: string): Promise<void> {
  const storageUrl = `https://${process.env.BUNNY_STORAGE_HOST}/${process.env.BUNNY_STORAGE_ZONE}/${path}`

  const response = await fetch(storageUrl, {
    method: 'DELETE',
    headers: {
      AccessKey: process.env.BUNNY_STORAGE_KEY!,
    },
  })

  // 404 is OK (already deleted)
  if (!response.ok && response.status !== 404) {
    throw new Error(`Bunny delete failed: ${response.status}`)
  }
}

export function getPathFromUrl(url: string): string | null {
  const cdnHost = process.env.BUNNY_CDN_HOST
  if (!cdnHost || !url.includes(cdnHost)) return null
  return url.split(cdnHost + '/')[1] || null
}
