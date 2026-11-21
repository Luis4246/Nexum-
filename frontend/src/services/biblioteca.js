import { api } from '../api'

export const miBiblioteca = () => api.get('biblioteca/').then(r => r.data)

// El PDF llega como datos binarios autenticados; nunca como enlace de descarga.
export const contenido = (id, version) =>
  api.get(`biblioteca/${id}/contenido/`, { responseType: 'arraybuffer', params: version ? { version } : {} }).then(r => r.data)

export const anotaciones = (id, version) =>
  api.get(`biblioteca/${id}/destacados/`, { params: { version } }).then(r => r.data)

// Guardado del editor: crea y elimina en una sola operación; si algo falla, no se aplica nada.
export const guardarAnotaciones = (id, version, crear, eliminar) =>
  api.post(`biblioteca/${id}/destacados/lote/`, { version_documento: version, crear, eliminar }).then(r => r.data)
