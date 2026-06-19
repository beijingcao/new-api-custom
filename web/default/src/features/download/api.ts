import { api } from '@/lib/api'
import type { DownloadPageResponse } from './types'

export async function getDownloadPageContent() {
  const res = await api.get<DownloadPageResponse>('/api/download_page')
  return res.data
}
