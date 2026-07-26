import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddHeaderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (header: {
    company_name: string
    tax_number: string
    bank_name: string
    bank_account: string
    email: string
  }) => Promise<boolean>
  submitting: boolean
}

export function AddHeaderDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: AddHeaderDialogProps) {
  const { t } = useTranslation()
  const [companyName, setCompanyName] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [email, setEmail] = useState('')

  const canSubmit =
    companyName.trim() !== '' && taxNumber.trim() !== '' && email.trim() !== ''

  const handleSubmit = async () => {
    const success = await onSubmit({
      company_name: companyName.trim(),
      tax_number: taxNumber.trim(),
      bank_name: bankName.trim(),
      bank_account: bankAccount.trim(),
      email: email.trim(),
    })
    if (success) {
      setCompanyName('')
      setTaxNumber('')
      setBankName('')
      setBankAccount('')
      setEmail('')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Add Invoice Header')}
      description={t('Enter company billing information for invoice requests')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label>
            {t('Company Name')} <span className='text-red-500'>*</span>
          </Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t('Enter company name')}
          />
        </div>
        <div className='space-y-2'>
          <Label>
            {t('Tax Number')} <span className='text-red-500'>*</span>
          </Label>
          <Input
            value={taxNumber}
            onChange={(e) => setTaxNumber(e.target.value)}
            placeholder={t('Enter tax identification number')}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('Bank Name')}</Label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={t('Enter bank name (optional)')}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('Bank Account')}</Label>
          <Input
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder={t('Enter bank account number (optional)')}
          />
        </div>
        <div className='space-y-2'>
          <Label>
            {t('Receiving Email')} <span className='text-red-500'>*</span>
          </Label>
          <Input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('Enter email to receive invoice')}
          />
        </div>
      </div>
    </Dialog>
  )
}
