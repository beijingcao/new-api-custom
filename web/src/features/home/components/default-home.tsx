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
import { Footer } from '@/components/layout/components/footer'

import { CTA } from './sections/cta'
import { Features } from './sections/features'
import { Hero } from './sections/hero'
import { HowItWorks } from './sections/how-it-works'
import { Stats } from './sections/stats'

interface DefaultHomeProps {
  isAuthenticated: boolean
}

/**
 * The built-in marketing landing page, rendered only when no custom
 * HomePageContent is configured in admin settings.
 *
 * Keeping these sections behind a lazy import means operators with custom home
 * content do not download or render the built-in landing page.
 */
export default function DefaultHome({ isAuthenticated }: DefaultHomeProps) {
  return (
    <>
      <Hero isAuthenticated={isAuthenticated} />
      <Stats />
      <Features />
      <HowItWorks />
      <CTA isAuthenticated={isAuthenticated} />
      <Footer />
    </>
  )
}
