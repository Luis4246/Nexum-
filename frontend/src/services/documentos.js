import { api } from '../api'

export const listarDocumentos = () => api.get('documentos/').then(r => r.data)
export const listarVersiones = id => api.get(`documentos/${id}/versiones/`).then(r => r.data)
export const editarDocumento = (id, datos) => api.patch(`documentos/${id}/`, datos).then(r => r.data)
export const eliminarDocumento = id => api.delete(`documentos/${id}/`)

// Sube un archivo por petición para informar el avance y el error de cada uno, como en el diseño.
export function subirDocumento(archivo, { carpeta, alAvanzar } = {}) {
  const datos = new FormData()
  datos.append('archivos', archivo)
  if (carpeta) datos.append('carpeta', carpeta)
  return api.post('documentos/', datos, { onUploadProgress: e => alAvanzar?.(e.total ? e.loaded / e.total : 0) }).then(r => r.data[0])
}

export function reemplazarDocumento(id, archivo, alAvanzar) {
  const datos = new FormData()
  datos.append('archivos', archivo)
  return api.put(`documentos/${id}/`, datos, { onUploadProgress: e => alAvanzar?.(e.total ? e.loaded / e.total : 0) }).then(r => r.data[0])
}

export const asignar = (cuentas, documentos) => api.post('asignaciones/', { cuentas, documentos })
export const quitarAsignacion = (cuentas, documentos) => api.delete('asignaciones/', { data: { cuentas, documentos } })

export const listarCarpetas = () => api.get('carpetas/').then(r => r.data)
export const crearCarpeta = nombre => api.post('carpetas/', { nombre }).then(r => r.data)
export const renombrarCarpeta = (id, nombre) => api.patch(`carpetas/${id}/`, { nombre }).then(r => r.data)
export const eliminarCarpeta = id => api.delete(`carpetas/${id}/`)
