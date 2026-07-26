/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Download, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { exportUsersCsv } from '../export-users'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUsers()
  const [exporting, setExporting] = useState(false)

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const count = await exportUsersCsv(t)
      if (count === 0) {
        toast.info(t('No data to export'))
      } else {
        toast.success(t('Export successful'))
      }
    } catch {
      toast.error(t('Export failed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <Download className='h-4 w-4' />
        )}
        {exporting ? t('Exporting...') : t('Export')}
      </Button>
      <Button size='sm' onClick={handleCreate}>
        <Plus className='h-4 w-4' />
        {t('Add User')}
      </Button>
    </div>
  )
}
