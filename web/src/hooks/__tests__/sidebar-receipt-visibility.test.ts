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
import { describe, expect, test } from 'vitest'

import { isReceiptRouteVisible } from '../sidebar-receipt-visibility.ts'

describe('receipt sidebar visibility', () => {
  test('keeps the receipt route visible when the backend setting is enabled', () => {
    expect(isReceiptRouteVisible('/receipt', true)).toBe(true)
  })

  test('hides only the user receipt route when the backend setting is disabled', () => {
    expect(isReceiptRouteVisible('/receipt', false)).toBe(false)
    expect(isReceiptRouteVisible('/invoice-management', false)).toBe(true)
  })
})
