import { gbp } from '../../format'

const active = { key: 'active', label: 'Active', render: (r) => <span className={`badge ${r.active ? 'bg-success' : 'bg-secondary'}`}>{r.active ? 'Yes' : 'No'}</span> }
const activeField = { name: 'active', label: 'Active', type: 'checkbox' }

// Export names double as the /admin/<name> route paths.
export const products = {
  title: 'Products', noun: 'Product', url: '/products',
  defaults: { condition: 'New', active: true },
  columns: [
    { key: 'image', label: '', render: (r) => r.image && <img src={r.image} alt="" width="48" height="36" className="object-fit-cover rounded" /> },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'condition', label: 'Condition' },
    { key: 'price', label: 'Price', render: (r) => gbp(r.price) },
    { key: 'stockTotal', label: 'Stock (all branches)' },
    active,
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'brand', label: 'Brand' },
    { name: 'categoryId', label: 'Category', type: 'select', optionsFrom: '/categories', required: true },
    { name: 'price', label: 'Price (£)', type: 'number', required: true },
    { name: 'wasPrice', label: 'Was price (£, optional)', type: 'number' },
    { name: 'condition', label: 'Condition', type: 'choice', choices: ['New', 'Used', 'Refurbished'] },
    { name: 'image', label: 'Image path or URL' },
    { name: 'description', label: 'Description', type: 'textarea' },
    activeField,
  ],
}

export const categories = {
  title: 'Categories', noun: 'Category', url: '/categories', defaults: {},
  columns: [{ key: 'name', label: 'Name' }],
  fields: [{ name: 'name', label: 'Name', required: true }],
}

export const services = {
  title: 'Services', noun: 'Service', url: '/services', defaults: { basePrice: 0, active: true },
  columns: [
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'basePrice', label: 'From', render: (r) => (r.basePrice ? gbp(r.basePrice) : '-') },
    active,
  ],
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'basePrice', label: 'From price (£, 0 = not shown)', type: 'number' },
    activeField,
  ],
}

export const branches = {
  title: 'Branches', noun: 'Branch', url: '/branches', defaults: { active: true },
  columns: [
    { key: 'area', label: 'Area' },
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'phone', label: 'Phone' },
    active,
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'area', label: 'Area', required: true },
    { name: 'address', label: 'Address' },
    { name: 'postcode', label: 'Postcode' },
    { name: 'phone', label: 'Phone' },
    { name: 'lat', label: 'Latitude', type: 'number' },
    { name: 'lng', label: 'Longitude', type: 'number' },
    activeField,
  ],
}
