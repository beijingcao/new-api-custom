import { createFileRoute } from '@tanstack/react-router'

import { DownloadPage } from '@/features/download'

export const Route = createFileRoute('/download/')({
  component: DownloadPage,
})
