import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../../api'
import BarcodeCamera, { cameraScanSupported } from '../../components/BarcodeCamera'
import Icon from '../../components/ui/Icon'
import LinkCode from './LinkCode'

const LABEL = { electronics: 'electronics', vape: 'a vape product' }

// One scan box for the stock screens. A USB/Bluetooth scanner types the code and presses Enter; the camera button does
// the same from a phone. A known code calls onFound(item); an unknown one opens the "link this code" list.
export default function ScanBar({ kind, onFound }) {
  const [text, setText] = useState('')
  const [camera, setCamera] = useState(false)
  const [unknown, setUnknown] = useState(null)
  const input = useRef(null)

  const scan = async (raw) => {
    const code = raw.trim()
    if (!code) return
    try {
      const { data: item } = await api.get('/branch/lookup', { params: { code }, quiet: true })
      if (item.kind !== kind) toast.error(`That is ${LABEL[item.kind]}. Switch category to add it.`)
      else onFound(item)
    } catch (e) {
      if (e.response?.status === 404) setUnknown(code)
      else toast.error(errMsg(e))
    }
  }
  const submit = (e) => {
    e.preventDefault()
    scan(text)
    setText('')
    input.current?.focus()
  }

  return (
    <>
      <form className="d-flex gap-2 mb-3" onSubmit={submit}>
        <input ref={input} className="form-control form-control-lg" placeholder="Scan a barcode or QR code" aria-label="Scan a code" autoFocus
          autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        {cameraScanSupported() && (
          <button type="button" className="btn btn-outline-primary btn-lg" onClick={() => setCamera(true)} aria-label="Scan with the camera"><Icon name="camera" size={22} /></button>
        )}
      </form>
      {camera && <BarcodeCamera onScan={scan} onHide={() => setCamera(false)} />}
      {unknown && <LinkCode code={unknown} kind={kind} onHide={() => setUnknown(null)} onLinked={(item) => { setUnknown(null); toast.success(`Code linked to ${item.name}`); onFound(item) }} />}
    </>
  )
}
