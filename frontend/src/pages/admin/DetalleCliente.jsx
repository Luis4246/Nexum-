import { useState } from 'react'
import { mensaje } from '../../api'
import { Button } from '../../components/Button'
import { Toggle } from '../../components/Choice'
import { EmptyState, InlineAlert, Spinner, StatusTag } from '../../components/Feedback'
import { Avatar, FileTile, FolderTag } from '../../components/Library'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import useDatos from '../../hooks/useDatos'
import { navigate } from '../../router'
import { listarRentas, operarCuenta } from '../../services/cuentas'
import { quitarAsignacion } from '../../services/documentos'
import { fecha, nombreCuenta, plural } from '../../utils/formato'
import { cargarTodo, documentosDe } from './datos'
import { OverlaysCuenta } from './AccionesCuenta'

const AVISOS = {
  pendiente: 'Esta cuenta está pendiente de autorización. El cliente verá «Tu cuenta está pendiente de autorización» al intentar ingresar.',
  suspendida: 'El acceso de esta cuenta está suspendido. El cliente no puede iniciar sesión hasta que lo reactives.',
  deshabilitada: 'Esta cuenta está deshabilitada. Sus documentos y anotaciones se conservan, pero el cliente no puede iniciar sesión.',
}

// A-09 · Detalle de la cuenta de un cliente: información, acceso y documentos asignados.
export default function DetalleCliente({ id }) {
  const { datos, error, recargar } = useDatos(async () => ({ ...(await cargarTodo()), rentas: await listarRentas(id) }), [id])
  const [overlay, setOverlay] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const avisar = useToast()
  if (!datos) return error ? <div className="nx-page"><InlineAlert type="error">{error}</InlineAlert></div> : <Spinner />
  const cuenta = datos.cuentas.find(c => c.id === Number(id))
  if (!cuenta) return <main className="nx-page"><EmptyState icon="users" title="No encontramos esta cuenta"
    action={<Button variant="secondary" onClick={() => navigate('/admin/clientes')}>Ir a Clientes</Button>}>Puede que se haya eliminado.</EmptyState></main>
  const asignados = documentosDe(cuenta.id, datos.documentos)
  const nombre = nombreCuenta(cuenta)

  // El interruptor aplica el cambio al instante, como indica el componente Toggle del diseño.
  async function alternar(activo) {
    setOcupado(true)
    try { await operarCuenta(cuenta.id, activo ? 'reactivar' : 'suspender'); avisar(activo ? 'Acceso reactivado' : 'Acceso suspendido'); await recargar() }
    catch (e) { avisar('No se pudo cambiar el acceso', mensaje(e), 'error') }
    finally { setOcupado(false) }
  }
  async function quitar(doc) {
    try { await quitarAsignacion([cuenta.id], [doc.id]); avisar('Documento quitado', `${doc.titulo} ya no aparece en su biblioteca. Sus anotaciones se conservan.`); recargar() }
    catch (e) { avisar('No se pudo quitar el documento', mensaje(e), 'error') }
  }

  return <main className="nx-page" style={{ gap: 24 }}>
    <Button variant="text" size="sm" icon="chevron-left" className="nx-auth__back" onClick={() => navigate('/admin/clientes')}>Clientes</Button>
    <div className="nx-detail-head">
      <Avatar nombre={nombre} size={64} />
      <div className="nx-detail-head__text">
        <div className="nx-detail-head__name"><h1 className="nx-h1">{nombre}</h1><StatusTag estado={cuenta.estado} /></div>
        <p className="nx-body nx-muted">{cuenta.correo || cuenta.codigo} · Cuenta creada el {fecha(cuenta.creado_en)}</p>
      </div>
      <Button variant="secondary" icon="square-pen" onClick={() => setOverlay({ tipo: 'editar', cuenta })}>Editar datos</Button>
      <Menu label="Más acciones" items={[{ label: 'Generar contraseña nueva', icon: 'lock', onSelect: () => setOverlay({ tipo: 'clave', cuenta }) }, 'divider',
        { label: 'Eliminar cuenta', icon: 'trash-2', danger: true, onSelect: () => setOverlay({ tipo: 'eliminarCuenta', cuenta }) }]}
        trigger={p => <Button variant="text" icon="ellipsis" aria-label="Más acciones" {...p} />} />
    </div>
    {AVISOS[cuenta.estado] && <InlineAlert type="warning">{AVISOS[cuenta.estado]}</InlineAlert>}
    <div className="nx-two-cols">
      <div className="nx-stack" style={{ gap: 24 }}>
        <section className="nx-card">
          <h2 className="nx-h3">Información</h2>
          {[['Nombre', cuenta.nombre || '—'], ['Correo electrónico', cuenta.correo || '—'], ...(cuenta.codigo !== cuenta.correo ? [['Usuario de acceso', cuenta.codigo]] : []),
            ['Documentos asignados', plural(asignados.length, 'documento', 'documentos')], ...(cuenta.autorizada_en ? [['Autorizada el', fecha(cuenta.autorizada_en)]] : [])]
            .map(([k, v]) => <div key={k} className="nx-kv"><span className="nx-caption nx-muted">{k}</span><span className="nx-body-sm">{v}</span></div>)}
        </section>
        <section className="nx-card">
          <h2 className="nx-h3">Acceso</h2>
          {cuenta.estado === 'pendiente' && <><p className="nx-body-sm nx-muted">El cliente aún no puede iniciar sesión. Autoriza la cuenta cuando corresponda.</p>
            <Button icon="lock-open" block onClick={() => setOverlay({ tipo: 'estado', accion: 'autorizar', cuenta })}>Autorizar acceso</Button></>}
          {['habilitada', 'suspendida'].includes(cuenta.estado) && <>
            <Toggle label={cuenta.estado === 'habilitada' ? 'Acceso activo' : 'Acceso suspendido'} checked={cuenta.estado === 'habilitada'} disabled={ocupado} onChange={alternar} />
            <p className="nx-caption nx-muted">{cuenta.estado === 'habilitada' ? 'Desactívalo para bloquear temporalmente el ingreso sin quitar documentos.' : 'Actívalo para que el cliente pueda volver a ingresar.'}</p></>}
          {cuenta.estado === 'deshabilitada' && <><p className="nx-body-sm nx-muted">La cuenta está cerrada. Puedes volver a habilitarla con sus mismos documentos.</p>
            <Button icon="lock-open" block onClick={() => setOverlay({ tipo: 'estado', accion: 'habilitar', cuenta })}>Volver a habilitar</Button></>}
          {cuenta.estado !== 'deshabilitada' && <><div className="nx-rule" />
            <Button variant="danger" size="sm" icon="user-x" style={{ alignSelf: 'flex-start' }} onClick={() => setOverlay({ tipo: 'estado', accion: 'deshabilitar', cuenta })}>Deshabilitar cuenta</Button>
            <p className="nx-caption nx-muted">Cierra la cuenta sin borrar sus documentos ni sus anotaciones. Pide confirmación.</p></>}
        </section>
        {datos.rentas.length > 0 && <section className="nx-card">
          <div className="nx-section-title"><h2 className="nx-h3">Historial de rentas</h2>
            <p className="nx-caption nx-muted">Registro anterior al cambio a cuentas autorizadas. Ya no afecta el acceso.</p></div>
          {datos.rentas.map(r => <div key={r.id} className="nx-kv"><span className="nx-body-sm">{r.nombre} · {fecha(r.inicio)} – {fecha(r.fin)}</span>
            <span className="nx-caption nx-muted">{r.contacto} · {r.estado}</span></div>)}
        </section>}
      </div>
      <section className="nx-card">
        <div className="nx-auth__row"><div className="nx-section-title"><h2 className="nx-h3">Documentos asignados</h2>
          <p className="nx-caption nx-muted">El cliente solo ve estos documentos y puede anotarlos.</p></div>
          <Button size="sm" icon="plus" onClick={() => setOverlay({ tipo: 'asignar', cuenta })}>Asignar documentos</Button></div>
        {asignados.length ? <div className="nx-assigned-list">{asignados.map(d => <div key={d.id} className="nx-assigned">
          <FileTile /><span className="nx-label-strong nx-ellipsis" style={{ flex: 1 }}>{d.titulo}</span>
          {d.carpeta && <FolderTag nombre={d.carpeta.nombre} />}
          <Button variant="text" size="sm" onClick={() => quitar(d)}>Quitar</Button></div>)}</div>
          : <EmptyState title="Sin documentos asignados">Asígnale documentos para que aparezcan en su biblioteca.</EmptyState>}
      </section>
    </div>
    <OverlaysCuenta overlay={overlay} setOverlay={setOverlay} documentos={datos.documentos} carpetas={datos.carpetas}
      alTerminar={(titulo, texto) => { setOverlay(null); avisar(titulo, texto); recargar() }}
      alEliminar={() => { avisar('Cuenta eliminada'); navigate('/admin/clientes') }} />
  </main>
}
