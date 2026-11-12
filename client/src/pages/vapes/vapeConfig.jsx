import { gbp } from '../../format'
import { FLAVOUR_GROUPS, VAPE_KINDS, nicotineLabel } from '../../vapeConstants'

// Admin CRUD for the vape catalogue, driven through the same generic CrudPage as the electronics catalogue.
// Export names double as the /admin/vapes/<name> route paths.
const active = { key: 'active', label: 'Active', render: (r) => <span className={`badge ${r.active ? 'bg-success' : 'bg-secondary'}`}>{r.active ? 'Yes' : 'No'}</span> }
const activeField = { name: 'active', label: 'Active', type: 'checkbox' }

export const products = {
  title: 'Vape products', noun: 'Vape product', url: '/vapes/products',
  defaults: { kind: 'E-liquid', flavourGroup: 'Unflavoured', nicotineMg: 0, active: true },
  columns: [
    { key: 'image', label: '', render: (r) => r.image && <img src={r.image} alt="" width="48" height="36" className="object-fit-cover rounded" /> },
    { key: 'name', label: 'Product', render: (r) => <>{r.name}<span className="d-block small text-secondary">{r.brand}{r.flavour ? ` · ${r.flavour}` : ''}</span></> },
    { key: 'barcode', label: 'Barcode', render: (r) => r.barcode && <span className="font-monospace">{r.barcode}</span> },
    { key: 'kind', label: 'Type' },
    { key: 'nicotineMg', label: 'Nicotine', render: (r) => nicotineLabel(r.nicotineMg) },
    { key: 'price', label: 'Price', render: (r) => gbp(r.price) },
    { key: 'costPrice', label: 'Bought for', render: (r) => (r.costPrice == null ? <span className="badge bg-danger">Missing</span> : gbp(r.costPrice)) },
    { key: 'stockTotal', label: 'Stock (all branches)' },
    active,
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'brandId', label: 'Brand', type: 'select', optionsFrom: '/vapes/brands', required: true, hint: 'Add brands under Vape brands first.' },
    { name: 'kind', label: 'Type', type: 'choice', choices: VAPE_KINDS },
    { name: 'flavour', label: 'Flavour (e.g. Blue razz lemonade)' },
    { name: 'flavourGroup', label: 'Flavour type', type: 'choice', choices: FLAVOUR_GROUPS },
    { name: 'nicotineMg', label: 'Nicotine strength (mg/ml, 0 to 20)', type: 'number', required: true },
    { name: 'sizeMl', label: 'Size (ml, optional)', type: 'number' },
    { name: 'price', label: 'Price (£)', type: 'number', required: true },
    { name: 'wasPrice', label: 'Was price (£, optional)', type: 'number' },
    { name: 'costPrice', label: 'Bought for (£, per item)', type: 'number', required: true, hint: 'Needed so profit is counted. A recorded delivery takes over once there is one for this product.' },
    { name: 'barcode', label: 'Barcode / QR text (optional)', hint: 'The text under the barcode or inside the QR code. Optional: staff can also link it at the till by scanning.' },
    { name: 'image', label: 'Image path or URL' },
    { name: 'description', label: 'Description', type: 'textarea' },
    activeField,
  ],
}

export const brands = {
  title: 'Vape brands', noun: 'Brand', url: '/vapes/brands', defaults: { active: true },
  columns: [{ key: 'name', label: 'Brand' }, active],
  fields: [{ name: 'name', label: 'Brand name', required: true }, activeField],
}
