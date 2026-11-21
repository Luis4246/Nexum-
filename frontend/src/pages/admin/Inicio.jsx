import { useState } from 'react'
import Icon from '../../components/Icon'
import { Button } from '../../components/Button'
import { Dropzone } from '../../components/Carga'
import { EmptyState, InlineAlert, Spinner } from '../../components/Feedback'
import { useToast } from '../../components/Toast'
import useDatos from '../../hooks/useDatos'
import { navigate } from '../../router'
import { leerParametros } from '../../services/cuentas'
import { eliminarDocumento } from '../../services/documentos'
import Confirmar from '../../overlays/Confirmar'
import CrearCuenta from '../../overlays/CrearCuenta'
import EditarDocumento from '../../overlays/EditarDocumento'
import SubirDocumentos from '../../overlays/SubirDocumentos'
import { cargarTodo } from './datos'
import { TablaClientes, TablaDocumentos } from './Tablas'
import { accionesRapidas, OverlaysCuenta } from './AccionesCuenta'

// A-05 · Inicio del administrador: subir documentos, crear cuentas y lo más reciente de cada lista.
export default function Inicio() {
  const { datos, error, recargar } = useDatos(async () => ({ ...(await cargarTodo()), parametros: await leerParametros() }))
  const [overlay, setOverlay] = useState(null)
  const avisar = useToast()
  if (!datos) return error ? <div className="nx-page"><InlineAlert type="error">{error}</InlineAlert></div> : <Spinner />
  const { documentos, cuentas, carpetas, parametros } = datos
  const recientes = [...documentos].sort((a, b) => b.creado_en.localeCompare(a.creado_en)).slice(0, 4)
  const editando = overlay?.tipo === 'editar' && documentos.find(d => d.id === overlay.id)
  const cerrar = () => setOverlay(null)

  return <main className="nx-page" style={{ gap: 40 }}>
    <div className="nx-page__title"><h1 className="nx-h1">Inicio</h1><p className="nx-body nx-muted">Sube documentos y crea cuentas para tus clientes.</p></div>
    <div className="nx-home-actions">
      <section className="nx-card nx-card--grow">
        <div className="nx-auth__row"><div className="nx-section-title"><h2 className="nx-h3">Subir documentos</h2>
          <p className="nx-body-sm nx-muted">Arrastra tus PDF o selecciónalos desde tu equipo. Luego eliges carpeta y clientes.</p></div>
          <Button icon="upload" onClick={() => setOverlay({ tipo: 'subir', archivos: [] })}>Subir documentos</Button></div>
        <Dropzone maxMb={parametros.max_mb} onFiles={archivos => setOverlay({ tipo: 'subir', archivos })} />
      </section>
      <section className="nx-card nx-card--side">
        <span className="nx-feature__icon"><Icon name="user-plus" size={24} /></span>
        <h2 className="nx-h3">Crear nueva cuenta</h2>
        <p className="nx-body-sm nx-muted">Define el correo y la contraseña del cliente, su estado de acceso y los documentos que verá.</p>
        <span style={{ flex: 1 }} />
        <Button icon="user-plus" block onClick={() => setOverlay({ tipo: 'crear' })}>Crear cuenta</Button>
      </section>
    </div>
    <section className="nx-stack">
      <div className="nx-auth__row"><h2 className="nx-h2">Documentos cargados</h2>{documentos.length > 0 && <Button variant="text" size="sm" onClick={() => navigate('/admin/documentos')}>Ver biblioteca</Button>}</div>
      {documentos.length ? <TablaDocumentos documentos={recientes} cuentas={cuentas}
        onEditar={d => setOverlay({ tipo: 'editar', id: d.id })} onEliminar={d => setOverlay({ tipo: 'eliminar', doc: d })} />
        : <div className="nx-card"><EmptyState title="Aún no hay documentos">Sube tu primer PDF arrastrándolo a la zona de carga.</EmptyState></div>}
    </section>
    <section className="nx-stack">
      <div className="nx-auth__row"><h2 className="nx-h2">Cuentas de clientes</h2>{cuentas.length > 0 && <Button variant="text" size="sm" onClick={() => navigate('/admin/clientes')}>Ver todas</Button>}</div>
      {cuentas.length ? <TablaClientes cuentas={cuentas.slice(0, 4)} documentos={documentos} onGestionar={c => navigate('/admin/clientes/' + c.id)} acciones={c => accionesRapidas(c, setOverlay)} />
        : <div className="nx-card"><EmptyState icon="users" title="Aún no hay clientes" action={<Button onClick={() => setOverlay({ tipo: 'crear' })}>Crear la primera cuenta</Button>}>Crea la primera cuenta para darle acceso a un cliente.</EmptyState></div>}
    </section>

    {overlay?.tipo === 'subir' && <SubirDocumentos iniciales={overlay.archivos} carpetas={carpetas} cuentas={cuentas} maxMb={parametros.max_mb}
      onClose={() => { cerrar(); recargar() }} onListo={() => { cerrar(); navigate('/admin/documentos') }} />}
    {overlay?.tipo === 'crear' && <CrearCuenta onClose={() => { cerrar(); recargar() }} onCreada={c => navigate('/admin/clientes/' + c.id)} />}
    {editando && <EditarDocumento documento={editando} carpetas={carpetas} cuentas={cuentas} maxMb={parametros.max_mb} onClose={cerrar}
      onGuardado={({ cerrar: c = true } = {}) => { if (c) { cerrar(); avisar('Documento actualizado') } else avisar('Nueva versión subida', 'La versión anterior se conserva con sus anotaciones.'); recargar() }} />}
    {overlay?.tipo === 'eliminar' && <Confirmar titulo={`Eliminar «${overlay.doc.titulo}»`} confirmar="Eliminar" onClose={cerrar}
      onConfirm={async () => { await eliminarDocumento(overlay.doc.id); cerrar(); avisar('Documento eliminado'); recargar() }}>
      El documento y todas sus versiones se quitarán de la biblioteca de {overlay.doc.cuentas.length === 1 ? 'su cliente asignado' : `los ${overlay.doc.cuentas.length} clientes asignados`}, junto con sus anotaciones. Esta acción no se puede deshacer.
    </Confirmar>}
    <OverlaysCuenta overlay={overlay} setOverlay={setOverlay} documentos={documentos} carpetas={carpetas}
      alTerminar={(titulo, texto) => { cerrar(); avisar(titulo, texto); recargar() }} />
  </main>
}
