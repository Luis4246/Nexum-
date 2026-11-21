import { api, authApi, guardarSesion, sesion, terminar } from '../api'

// Inicia sesión. Si el backend niega el acceso, devuelve { denegado: motivo, mensaje } en vez de lanzar error,
// porque la cuenta pendiente tiene su propia pantalla (G-04).
export async function iniciarSesion(usuario, clave, recordar) {
  try {
    const { data } = await api.post('auth/login/', { username: usuario, password: clave })
    guardarSesion(data, recordar)
    return { sesion: data }
  } catch (e) {
    const datos = e.response?.data
    if (e.response?.status === 403 && datos?.motivo) return { denegado: datos.motivo, mensaje: datos.detail }
    throw e
  }
}

export async function cerrarSesion() {
  const actual = sesion()
  try { if (actual) await authApi.post('auth/salir/', { refresh: actual.refresh }, { headers: { Authorization: 'Bearer ' + actual.access } }) }
  finally { terminar() }
}
