/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { Table } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { User } from '../../types'
import { DataTableBulkActions } from '../data-table-bulk-actions'
import { UsersProvider } from '../users-provider'

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  manageUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('../../api', () => ({
  deleteUser: mocks.deleteUser,
  manageUser: mocks.manageUser,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

vi.mock('@/components/data-table', () => ({
  DataTableBulkActions: (props: { children: ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

vi.mock('@/components/confirm-dialog', () => ({
  ConfirmDialog: (props: {
    open: boolean
    title: ReactNode
    desc: ReactNode
    confirmText?: ReactNode
    handleConfirm: () => void
  }) =>
    props.open ? (
      <div role='dialog'>
        <h2>{props.title}</h2>
        <p>{props.desc}</p>
        <button type='button' onClick={props.handleConfirm}>
          {props.confirmText}
        </button>
      </div>
    ) : null,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: (props: { children: ReactNode }) => props.children,
  TooltipContent: (props: { children: ReactNode }) => props.children,
  TooltipTrigger: (props: { render: ReactNode }) => props.render,
}))

function createTable(users: User[]) {
  return {
    getFilteredSelectedRowModel: () => ({
      rows: users.map((original) => ({ original })),
    }),
    resetRowSelection: vi.fn(),
  } as unknown as Table<User>
}

function createUser(id: number): User {
  return {
    id,
    username: `user-${id}`,
    display_name: `User ${id}`,
    email: `user-${id}@example.com`,
    quota: 0,
    used_quota: 0,
    request_count: 0,
    group: 'default',
    status: 1,
    role: 1,
  }
}

function renderBulkActions(users: User[]) {
  const table = createTable(users)
  render(
    <UsersProvider>
      <DataTableBulkActions table={table} />
    </UsersProvider>
  )
  return table
}

describe('user bulk actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.manageUser.mockResolvedValue({ success: true })
    mocks.deleteUser.mockResolvedValue({ success: true })
  })

  test('disables every selected user and clears the selection after success', async () => {
    const user = userEvent.setup()
    const table = renderBulkActions([createUser(1), createUser(2)])

    await user.click(
      screen.getByRole('button', { name: 'Disable selected users' })
    )

    expect(mocks.manageUser).toHaveBeenCalledTimes(2)
    expect(mocks.manageUser).toHaveBeenCalledWith(1, 'disable')
    expect(mocks.manageUser).toHaveBeenCalledWith(2, 'disable')
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Successfully disabled 2 selected user(s)'
    )
    expect(table.resetRowSelection).toHaveBeenCalledOnce()
  })

  test('requires confirmation before deleting selected users', async () => {
    const user = userEvent.setup()
    renderBulkActions([createUser(3), createUser(4)])

    await user.click(
      screen.getByRole('button', { name: 'Delete selected users' })
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'This will permanently delete 2 selected user(s)'
    )
    expect(mocks.deleteUser).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mocks.deleteUser).toHaveBeenCalledWith(3)
    expect(mocks.deleteUser).toHaveBeenCalledWith(4)
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Successfully deleted 2 selected user(s)'
    )
  })

  test('reports failed users while preserving successful operations', async () => {
    mocks.manageUser
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'already disabled' })
    const user = userEvent.setup()
    renderBulkActions([createUser(5), createUser(6)])

    await user.click(
      screen.getByRole('button', { name: 'Enable selected users' })
    )

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Successfully enabled 1 selected user(s)'
    )
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Failed to process 1 selected user(s)'
    )
  })
})
