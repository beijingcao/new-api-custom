import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { getUserBillingHistory } from '@/features/wallet/api'
import {
  getInvoiceHeaders,
  getInvoiceRequests,
  submitInvoiceRequest,
} from './api'
import { InvoiceHeaderCard } from './components/invoice-header-card'
import { OrderListCard } from './components/order-list-card'
import type { InvoiceHeader, TopupOrder } from './types'

export function Receipt() {
  const { t } = useTranslation()

  const [headers, setHeaders] = useState<InvoiceHeader[]>([])
  const [headersLoading, setHeadersLoading] = useState(true)

  const [orders, setOrders] = useState<TopupOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const [invoicedStatus, setInvoicedStatus] = useState<Map<string, string>>(
    new Map()
  )
  const [submitting, setSubmitting] = useState(false)

  const fetchHeaders = useCallback(async () => {
    try {
      setHeadersLoading(true)
      const res = await getInvoiceHeaders()
      if (res.success) {
        setHeaders(res.data || [])
      }
    } catch {
      // ignore
    } finally {
      setHeadersLoading(false)
    }
  }, [])

  const fetchOrders = useCallback(
    async (p: number) => {
      try {
        setOrdersLoading(true)
        const res = await getUserBillingHistory(p, pageSize, undefined, 'success')
        if (res.success && res.data) {
          setOrders(res.data.items as unknown as TopupOrder[])
          setTotal(res.data.total)
        }
      } catch {
        // ignore
      } finally {
        setOrdersLoading(false)
      }
    },
    [pageSize]
  )

  const fetchInvoicedIds = useCallback(async () => {
    try {
      const res = await getInvoiceRequests()
      if (res.success && res.invoiced_status) {
        setInvoicedStatus(new Map(Object.entries(res.invoiced_status)))
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchHeaders()
    fetchOrders(1)
    fetchInvoicedIds()
  }, [fetchHeaders, fetchOrders, fetchInvoicedIds])

  const handlePageChange = (p: number) => {
    setPage(p)
    fetchOrders(p)
  }

  const handleSubmitInvoice = async (
    headerId: number,
    orderIds: string[]
  ): Promise<boolean> => {
    setSubmitting(true)
    try {
      const res = await submitInvoiceRequest(headerId, orderIds)
      if (res.success) {
        toast.success(t('Invoice request submitted successfully'))
        fetchInvoicedIds()
        return true
      }
      toast.error(res.message || t('Failed to submit invoice request'))
      return false
    } catch {
      toast.error(t('Failed to submit invoice request'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Receipt')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5'>
          <InvoiceHeaderCard
            headers={headers}
            loading={headersLoading}
            onRefresh={fetchHeaders}
          />
          <OrderListCard
            orders={orders}
            invoicedStatus={invoicedStatus}
            headers={headers}
            loading={ordersLoading}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={handlePageChange}
            onSubmitInvoice={handleSubmitInvoice}
            submitting={submitting}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
