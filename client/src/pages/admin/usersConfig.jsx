import { gbp } from '../../format'

const active = { key: 'active', label: 'Active', render: (r) => <span className={`badge ${r.active ? 'bg-success' : 'bg-secondary'}`}>{r.active ? 'Yes' : 'No'}</span> }
const password = { name: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters. When editing, leave blank to keep the current one.' }

// Export names double as the /admin/<name> route paths. "Delete" switches the account off, since
// users are referenced by repairs, orders and points.
export const staff = {
  title: 'Staff', noun: 'Staff member', url: '/users', query: 'role=staff', deleteVerb: 'Deactivate', searchable: true,
  defaults: { role: 'staff', active: true },
  columns: [
    { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'pin', label: 'PIN' },
    { key: 'dailyWage', label: 'Wage / day', render: (r) => (r.dailyWage == null ? '-' : `${gbp(r.dailyWage)}/day`) },
    { key: 'branchName', label: 'Branch' }, active,
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'phone', label: 'Phone' },
    { name: 'pin', label: 'PIN', required: true, hint: '4 digits, different for every staff member. They use it alone to sign in at /staff-login.' },
    { name: 'dailyWage', label: 'Daily wage (£ per day worked)', type: 'number', hint: 'Paid once for every day they work, however many hours.' },
    { name: 'branchId', label: 'Branch', type: 'select', optionsFrom: '/branches', optionLabel: 'area', required: true },
    { name: 'active', label: 'Active', type: 'checkbox' },
  ],
}

export const customers = {
  title: 'Customers', noun: 'Customer', url: '/users', query: 'role=customer', deleteVerb: 'Deactivate', searchable: true,
  defaults: { role: 'customer', active: true },
  columns: [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
    { key: 'loyaltyPoints', label: 'Points' }, active,
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'email', label: 'Email', required: true },
    { name: 'phone', label: 'Phone' },
    password,
    { name: 'active', label: 'Active', type: 'checkbox' },
  ],
}
