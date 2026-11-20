import { gbp } from '../../format'
import { STAFF_ROLES } from '../../constants'

const active = { key: 'active', label: 'Active', render: (r) => <span className={`badge ${r.active ? 'bg-success' : 'bg-secondary'}`}>{r.active ? 'Yes' : 'No'}</span> }
const password = { name: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters. When editing, leave blank to keep the current one.' }

// Export names double as the /admin/<name> route paths. "Delete" switches the account off, since
// users are referenced by repairs, orders and points.
export const staff = {
  title: 'Staff', noun: 'Staff member', url: '/users', query: 'role=staff&active=1', deleteVerb: 'Delete', searchable: true,
  defaults: { role: 'staff', active: true },
  columns: [
    { key: 'name', label: 'Name' }, { key: 'staffRole', label: 'Role', render: (r) => r.staffRole || '-' }, { key: 'phone', label: 'Phone' }, { key: 'pin', label: 'PIN' },
    { key: 'dailyWage', label: 'Wage / day', render: (r) => (r.dailyWage == null ? '-' : `${gbp(r.dailyWage)}/day`) },
    // Where they signed in last: the branch whose saved IP matched, and the IP itself. An IP no branch has saved still signs in, with no branch.
    { key: 'branchName', label: 'Signed in at', render: (r) => r.branchName || (r.lastLoginAt ? 'No branch (IP not saved)' : 'Not signed in yet') },
    { key: 'lastLoginAt', label: 'Last sign-in', render: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString('en-GB') : '-') },
    // Whether that sign-in is still live (one at a time: see utils/login.js on the server).
    { key: 'lastIp', label: 'Signed in from (IP)', render: (r) => r.lastIp || '-' },
    { key: 'signedIn', label: 'Signed in now', render: (r) => <span className={`badge ${r.signedIn ? 'bg-success' : 'bg-secondary'}`}>{r.signedIn ? 'Yes' : 'No'}</span> },
    active,
  ],
  // Ends their live sign-in on every device: for someone who closed the browser without logging out.
  rowActions: [{
    label: 'Sign out', show: (r) => r.signedIn, path: (r) => `/users/${r.id}/sign-out`, done: 'Signed out',
    confirm: (r) => `Sign ${r.name} out everywhere? They can sign in again straight away.`,
  }],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'staffRole', label: 'Role', type: 'choice', choices: ['', ...STAFF_ROLES], hint: 'What they do in the shop, so you can tell staff apart.' },
    { name: 'phone', label: 'Phone' },
    { name: 'pin', label: 'PIN', required: true, hint: '6 digits, different for every staff member. They use it alone to sign in at /staff-login.' },
    { name: 'dailyWage', label: 'Daily wage (£ per day worked)', type: 'number', hint: 'Paid once for every day they work, however many hours.' },
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
