import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog } from '@/components/dialog'
import type { InvoiceHeader, TopupOrder } from '../types'

interface InvoiceRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  headers: InvoiceHeader[]
  selectedOrders: TopupOrder[]
  onSubmit: (headerId: number) => Promise<void>
  submitting: boolean
}

export function InvoiceRequestDialog({
  open,
  onOpenChange,
  headers,
  selectedOrders,
  onSubmit,
  submitting,
}: InvoiceRequestDialogProps) {
  const { t } = useTranslation()
  const [selectedHeaderId, setSelectedHeaderId] = useState<string>('')

  const totalMoney = selectedOrders.reduce((sum, o) => sum + o.money, 0)

  const handleSubmit = async () => {
    if (!selectedHeaderId) return
    await onSubmit(parseInt(selectedHeaderId))
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedHeaderId('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('Request Invoice')}
      description={t('Select invoice header and confirm your request')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      footer={
        <>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedHeaderId || submitting}
          >
            {submitting ? t('Submitting...') : t('Submit Request')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label>{t('Invoice Header')}</Label>
          {headers.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {t('Please add an invoice header first')}
            </p>
          ) : (
            <Select
              items={headers.map((h) => ({
                value: String(h.id),
                label: h.company_name,
              }))}
              value={selectedHeaderId}
              onValueChange={(v) => v !== null && setSelectedHeaderId(v)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('Select invoice header')}
                />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {headers.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.company_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className='space-y-2'>
          <Label>
            {t('Selected Orders')} ({selectedOrders.length})
          </Label>
          <div className='bg-muted/40 max-h-48 space-y-1.5 overflow-y-auto rounded-lg p-3'>
            {selectedOrders.map((order) => (
              <div
                key={order.id}
                className='flex items-center justify-between text-sm'
              >
                <code className='text-muted-foreground truncate font-mono text-xs'>
                  {order.trade_no}
                </code>
                <span className='ml-2 shrink-0 font-medium'>
                  ¥{formatNumber(order.money)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className='flex items-center justify-between rounded-lg border p-3'>
          <span className='text-sm font-medium'>{t('Total Amount')}</span>
          <span className='text-lg font-bold'>
            ¥{formatNumber(totalMoney)}
          </span>
        </div>
      </div>
    </Dialog>
  )
}
