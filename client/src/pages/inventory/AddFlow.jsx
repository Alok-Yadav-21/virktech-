import { useEffect, useState } from 'react'
import api from '../../api'
import Icon from '../../components/ui/Icon'
import { KindStep, SubStep } from './KindTiles'
import ItemTiles from './ItemTiles'
import ListBar from './ListBar'
import ScanBar from './ScanBar'
import useLines from './useLines'

const KIND_LABEL = { electronics: 'Electronics', vape: 'Vapes' }

// The guided steps: 1 electronics or vapes, 2 which kind, 3 tap the items, then save. One question per screen, a big Back
// button always, and the list is kept while moving between kinds (it is only cleared when switching electronics <-> vapes).
export default function AddFlow({ mode, onSaved, onDirty }) {
  const [kind, setKind] = useState(null)
  const [sub, setSub] = useState(null) // null = not chosen yet, '' = everything
  const [subName, setSubName] = useState('')
  const [done, setDone] = useState('')
  const { lines, add, patch, remove, clear } = useLines()
  useEffect(() => { onDirty(lines.length > 0) }, [lines.length, onDirty])

  // Tapped tiles get the same details (last price paid) as a scan.
  const pick = async (item) => {
    try {
      add((await api.get('/branch/lookup', { params: { kind, id: item.id } })).data)
    } catch { /* api.js already toasted why */ }
  }
  const scanned = (item) => { if (sub === null) { setSub(''); setSubName('Everything') } add(item) }
  const saved = (text) => { clear(); setDone(text); onSaved() }

  const back = () => {
    if (sub !== null) return setSub(null)
    if (lines.length && !window.confirm('Your list will be cleared. Go back anyway?')) return
    clear(); setKind(null)
  }

  if (done) {
    return (
      <div className="text-center py-5">
        <span className="d-inline-grid rounded-circle bg-success text-white mb-3" style={{ placeItems: 'center', width: 96, height: 96 }}><Icon name="check" size={56} /></span>
        <h2 className="h3">Done!</h2>
        <p className="fs-5 text-secondary">{done}</p>
        <div className="d-grid gap-2 mx-auto" style={{ maxWidth: 320 }}>
          <button className="btn btn-primary btn-lg py-3" onClick={() => { setDone(''); setKind(null); setSub(null) }}>Add more</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {kind && (
        <div className="d-flex align-items-center gap-3 mb-3">
          <button type="button" className="btn btn-outline-secondary btn-lg" onClick={back}><Icon name="left" size={20} /> Back</button>
          <span className="fs-5 fw-semibold">{KIND_LABEL[kind]}{sub !== null && ` › ${subName}`}</span>
        </div>
      )}
      {kind && <ScanBar kind={kind} onFound={scanned} />}
      {!kind && <KindStep onPick={setKind} />}
      {kind && sub === null && <SubStep kind={kind} onPick={(value, label) => { setSub(value); setSubName(label) }} />}
      {kind && sub !== null && (
        <>
          <h2 className="h5 mb-2">{mode === 'delivery' ? 'Tap each item that arrived' : 'Tap each item you are adding'}</h2>
          <ItemTiles kind={kind} sub={sub} counts={Object.fromEntries(lines.map((l) => [l.id, l.qty]))} onPick={pick} />
        </>
      )}
      <ListBar mode={mode} kind={kind} lines={lines} patch={patch} remove={remove} onSaved={saved} />
      {!kind && <p className="text-secondary mt-4">Tip: you can also scan a barcode with the scanner or your phone camera, at any time.</p>}
    </>
  )
}
