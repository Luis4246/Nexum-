import { useState } from 'react'
import { mensaje } from '../../api'
import { Button } from '../../components/Button'
import { InlineAlert, Spinner } from '../../components/Feedback'
import { TextField } from '../../components/Field'
import { useToast } from '../../components/Toast'
import useDatos from '../../hooks/useDatos'
import { guardarParametros, leerAuditoria, leerParametros } from '../../services/cuentas'

// Funciones existentes del backend sin pantalla en Figma: parámetros y registro de actividad.
// Se presentan con los mismos componentes del diseño.
const ACCIONES = {
  login: 'Inicio de sesión', logout: 'Cierre de sesión', 'login.fallido': 'Intento fallido de inicio de sesión', 'login.denegado': 'Acceso denegado',
  'cuenta.crear': 'Cuenta creada', 'cuenta.editar': 'Datos de cuenta editados', 'cuenta.autorizar': 'Cuenta autorizada', 'cuenta.habilitar': 'Cuenta habilitada',
  'cuenta.reactivar': 'Acceso reactivado', 'cuenta.suspender': 'Acceso suspendido', 'cuenta.deshabilitar': 'Cuenta deshabilitada', 'cuenta.clave': 'Contraseña restablecida',
  'cuenta.eliminar': 'Cuenta eliminada', 'documento.subir': 'Documento subido', 'documento.reemplazar': 'Nueva versión de documento', 'documento.editar': 'Documento editado',
  'documento.eliminar': 'Documento eliminado', 'documento.abrir': 'Documento abierto', 'documentos.asignar': 'Documentos asignados', 'documentos.quitar': 'Asignación quitada',
  'carpeta.crear': 'Carpeta creada', 'carpeta.editar': 'Carpeta renombrada', 'carpeta.eliminar': 'Carpeta eliminada', 'anotaciones.guardar': 'Anotaciones guardadas',
  'parametros.actualizar': 'Parámetros actualizados',
}

export default function Configuracion() {
  const { datos: parametros } = useDatos(leerParametros)
  const { datos: primeros, error } = useDatos(() => leerAuditoria())
  const [mas, setMas] = useState([])
  const [fin, setFin] = useState(false)
  const [max, setMax] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorMax, setErrorMax] = useState('')
  const avisar = useToast()
  const eventos = [...(primeros || []), ...mas]
  const valor = max ?? parametros?.max_mb ?? ''

  async function guardar(e) {
    e.preventDefault()
    const n = Number(valor)
    if (!Number.isInteger(n) || n < 1 || n > 1024) return setErrorMax('Indica un número entero entre 1 y 1024.')
    setOcupado(true); setErrorMax('')
    try { await guardarParametros({ max_mb: n, retencion: parametros.retencion }); avisar('Límite actualizado', `Cada PDF puede pesar hasta ${n} MB.`) }
    catch (err) { setErrorMax(mensaje(err)) } finally { setOcupado(false) }
  }
  async function anteriores() {
    const lote = await leerAuditoria(eventos.at(-1).id)
    setMas(m => [...m, ...lote]); if (lote.length < 100) setFin(true)
  }

  return <main className="nx-page">
    <div className="nx-page__title"><h1 className="nx-h1">Configuración</h1><p className="nx-body nx-muted">Parámetros de la plataforma y registro de actividad.</p></div>
    <form className="nx-card" style={{ maxWidth: 560 }} onSubmit={guardar} noValidate>
      <h2 className="nx-h3">Documentos</h2>
      {parametros ? <TextField label="Tamaño máximo por PDF (MB)" type="number" min="1" max="1024" value={valor} onChange={e => setMax(e.target.value)} error={errorMax}
        help="Se aplica a cada archivo al subirlo o al reemplazar una versión." /> : <Spinner />}
      <Button type="submit" loading={ocupado} style={{ alignSelf: 'flex-start' }}>Guardar</Button>
    </form>
    <section className="nx-stack">
      <h2 className="nx-h2">Registro de actividad</h2>
      {error && <InlineAlert type="error">{error}</InlineAlert>}
      {!primeros ? <Spinner /> : <div className="nx-table">
        <div className="nx-event nx-table__row--head" style={{ minHeight: 40, alignItems: 'center' }}><span>Fecha</span><span>Usuario</span><span>Acción</span></div>
        {eventos.map(ev => <div key={ev.id} className="nx-event">
          <span className="nx-body-sm nx-muted">{new Date(ev.creado_en).toLocaleString('es-CL')}</span>
          <span className="nx-body-sm nx-ellipsis">{ev.actor}</span>
          <span className="nx-body-sm">{ACCIONES[ev.accion] || ev.accion}{ev.detalle?.motivo ? ` (${ev.detalle.motivo})` : ''}</span></div>)}
        {!eventos.length && <p className="nx-body-sm nx-muted" style={{ padding: 20 }}>Aún no hay actividad registrada.</p>}
      </div>}
      {primeros?.length >= 100 && !fin && <Button variant="secondary" style={{ alignSelf: 'flex-start' }} onClick={anteriores}>Ver actividad anterior</Button>}
    </section>
  </main>
}
