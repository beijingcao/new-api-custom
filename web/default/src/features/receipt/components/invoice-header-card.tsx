import { useState } from 'react'
import { Plus, Trash2, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createInvoiceHeader, deleteInvoiceHeader } from '../api'
import type { InvoiceHeader } from '../types'
import { AddHeaderDialog } from './add-header-dialog'

interface InvoiceHeaderCardProps {
  headers: InvoiceHeader[]
  loading: boolean
  onRefresh: () => void
}

export function InvoiceHeaderCard({
  headers,
  loading,
  onRefresh,
}: InvoiceHeaderCardProps) {
  const { t } = useTranslation()
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async (header: {
    company_name: string
    tax_number: string
    bank_name: string
    bank_account: string
    email: string
  }) => {
    setSubmitting(true)
    try {
      const res = await createInvoiceHeader(header)
      if (res.success) {
        toast.success(t('Invoice header added'))
        setAddOpen(false)
        onRefresh()
        return true
      }
      toast.error(res.message || t('Failed to add invoice header'))
      return false
    } catch {
      toast.error(t('Failed to add invoice header'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    setDeleting(true)
    try {
      const res = await deleteInvoiceHeader(deleteId)
      if (res.success) {
        toast.success(t('Invoice header deleted'))
        setDeleteId(null)
        onRefresh()
      } else {
        toast.error(res.message || t('Failed to delete'))
      }
    } catch {
      toast.error(t('Failed to delete'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className='rounded-xl border p-4 sm:p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Building2 className='text-muted-foreground size-5' />
            <h2 className='text-base font-semibold'>{t('Invoice Headers')}</h2>
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setAddOpen(true)}
            className='gap-1.5'
          >
            <Plus className='size-4' />
            {t('Add')}
          </Button>
        </div>

        {loading ? (
          <div className='space-y-3'>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className='rounded-lg border p-3'>
                <Skeleton className='mb-2 h-4 w-48' />
                <Skeleton className='h-3 w-32' />
              </div>
            ))}
          </div>
        ) : headers.length === 0 ? (
          <div className='text-muted-foreground flex min-h-24 flex-col items-center justify-center text-center'>
            <p className='text-sm'>{t('No invoice headers yet')}</p>
            <p className='mt-1 text-xs'>
              {t('Add company billing info to request invoices')}
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {headers.map((header) => (
              <div
                key={header.id}
                className='hover:bg-muted/50 flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors sm:p-4'
              >
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='truncate text-sm font-medium'>
                    {header.company_name}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Tax Number')}: {header.tax_number}
                  </div>
                  {header.bank_name && (
                    <div className='text-muted-foreground text-xs'>
                      {t('Bank')}: {header.bank_name}
                      {header.bank_account && ` / ${header.bank_account}`}
                    </div>
                  )}
                  <div className='text-muted-foreground text-xs'>
                    {t('Email')}: {header.email}
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 p-0'
                  onClick={() => setDeleteId(header.id)}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddHeaderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
        submitting={submitting}
      />

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Invoice Header')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to delete this invoice header? This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? t('Deleting...') : t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
