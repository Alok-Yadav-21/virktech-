// The branch this computer or phone is used at, remembered in the browser so staff are asked once, not at every PIN.
// Only a convenience: the server still records the branch and IP of each sign-in, and still validates the branch.
const KEY = 'vt_device_branch'

export const getDeviceBranch = () => {
  try {
    const b = JSON.parse(localStorage.getItem(KEY))
    return b && Number.isInteger(b.id) && typeof b.name === 'string' ? b : null
  } catch { return null } // storage blocked or unreadable: behave as if nothing is remembered
}
export const saveDeviceBranch = (b) => { try { localStorage.setItem(KEY, JSON.stringify({ id: b.id, name: b.name })) } catch { /* private mode: asked again next time */ } }
export const clearDeviceBranch = () => { try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ } }
