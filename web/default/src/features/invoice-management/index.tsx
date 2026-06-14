import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  getAdminInvoiceRequests,
  updateInvoiceRequest,
  type InvoiceRequestDetail,
} from './api'

function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function parseOrderIds(orderIdsJson: string): string[] {
  try {
    return JSON.parse(orderIdsJson) as string[]
  } catch {
    return []
  }
}

function InvoiceCard({
  item,
  onUpdate,
}: {
  item: InvoiceRequestDetail
  onUpdate: () => void
}) {
  const { t } = useTranslation()
  const [note, setNote] = useState(item.note || '')
  const [saving, setSaving] = useState(false)

  const orderIds = parseOrderIds(item.order_ids)
  const isCompleted = item.status === 'completed'

  const handleToggleStatus = async () => {
    setSaving(true)
    try {
      const newStatus = isCompleted ? 'pending' : 'completed'
      const res = await updateInvoiceRequest(item.id, newStatus, note)
      if (res.success) {
        toast.success(t('Updated successfully'))
        onUpdate()
      } else {
        toast.error(res.message || t('Update failed'))
      }
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNote = async () => {
    setSaving(true)
    try {
      const res = await updateInvoiceRequest(item.id, item.status, note)
      if (res.success) {
        toast.success(t('Note saved'))
        onUpdate()
      } else {
        toast.error(res.message || t('Update failed'))
      }
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='bg-card border-border rounded-lg border p-4 shadow-sm'>
      <div className='mb-3 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <FileText className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>
            #{item.id} - {item.username || `User ${item.user_id}`}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {isCompleted ? (
            <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400'>
              <Check className='h-3 w-3' />
              {t('Invoiced')}
            </span>
          ) : (
            <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'>
              <Clock className='h-3 w-3' />
              {t('Pending')}
            </span>
          )}
        </div>
      </div>

      {item.header && (
        <div className='bg-muted/50 mb-3 rounded-md p-3'>
          <div className='mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            {t('Invoice Header')}
          </div>
          <div className='grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2'>
            <div>
              <span className='text-muted-foreground'>{t('Company')}:</span>{' '}
              {item.header.company_name}
            </div>
            <div>
              <span className='text-muted-foreground'>{t('Tax Number')}:</span>{' '}
              {item.header.tax_number}
            </div>
            {item.header.bank_name && (
              <div>
                <span className='text-muted-foreground'>{t('Bank')}:</span>{' '}
                {item.header.bank_name}
              </div>
            )}
            {item.header.bank_account && (
              <div>
                <span className='text-muted-foreground'>
                  {t('Bank Account')}:
                </span>{' '}
                {item.header.bank_account}
              </div>
            )}
            <div>
              <span className='text-muted-foreground'>{t('Email')}:</span>{' '}
              {item.header.email}
            </div>
          </div>
        </div>
      )}

      <div className='mb-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2'>
        <div>
          <span className='text-muted-foreground'>{t('Total Amount')}:</span>{' '}
          <span className='font-medium'>¥{item.total_amount.toFixed(2)}</span>
        </div>
        <div>
          <span className='text-muted-foreground'>{t('Submit Time')}:</span>{' '}
          {formatTime(item.created_at)}
        </div>
      </div>

      {orderIds.length > 0 && (
        <div className='mb-3'>
          <div className='mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            {t('Order Numbers')}
          </div>
          <div className='flex flex-wrap gap-1'>
            {orderIds.map((oid) => (
              <span
                key={oid}
                className='bg-muted rounded px-2 py-0.5 font-mono text-xs'
              >
                {oid}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className='mb-3'>
        <div className='mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          {t('Note')}
        </div>
        <div className='flex gap-2'>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('Add a note...')}
            rows={2}
            className='text-sm'
          />
          <Button
            variant='outline'
            size='sm'
            onClick={handleSaveNote}
            disabled={saving || note === (item.note || '')}
            className='shrink-0 self-end'
          >
            {t('Save')}
          </Button>
        </div>
      </div>

      <div className='flex justify-end'>
        <Button
          variant={isCompleted ? 'outline' : 'default'}
          size='sm'
          onClick={handleToggleStatus}
          disabled={saving}
        >
          {isCompleted ? t('Mark as Pending') : t('Mark as Invoiced')}
        </Button>
      </div>
    </div>
  )
}

export function InvoiceManagement() {
  const { t } = useTranslation()
  const [items, setItems] = useState<InvoiceRequestDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchData = useCallback(
    async (p: number) => {
      try {
        setLoading(true)
        const res = await getAdminInvoiceRequests(p, pageSize)
        if (res.success && res.data) {
          setItems(res.data.items || [])
          setTotal(res.data.total)
        }
      } catch {
        toast.error(t('Failed to load invoice requests'))
      } finally {
        setLoading(false)
      }
    },
    [pageSize, t]
  )

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const handlePageChange = (p: number) => {
    setPage(p)
    fetchData(p)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Invoice Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-4'>
          {loading ? (
            <div className='text-muted-foreground py-12 text-center text-sm'>
              {t('Loading...')}
            </div>
          ) : items.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center text-sm'>
              {t('No invoice requests')}
            </div>
          ) : (
            <>
              <div className='flex flex-col gap-3'>
                {items.map((item) => (
                  <InvoiceCard
                    key={item.id}
                    item={item}
                    onUpdate={() => fetchData(page)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className='flex items-center justify-center gap-2 py-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <span className='text-muted-foreground text-sm'>
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
