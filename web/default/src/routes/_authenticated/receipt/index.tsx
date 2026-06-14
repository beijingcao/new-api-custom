import { createFileRoute } from '@tanstack/react-router'
import { Receipt } from '@/features/receipt'

export const Route = createFileRoute('/_authenticated/receipt/')({
  component: Receipt,
})
