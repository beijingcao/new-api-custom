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
import type { Table } from '@tanstack/react-table'
import { Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { deleteUser, manageUser } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type { ManageUserAction, User } from '../types'
import { useUsers } from './users-provider'

type BulkUserAction = Extract<ManageUserAction, 'enable' | 'disable' | 'delete'>

interface DataTableBulkActionsProps {
  table: Table<User>
}

function getBulkActionSuccessMessage(action: BulkUserAction): string {
  if (action === 'delete') {
    return 'Successfully deleted {{count}} selected user(s)'
  }
  if (action === 'enable') {
    return 'Successfully enabled {{count}} selected user(s)'
  }
  return 'Successfully disabled {{count}} selected user(s)'
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedUsers = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)

  const processAction = async (action: BulkUserAction) => {
    if (selectedUsers.length === 0 || isProcessing) return

    setIsProcessing(true)
    try {
      const results = await Promise.allSettled(
        selectedUsers.map(async (user) => {
          if (action === 'delete') {
            return deleteUser(user.id)
          }
          return manageUser(user.id, action)
        })
      )
      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value.success
      ).length
      const failed = results.length - successful

      if (successful > 0) {
        toast.success(
          t(getBulkActionSuccessMessage(action), { count: successful })
        )
        triggerRefresh()
      }
      if (failed > 0) {
        toast.error(
          t('Failed to process {{count}} selected user(s)', { count: failed })
        )
      }

      table.resetRowSelection()
      setDeleteDialogOpen(false)
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsProcessing(false)
    }
  }

  const selectedCount = selectedUsers.length

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                disabled={isProcessing}
                onClick={() => processAction('enable')}
                aria-label={t('Enable selected users')}
                title={t('Enable selected users')}
              />
            }
          >
            <Power />
            <span className='sr-only'>{t('Enable selected users')}</span>
          </TooltipTrigger>
          <TooltipContent>{t('Enable selected users')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                disabled={isProcessing}
                onClick={() => processAction('disable')}
                aria-label={t('Disable selected users')}
                title={t('Disable selected users')}
              />
            }
          >
            <PowerOff />
            <span className='sr-only'>{t('Disable selected users')}</span>
          </TooltipTrigger>
          <TooltipContent>{t('Disable selected users')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='destructive'
                size='icon'
                className='size-8'
                disabled={isProcessing}
                onClick={() => setDeleteDialogOpen(true)}
                aria-label={t('Delete selected users')}
                title={t('Delete selected users')}
              />
            }
          >
            <Trash2 />
            <span className='sr-only'>{t('Delete selected users')}</span>
          </TooltipTrigger>
          <TooltipContent>{t('Delete selected users')}</TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('Delete selected users?')}
        desc={t(
          'This will permanently delete {{count}} selected user(s). This action cannot be undone.',
          { count: selectedCount }
        )}
        confirmText={isProcessing ? t('Deleting...') : t('Delete')}
        destructive
        isLoading={isProcessing}
        handleConfirm={() => processAction('delete')}
      />
    </>
  )
}
