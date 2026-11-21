import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api/'
export const authApi = axios.create({ baseURL })
export const api = axios.create({ baseURL })
// La sesión vive en sessionStorage (se borra al cerrar el navegador) salvo que el usuario marque
// «Recordar sesión», que la guarda en localStorage.
const almacen = () => localStorage.getItem('sesion') ? localStorage : sessionStorage
export const sesion = () => JSON.parse(sessionStorage.getItem('sesion') || localStorage.getItem('sesion') || 'null')
export function guardarSesion(datos, recordar) {
  const destino = recordar === undefined ? almacen() : recordar ? localStorage : sessionStorage
  sessionStorage.removeItem('sesion'); localStorage.removeItem('sesion')
  destino.setItem('sesion', JSON.stringify(datos))
}
export function terminar() {
  sessionStorage.removeItem('sesion')
  localStorage.removeItem('sesion')
  window.dispatchEvent(new Event('salir'))
}
api.interceptors.request.use(config => {
  const actual = sesion()
  if (actual) config.headers.Authorization = 'Bearer ' + actual.access
  return config
})
let renovando
api.interceptors.response.use(res => res, async error => {
  const config = error.config
  const actual = sesion()
  if (!actual || error.response?.status !== 401 || config.reintento || config.url === 'auth/login/') throw error
  config.reintento = true
  try {
    renovando ??= authApi.post('auth/refrescar/', { refresh: actual.refresh }).finally(() => { renovando = null })
    const { data } = await renovando
    if (sesion()?.refresh !== actual.refresh) throw error
    guardarSesion({ ...actual, access: data.access })
    return api(config)
  } catch (fallo) {
    if (sesion()?.refresh === actual.refresh) terminar()
    throw fallo
  }
})
export function mensaje(error) {
  const data = error.response?.data
  if (!data) return error.message
  if (data.detail) return data.detail
  return Object.values(data).flat().join(' · ')
}

