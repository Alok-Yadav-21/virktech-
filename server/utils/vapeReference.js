import { query } from '../db.js'

// Own sequences, so vape references (VP-ORD-5001, VP-DEL-1001) never share numbering with electronics.
const SEQ = { ORD: ['vape_ord_seq', 'VP-ORD-'], DEL: ['vape_del_seq', 'VP-DEL-'] }

export async function nextVapeReference(key) {
  const [seq, prefix] = SEQ[key] // map lookup only: never interpolate caller input
  const { rows } = await query(`SELECT nextval('${seq}') AS n`)
  return prefix + rows[0].n
}
