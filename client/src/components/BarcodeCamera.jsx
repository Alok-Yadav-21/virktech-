import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'

// Camera scanning uses the browser's built-in BarcodeDetector (Chrome, Edge, Android). Elsewhere the camera button is
// hidden and a USB/Bluetooth scanner, which just types the code and presses Enter, still works.
export const cameraScanSupported = () => 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

// Stays open so a whole box can be scanned. A code that stays in view is counted once; it counts again after it has
// been out of view for 1.5 seconds.
export default function BarcodeCamera({ onScan, onHide }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  const handler = useRef(onScan)
  handler.current = onScan

  useEffect(() => {
    let stream
    let timer
    let stopped = false
    let last = { code: '', seen: 0 }
    const start = async () => {
      try {
        const detector = new window.BarcodeDetector() // no format list = every format this device can read, QR included
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        video.current.srcObject = stream
        await video.current.play()
        timer = setInterval(async () => {
          try {
            const code = (await detector.detect(video.current))[0]?.rawValue
            if (!code) return
            const now = Date.now()
            const repeat = code === last.code && now - last.seen < 1500
            last = { code, seen: now }
            if (!repeat) handler.current(code)
          } catch { /* a frame that cannot be read is simply skipped */ }
        }, 250)
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'The camera is blocked. Allow camera access for this site and try again.' : 'Could not start the camera on this device.')
      }
    }
    start()
    return () => { stopped = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton><Modal.Title>Scan with the camera</Modal.Title></Modal.Header>
      <Modal.Body>
        {error ? <div className="alert alert-danger mb-0">{error}</div> : (
          <>
            <video ref={video} className="w-100 rounded bg-dark" style={{ maxHeight: '55vh', objectFit: 'cover' }} playsInline muted />
            <p className="small text-secondary mt-2 mb-0">Hold a barcode or QR code in view. Each code is added as it is read.</p>
          </>
        )}
      </Modal.Body>
      <Modal.Footer><button className="btn btn-primary" onClick={onHide}>Done</button></Modal.Footer>
    </Modal>
  )
}
