import { api } from '../api'

export const listarCuentas = () => api.get('cuentas/').then(r => r.data)
export const crearCuenta = datos => api.post('cuentas/', datos).then(r => r.data[0])
export const crearCuentasEnLote = cantidad => api.post('cuentas/', { cantidad }).then(r => r.data)
export const editarCuenta = (id, datos) => api.patch(`cuentas/${id}/`, datos).then(r => r.data)
// acción: autorizar, habilitar, reactivar, suspender, deshabilitar, clave, eliminar
export const operarCuenta = (id, accion, datos = {}) => api.post(`cuentas/${id}/${accion}/`, datos).then(r => r.data)
export const listarRentas = cuenta => api.get('rentas/', { params: cuenta ? { cuenta } : {} }).then(r => r.data)
export const leerParametros = () => api.get('parametros/').then(r => r.data)
export const guardarParametros = datos => api.put('parametros/', datos).then(r => r.data)
export const leerAuditoria = antes => api.get('auditoria/', { params: antes ? { antes } : {} }).then(r => r.data)
