import { listarCarpetas, listarDocumentos } from '../../services/documentos'
import { listarCuentas } from '../../services/cuentas'
import { nombreCuenta } from '../../utils/formato'

// Datos que comparten las pantallas del administrador.
export async function cargarTodo() {
  const [documentos, cuentas, carpetas] = await Promise.all([listarDocumentos(), listarCuentas(), listarCarpetas()])
  return { documentos, cuentas, carpetas }
}

// «María G., Jorge P. +1», «6 clientes» o «Sin asignar», como en la tabla del diseño.
export function asignadosTexto(ids, cuentas) {
  if (!ids.length) return 'Sin asignar'
  if (ids.length > 3) return `${ids.length} clientes`
  const corto = c => { const [a, b] = nombreCuenta(c).split(/\s+/); return b ? `${a} ${b[0]}.` : a }
  const nombres = ids.map(id => cuentas.find(c => c.id === id)).filter(Boolean).map(corto)
  return nombres.length === 3 ? `${nombres[0]}, ${nombres[1]} +1` : nombres.join(', ')
}

export const documentosDe = (cuentaId, documentos) => documentos.filter(d => d.cuentas.includes(cuentaId))
