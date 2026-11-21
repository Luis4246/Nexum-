import { operarCuenta } from '../../services/cuentas'
import { nombreCuenta } from '../../utils/formato'
import AsignarDocumentos from '../../overlays/AsignarDocumentos'
import Confirmar from '../../overlays/Confirmar'
import EditarCliente from '../../overlays/EditarCliente'
import { Credenciales } from '../../overlays/Varios'

// Acciones sobre una cuenta, compartidas por la lista (A-08) y el detalle (A-09).
// Cambiar el estado nunca borra documentos, asignaciones ni anotaciones.
export const CAMBIOS = {
  autorizar: { titulo: c => `Autorizar el acceso de ${nombreCuenta(c)}`, boton: 'Autorizar acceso', variante: 'primary', aviso: 'Acceso autorizado',
    texto: 'El cliente podrá iniciar sesión de inmediato con el correo y la contraseña que le entregaste.' },
  suspender: { titulo: c => `Suspender el acceso de ${nombreCuenta(c)}`, boton: 'Suspender', variante: 'primary', aviso: 'Acceso suspendido',
    texto: 'Es un bloqueo temporal: el cliente no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus documentos y anotaciones se conservan y puedes reactivarlo cuando quieras.' },
  reactivar: { titulo: c => `Reactivar el acceso de ${nombreCuenta(c)}`, boton: 'Reactivar acceso', variante: 'primary', aviso: 'Acceso reactivado',
    texto: 'El cliente podrá volver a iniciar sesión con su contraseña actual.' },
  deshabilitar: { titulo: c => `Deshabilitar la cuenta de ${nombreCuenta(c)}`, boton: 'Deshabilitar cuenta', variante: 'danger', aviso: 'Cuenta deshabilitada',
    texto: 'La cuenta quedará cerrada y el cliente no podrá iniciar sesión. Sus documentos asignados y sus anotaciones se conservan; puedes volver a habilitarla si lo necesitas.' },
  habilitar: { titulo: c => `Volver a habilitar la cuenta de ${nombreCuenta(c)}`, boton: 'Habilitar cuenta', variante: 'primary', aviso: 'Cuenta habilitada',
    texto: 'El cliente podrá volver a iniciar sesión y verá los mismos documentos que tenía asignados.' },
}

export function accionesRapidas(c, abrir) {
  const estado = c.estado
  return [
    { label: 'Editar datos', icon: 'square-pen', onSelect: () => abrir({ tipo: 'editar', cuenta: c }) },
    { label: 'Asignar documentos', icon: 'file-text', onSelect: () => abrir({ tipo: 'asignar', cuenta: c }) },
    estado === 'pendiente' && { label: 'Autorizar acceso', icon: 'lock-open', onSelect: () => abrir({ tipo: 'estado', accion: 'autorizar', cuenta: c }) },
    estado === 'habilitada' && { label: 'Suspender acceso', icon: 'lock', onSelect: () => abrir({ tipo: 'estado', accion: 'suspender', cuenta: c }) },
    estado === 'suspendida' && { label: 'Reactivar acceso', icon: 'lock-open', onSelect: () => abrir({ tipo: 'estado', accion: 'reactivar', cuenta: c }) },
    estado === 'deshabilitada' && { label: 'Volver a habilitar', icon: 'lock-open', onSelect: () => abrir({ tipo: 'estado', accion: 'habilitar', cuenta: c }) },
    { label: 'Generar contraseña nueva', icon: 'lock', onSelect: () => abrir({ tipo: 'clave', cuenta: c }) },
    'divider',
    estado !== 'deshabilitada' && { label: 'Deshabilitar cuenta', icon: 'user-x', danger: true, onSelect: () => abrir({ tipo: 'estado', accion: 'deshabilitar', cuenta: c }) },
    { label: 'Eliminar cuenta', icon: 'trash-2', danger: true, onSelect: () => abrir({ tipo: 'eliminarCuenta', cuenta: c }) },
  ]
}

export function OverlaysCuenta({ overlay, setOverlay, documentos, carpetas, alTerminar, alEliminar }) {
  if (!overlay) return null
  const { tipo, cuenta } = overlay
  const cerrar = () => setOverlay(null)
  if (tipo === 'editar') return <EditarCliente cuenta={cuenta} onClose={cerrar}
    onGuardado={(_, clave) => alTerminar('Datos guardados', clave ? 'La contraseña anterior dejó de funcionar.' : '')} />
  if (tipo === 'asignar') return <AsignarDocumentos cuenta={cuenta} documentos={documentos} carpetas={carpetas} onClose={cerrar}
    onGuardado={() => alTerminar('Asignación guardada')} />
  if (tipo === 'estado') {
    const cambio = CAMBIOS[overlay.accion]
    return <Confirmar titulo={cambio.titulo(cuenta)} confirmar={cambio.boton} variante={cambio.variante} onClose={cerrar}
      onConfirm={async () => { await operarCuenta(cuenta.id, overlay.accion); alTerminar(cambio.aviso) }}>{cambio.texto}</Confirmar>
  }
  if (tipo === 'clave') return <Confirmar titulo={`Generar una contraseña nueva para ${nombreCuenta(cuenta)}`} confirmar="Generar contraseña" variante="primary" onClose={cerrar}
    onConfirm={async () => { const { clave } = await operarCuenta(cuenta.id, 'clave'); setOverlay({ tipo: 'credenciales', lista: [{ codigo: cuenta.codigo, clave }] }) }}>
    La contraseña actual dejará de funcionar y se cerrarán las sesiones abiertas del cliente. La nueva se mostrará una sola vez.</Confirmar>
  if (tipo === 'credenciales') return <Credenciales credenciales={overlay.lista} onClose={() => alTerminar('Contraseña actualizada', 'Entrégasela al cliente por un medio seguro.')} />
  if (tipo === 'eliminarCuenta') return <Confirmar titulo={`Eliminar la cuenta de ${nombreCuenta(cuenta)}`} confirmar="Eliminar cuenta" onClose={cerrar}
    onConfirm={async () => { await operarCuenta(cuenta.id, 'eliminar'); alEliminar ? alEliminar() : alTerminar('Cuenta eliminada') }}>
    Se borrarán la cuenta y todas las anotaciones del cliente. Los documentos no se eliminan y el historial de rentas se conserva. Esta acción no se puede deshacer; si solo quieres cortar el acceso, deshabilita la cuenta.</Confirmar>
  return null
}
