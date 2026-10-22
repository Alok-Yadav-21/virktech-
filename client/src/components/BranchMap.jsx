import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Loaded on demand (React.lazy) so the map library only costs bytes on the branches page.
export default function BranchMap({ branches, origin, selectedId, onSelect }) {
  const withCoords = branches.filter((b) => b.lat != null && b.lng != null)
  const centre = origin || (withCoords[0] ? { lat: withCoords[0].lat, lng: withCoords[0].lng } : { lat: 51.47, lng: 0.1 })
  return (
    // key re-mounts the map when the centre moves; MapContainer ignores prop changes
    <MapContainer key={`${centre.lat},${centre.lng}`} center={[centre.lat, centre.lng]} zoom={origin ? 13 : 11} scrollWheelZoom={false} style={{ height: '100%', minHeight: 280, borderRadius: 'inherit' }}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {origin && <CircleMarker center={[origin.lat, origin.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#091a11', fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker>}
      {withCoords.map((b) => (
        <CircleMarker
          key={b.id} center={[b.lat, b.lng]} radius={b.id === selectedId ? 13 : 10}
          pathOptions={{ color: '#fff', weight: 3, fillColor: b.id === selectedId ? '#005e35' : '#007847', fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect?.(b.id) }}
        >
          <Popup><strong>{b.area}</strong><br />{b.address}, {b.postcode}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
