import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Stock from '../Stock'
import AddFlow from './AddFlow'
import TodayDeliveries from './TodayDeliveries'

const TABS = [
  { key: 'stock', label: 'Add stock', hint: 'Items you have counted', icon: 'box' },
  { key: 'delivery', label: 'New delivery', hint: 'Goods from a supplier', icon: 'receipt' },
  { key: 'list', label: 'Stock list', hint: 'See or fix a count', icon: 'list' },
]

// The staff "Stock & deliveries" page. The till button opens it straight on a tab (?tab=delivery). Big tabs, plain words.
export default function Inventory() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'stock'
  const [dirty, setDirty] = useState(false) // a list that is not saved yet
  const [version, setVersion] = useState(0) // bumps after a save so today's deliveries refresh
  const onDirty = useCallback(setDirty, [])
  const change = useCallback(() => setVersion((v) => v + 1), [])

  const open = (key) => {
    if (dirty && !window.confirm('Your list is not saved yet. Leave without saving?')) return
    setDirty(false)
    setParams({ tab: key })
  }

  return (
    <>
      <h1 className="h3 mb-3">Stock &amp; deliveries</h1>
      <div className="row g-2 mb-4" role="tablist">
        {TABS.map((t) => (
          <div key={t.key} className="col-4">
            <button type="button" role="tab" aria-selected={tab === t.key} onClick={() => open(t.key)}
              className={`btn w-100 py-3 ${tab === t.key ? 'btn-primary' : 'btn-outline-primary'}`}>
              <Icon name={t.icon} size={28} />
              <strong className="d-block fs-6 mt-1">{t.label}</strong>
              <small className="d-none d-sm-block">{t.hint}</small>
            </button>
          </div>
        ))}
      </div>
      {tab === 'stock' && <AddFlow key="stock" mode="stock" onSaved={change} onDirty={onDirty} />}
      {tab === 'delivery' && (
        <>
          <AddFlow key="delivery" mode="delivery" onSaved={change} onDirty={onDirty} />
          <TodayDeliveries key={version} onChanged={change} />
        </>
      )}
      {tab === 'list' && <Stock />}
    </>
  )
}
