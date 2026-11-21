import { useEffect, useState } from 'react'

// Enrutador mínimo basado en el hash (#/admin/clientes/12?x=1). Permite usar Atrás y compartir direcciones
// sin agregar una dependencia.
function leer() {
  const [ruta, consulta = ''] = (location.hash.replace(/^#/, '') || '/').split('?')
  return { path: ruta || '/', query: Object.fromEntries(new URLSearchParams(consulta)) }
}

export function navigate(path, { replace = false } = {}) {
  const destino = '#' + path
  if (replace) history.replaceState(null, '', destino)
  else if (location.hash !== destino) history.pushState(null, '', destino)
  window.dispatchEvent(new Event('nx-ruta'))
}

export function useRoute() {
  const [ruta, setRuta] = useState(leer)
  useEffect(() => {
    const actualizar = () => setRuta(leer())
    window.addEventListener('popstate', actualizar)
    window.addEventListener('hashchange', actualizar)
    window.addEventListener('nx-ruta', actualizar)
    return () => {
      window.removeEventListener('popstate', actualizar)
      window.removeEventListener('hashchange', actualizar)
      window.removeEventListener('nx-ruta', actualizar)
    }
  }, [])
  return ruta
}

// Compara una ruta con un patrón como '/admin/clientes/:id' y devuelve sus parámetros o null.
export function match(patron, path) {
  const a = patron.split('/'), b = path.split('/')
  if (a.length !== b.length) return null
  const params = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}
