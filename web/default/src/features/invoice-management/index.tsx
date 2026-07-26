import {
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Search,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import {
  getAdminInvoiceRequests,
  updateInvoiceRequest,
  type InvoiceRequestDetail,
} from './api'
import { downloadCsv } from './export-csv'

const STATUS_ALL = 'all'

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

  // Completed (invoiced) requests are de-emphasised — grayed out with a neutral
  // left border — so the admin's eye is drawn to the pending ones that still
  // need action. Pending requests get an amber accent border.
  const headerLine = item.header
    ? [
        item.header.company_name,
        item.header.tax_number,
        item.header.bank_name,
        item.header.bank_account,
        item.header.email,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div
      className={cn(
        'rounded-lg border border-l-2 p-3 text-sm transition-colors',
        isCompleted
          ? 'border-l-muted-foreground/40 bg-muted/40 opacity-80'
          : 'bg-card border-l-amber-400'
      )}
    >
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        <FileText className='text-muted-foreground h-4 w-4 shrink-0' />
        <span className='font-medium'>
          #{item.id} · {item.username || `User ${item.user_id}`}
        </span>
        <span className='text-muted-foreground text-xs'>ID {item.user_id}</span>
        <span className='font-semibold'>¥{item.total_amount.toFixed(2)}</span>
        {isCompleted ? (
          <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400'>
            <Check className='h-3 w-3' />
            {t('Invoiced')}
          </span>
        ) : (
          <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'>
            <Clock className='h-3 w-3' />
            {t('Pending')}
          </span>
        )}
        <span className='text-muted-foreground ml-auto text-xs'>
          {formatTime(item.created_at)}
        </span>
      </div>

      {headerLine && (
        <div className='text-muted-foreground mt-1.5 text-xs leading-relaxed'>
          {headerLine}
        </div>
      )}

      {orderIds.length > 0 && (
        <div className='mt-1.5 flex flex-wrap gap-1'>
          {orderIds.map((oid) => (
            <span
              key={oid}
              className='bg-muted rounded px-1.5 py-0.5 font-mono text-xs'
            >
              {oid}
            </span>
          ))}
        </div>
      )}

      <div className='mt-2 flex items-center gap-2'>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('Add a note...')}
          className='h-8 text-xs'
        />
        <Button
          variant='outline'
          size='sm'
          onClick={handleSaveNote}
          disabled={saving || note === (item.note || '')}
          className='h-8 shrink-0'
        >
          {t('Save')}
        </Button>
        <Button
          variant={isCompleted ? 'outline' : 'default'}
          size='sm'
          onClick={handleToggleStatus}
          disabled={saving}
          className='h-8 shrink-0'
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

  // `keyword` is the live input value; `appliedKeyword` is what's actually
  // filtering (applied on Search / Enter). `statusFilter` applies immediately.
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(
    async (p: number, kw: string, st: string) => {
      try {
        setLoading(true)
        const res = await getAdminInvoiceRequests(
          p,
          pageSize,
          kw,
          st === STATUS_ALL ? '' : st
        )
        if (res.success && res.data) {
          setItems(res.data.items || [])
          setTotal(res.data.total)
        } else {
          // Surface the backend message so a query/permission error doesn't
          // look like an empty list.
          setItems([])
          setTotal(0)
          toast.error(res.message || t('Failed to load invoice requests'))
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
    fetchData(1, '', STATUS_ALL)
  }, [fetchData])

  const handlePageChange = (p: number) => {
    setPage(p)
    fetchData(p, appliedKeyword, statusFilter)
  }

  const handleSearch = () => {
    setAppliedKeyword(keyword)
    setPage(1)
    fetchData(1, keyword, statusFilter)
  }

  const handleStatusChange = (value: string | null) => {
    const st = value ?? STATUS_ALL
    setStatusFilter(st)
    setPage(1)
    fetchData(1, appliedKeyword, st)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const all: InvoiceRequestDetail[] = []
      const exportPageSize = 100
      let p = 1
      // Page through every record matching the current filters. Capped at
      // 200 pages (20k rows) as a runaway safety net.
      for (let i = 0; i < 200; i++) {
        const res = await getAdminInvoiceRequests(
          p,
          exportPageSize,
          appliedKeyword,
          statusFilter === STATUS_ALL ? '' : statusFilter
        )
        if (!res.success || !res.data) break
        all.push(...(res.data.items || []))
        if (
          all.length >= res.data.total ||
          (res.data.items || []).length < exportPageSize
        ) {
          break
        }
        p += 1
      }

      if (all.length === 0) {
        toast.info(t('No invoice requests'))
        return
      }

      const headers = [
        t('ID'),
        t('User'),
        t('Company'),
        t('Tax Number'),
        t('Bank'),
        t('Bank Account'),
        t('Email'),
        t('Order Numbers'),
        t('Total Amount'),
        t('Status'),
        t('Note'),
        t('Submit Time'),
      ]
      const rows = all.map((item) => [
        item.id,
        item.username || `User ${item.user_id}`,
        item.header?.company_name ?? '',
        item.header?.tax_number ?? '',
        item.header?.bank_name ?? '',
        item.header?.bank_account ?? '',
        item.header?.email ?? '',
        parseOrderIds(item.order_ids).join('; '),
        item.total_amount.toFixed(2),
        item.status === 'completed' ? t('Invoiced') : t('Pending'),
        item.note ?? '',
        formatTime(item.created_at),
      ])
      downloadCsv(`invoices_${Date.now()}.csv`, headers, rows)
      toast.success(t('Export successful'))
    } catch {
      toast.error(t('Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const statusItems = [
    { value: STATUS_ALL, label: t('All') },
    { value: 'pending', label: t('Pending') },
    { value: 'completed', label: t('Invoiced') },
  ]

  const totalPages = Math.ceil(total / pageSize)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Invoice Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-4'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <div className='flex flex-1 items-center gap-2'>
              <Input
                placeholder={t('Search by user ID, company, or order number')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
              />
              <Button
                variant='outline'
                size='sm'
                onClick={handleSearch}
                className='shrink-0 gap-1.5'
              >
                <Search className='h-4 w-4' />
                {t('Search')}
              </Button>
            </div>
            <div className='flex items-center gap-2'>
              <Select
                items={statusItems}
                value={statusFilter}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {statusItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant='outline'
                size='sm'
                onClick={handleExport}
                disabled={exporting}
                className='shrink-0 gap-1.5'
              >
                {exporting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Download className='h-4 w-4' />
                )}
                {t('Export to Excel')}
              </Button>
            </div>
          </div>

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
              <div className='flex flex-col gap-2'>
                {items.map((item) => (
                  <InvoiceCard
                    key={item.id}
                    item={item}
                    onUpdate={() =>
                      fetchData(page, appliedKeyword, statusFilter)
                    }
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
