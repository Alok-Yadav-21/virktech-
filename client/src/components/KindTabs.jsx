import { useState } from 'react'
import { Chip } from './ui/primitives'

// Electronics | Vapes buttons at the top of the Stock and Deliveries pages, same idea as the till: pick a category and the
// page below is that category's. Each side is its own page component, so nothing is shared between the two ranges.
export default function KindTabs({ electronics, vapes }) {
  const [kind, setKind] = useState('electronics')
  return (
    <>
      <div className="d-flex gap-2 mb-3">
        <Chip active={kind === 'electronics'} onClick={() => setKind('electronics')}>Electronics</Chip>
        <Chip active={kind === 'vape'} onClick={() => setKind('vape')}>Vapes</Chip>
      </div>
      {kind === 'vape' ? vapes : electronics}
    </>
  )
}
