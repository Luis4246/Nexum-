// Formatos en español de Chile, como en el diseño: «12 nov 2026», «2,4 MB».
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

export function fecha(valor) {
  if (!valor) return ''
  const d = new Date(valor)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export function tamano(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function iniciales(nombre = '') {
  const partes = nombre.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || partes[0]?.[1] || '')).toUpperCase() || '··'
}

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}

// Nombre para mostrar de una cuenta: su nombre si lo tiene; si no, su usuario de acceso.
export const nombreCuenta = c => c?.nombre || c?.codigo || ''
