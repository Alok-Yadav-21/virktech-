import { query } from '../db.js'

// Postgres sequences are atomic, so no counter table is needed.
const SEQ = { SPR: ['spr_seq', 'SPR-'], ORD: ['ord_seq', 'VT-ORD-'], TI: ['ti_seq', 'VT-TI-'], DEL: ['del_seq', 'VT-DEL-'] }

export async function nextReference(key) {
  const [seq, prefix] = SEQ[key] // map lookup only: never interpolate caller input
  const { rows } = await query(`SELECT nextval('${seq}') AS n`)
  return prefix + rows[0].n
}
