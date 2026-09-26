export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function parseApiError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return data.detail || data.error || data.message || `Server error (${res.status})`
    } catch {
      return text || `Server error (${res.status})`
    }
  } catch {
    return `Server error (${res.status})`
  }
}
