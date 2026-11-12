import useFetch from '../../hooks/useFetch'
import Icon from '../../components/ui/Icon'
import { VAPE_KINDS } from '../../vapeConstants'

// A big, picture-first button. Whole tile is the tap target.
export function BigTile({ icon, title, hint, onClick, tone = '' }) {
  return (
    <button type="button" className={`vt-card w-100 h-100 p-3 p-md-4 border text-center ${tone}`} style={{ minHeight: '8rem' }} onClick={onClick}>
      <span className="d-block mb-2"><Icon name={icon} size={40} /></span>
      <strong className="d-block fs-5 lh-sm">{title}</strong>
      {hint && <span className="d-block text-secondary mt-1">{hint}</span>}
    </button>
  )
}

// Pick an icon from the words in a category name; anything unknown gets a plain box.
const ICONS = [[/phone|cover|case/i, 'phone'], [/laptop|macbook/i, 'laptop'], [/tablet|ipad/i, 'tablet'], [/speaker|audio|head|ear/i, 'audio'],
  [/watch|wearable/i, 'watch'], [/charg|cable|power/i, 'bolt'], [/liquid/i, 'drop'], [/pod kit|battery/i, 'battery']]
export const iconFor = (name) => ICONS.find(([re]) => re.test(name))?.[1] || 'box'

// Step 1: electronics or vapes.
export function KindStep({ onPick }) {
  return (
    <>
      <h2 className="h4 mb-3">What did you get?</h2>
      <div className="row g-3">
        <div className="col-6"><BigTile icon="phone" title="Electronics" hint="Phones, speakers, covers, laptops…" onClick={() => onPick('electronics')} /></div>
        <div className="col-6"><BigTile icon="drop" title="Vapes" hint="Pods, liquids, coils…" onClick={() => onPick('vape')} /></div>
      </div>
    </>
  )
}

// Step 2: which kind of electronics (the shop's categories) or which type of vape. "Everything" skips the choice.
export function SubStep({ kind, onPick }) {
  const cats = useFetch(kind === 'electronics' ? '/categories' : null)
  const options = kind === 'electronics' ? (cats.data || []).map((c) => ({ value: String(c.id), label: c.name })) : VAPE_KINDS.map((k) => ({ value: k, label: k }))
  return (
    <>
      <h2 className="h4 mb-3">Which kind?</h2>
      {cats.loading && kind === 'electronics' && <div className="spinner-border" />}
      <div className="row g-3">
        {options.map((o) => (
          <div key={o.value} className="col-6 col-md-4 col-lg-3"><BigTile icon={iconFor(o.label)} title={o.label} onClick={() => onPick(o.value, o.label)} /></div>
        ))}
        <div className="col-6 col-md-4 col-lg-3"><BigTile icon="search" title="Show everything" onClick={() => onPick('', 'Everything')} /></div>
      </div>
    </>
  )
}
