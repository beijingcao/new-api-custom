import { useState } from 'react'
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import {
  getPaymentMethodName,
} from '@/features/wallet/lib/billing'
import type { TopupOrder, InvoiceHeader } from '../types'
import { InvoiceRequestDialog } from './invoice-request-dialog'

interface OrderListCardProps {
  orders: TopupOrder[]
  invoicedStatus: Map<string, string>
  headers: InvoiceHeader[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onSubmitInvoice: (headerId: number, orderIds: string[]) => Promise<boolean>
  submitting: boolean
}

export function OrderListCard({
  orders,
  invoicedStatus,
  headers,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onSubmitInvoice,
  submitting,
}: OrderListCardProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)

  const totalPages = Math.ceil(total / pageSize)

  const availableOrders = orders.filter(
    (o) => o.status === 'success' && !invoicedStatus.has(o.trade_no)
  )

  const allAvailableSelected =
    availableOrders.length > 0 &&
    availableOrders.every((o) => selectedIds.has(o.trade_no))

  const toggleSelect = (tradeNo: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(tradeNo)) {
        next.delete(tradeNo)
      } else {
        next.add(tradeNo)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allAvailableSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(availableOrders.map((o) => o.trade_no)))
    }
  }

  const selectedOrders = orders.filter((o) => selectedIds.has(o.trade_no))

  const handleSubmit = async (headerId: number) => {
    const orderIds = Array.from(selectedIds)
    const success = await onSubmitInvoice(headerId, orderIds)
    if (success) {
      setDialogOpen(false)
      setSelectedIds(new Set())
    }
  }

  return (
    <>
      <div className='rounded-xl border p-4 sm:p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <FileText className='text-muted-foreground size-5' />
            <h2 className='text-base font-semibold'>
              {t('Order History')}
            </h2>
          </div>
          {selectedIds.size > 0 && (
            <Button
              size='sm'
              onClick={() => setDialogOpen(true)}
              className='gap-1.5'
            >
              {t('Request Invoice')} ({selectedIds.size})
            </Button>
          )}
        </div>

        {loading ? (
          <div className='space-y-3'>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className='rounded-lg border p-3'>
                <div className='flex items-start gap-3'>
                  <Skeleton className='mt-0.5 size-4 rounded' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-4 w-48' />
                    <Skeleton className='h-3 w-32' />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className='text-muted-foreground flex min-h-32 flex-col items-center justify-center text-center'>
            <p className='text-sm font-medium'>{t('No orders found')}</p>
            <p className='mt-1 text-xs'>
              {t('Your paid orders will appear here')}
            </p>
          </div>
        ) : (
          <>
            {availableOrders.length > 0 && (
              <div className='mb-3 flex items-center gap-2'>
                <Checkbox
                  checked={allAvailableSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <span className='text-muted-foreground text-xs'>
                  {t('Select all available orders')}
                </span>
              </div>
            )}

            <div className='space-y-1.5'>
              {orders.map((order) => {
                const requestStatus = invoicedStatus.get(order.trade_no)
                const isInvoiced = requestStatus === 'completed'
                const isIssuing = requestStatus === 'pending'
                const isLocked = isInvoiced || isIssuing
                const isNotSuccess = order.status !== 'success'
                const isSelected = selectedIds.has(order.trade_no)

                return (
                  <div
                    key={order.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-2.5 transition-colors sm:p-3',
                      // Already-requested rows (issuing / invoiced) are locked
                      // and grayed out so the eye lands on the still-selectable
                      // orders above them.
                      isLocked
                        ? 'bg-muted/40 opacity-60'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className='shrink-0'>
                      {isLocked ? (
                        <CheckCircle2 className='text-muted-foreground size-4' />
                      ) : isNotSuccess ? (
                        <div className='size-4' />
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(order.trade_no)}
                        />
                      )}
                    </div>

                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <code className='text-foreground truncate font-mono text-sm'>
                          {order.trade_no}
                        </code>
                        {isIssuing && (
                          <StatusBadge
                            label={t('Issuing')}
                            variant='warning'
                            copyable={false}
                          />
                        )}
                        {isInvoiced && (
                          <StatusBadge
                            label={t('Invoiced')}
                            variant='neutral'
                            copyable={false}
                          />
                        )}
                        {isNotSuccess && (
                          <StatusBadge
                            label={
                              order.status === 'pending'
                                ? t('Pending')
                                : t('Expired')
                            }
                            variant={
                              order.status === 'pending' ? 'warning' : 'danger'
                            }
                            copyable={false}
                          />
                        )}
                      </div>
                      <div className='text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs'>
                        <span>{formatTimestampToDate(order.create_time)}</span>
                        <span>·</span>
                        <span>
                          {getPaymentMethodName(order.payment_method, t)}
                        </span>
                      </div>
                    </div>

                    <div className='shrink-0 text-sm font-semibold'>
                      ¥{formatNumber(order.money)}
                    </div>
                  </div>
                )
              })}
            </div>

            {total > pageSize && (
              <div className='mt-4 flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='text-muted-foreground text-xs sm:text-sm'>
                  {t('Showing')} {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, total)} {t('of')} {total}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className='h-8 w-8 p-0'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                    <span className='font-medium'>{page}</span>
                    <span>/</span>
                    <span>{totalPages}</span>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className='h-8 w-8 p-0'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <InvoiceRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        headers={headers}
        selectedOrders={selectedOrders}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </>
  )
}
