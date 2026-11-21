import { useMemo, useState } from 'react'
import { Button, IconButton } from '../../components/Button'
import { EmptyState, InlineAlert, Spinner } from '../../components/Feedback'
import { SearchField, SelectField } from '../../components/Field'
import { FolderTabs } from '../../components/Library'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import useDatos from '../../hooks/useDatos'
import { leerParametros } from '../../services/cuentas'
import { eliminarCarpeta, eliminarDocumento } from '../../services/documentos'
import { plural } from '../../utils/formato'
import Confirmar from '../../overlays/Confirmar'
import EditarDocumento from '../../overlays/EditarDocumento'
import SubirDocumentos from '../../overlays/SubirDocumentos'
import { CarpetaForm } from '../../overlays/Varios'
import { cargarTodo } from './datos'
import { TablaDocumentos } from './Tablas'

const ORDENES = { recientes: ['Más recientes primero', (a, b) => b.creado_en.localeCompare(a.creado_en)],
  antiguos: ['Más antiguos primero', (a, b) => a.creado_en.localeCompare(b.creado_en)],
  nombre: ['Nombre (A–Z)', (a, b) => a.titulo.localeCompare(b.titulo, 'es')] }

// A-10 · Biblioteca de documentos del administrador, con carpetas como pestañas.
export default function Documentos() {
  const { datos, error, recargar } = useDatos(async () => ({ ...(await cargarTodo()), parametros: await leerParametros() }))
  const [carpeta, setCarpeta] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('recientes')
  const [overlay, setOverlay] = useState(null)
  const avisar = useToast()
  const visibles = useMemo(() => datos ? datos.documentos.filter(d => (carpeta === null || d.carpeta?.id === carpeta)
    && d.titulo.toLowerCase().includes(busqueda.toLowerCase())).sort(ORDENES[orden][1]) : [], [datos, carpeta, busqueda, orden])
  if (!datos) return error ? <div className="nx-page"><InlineAlert type="error">{error}</InlineAlert></div> : <Spinner />
  const { documentos, cuentas, carpetas, parametros } = datos
  const conteo = carpetas.map(c => ({ ...c, cantidad: documentos.filter(d => d.carpeta?.id === c.id).length }))
  const actual = carpetas.find(c => c.id === carpeta)
  const editando = overlay?.tipo === 'editar' && documentos.find(d => d.id === overlay.id)
  const cerrar = () => setOverlay(null)

  return <main className="nx-page">
    <div className="nx-page__top">
      <div className="nx-page__title"><h1 className="nx-h1">Documentos</h1>
        <p className="nx-body nx-muted">{plural(documentos.length, 'documento', 'documentos')} en {plural(carpetas.length, 'carpeta', 'carpetas')}</p></div>
      <div className="nx-page__tools">
        <Button variant="secondary" icon="folder-plus" onClick={() => setOverlay({ tipo: 'carpeta' })}>Nueva carpeta</Button>
        <Button icon="upload" onClick={() => setOverlay({ tipo: 'subir' })}>Subir documentos</Button>
      </div>
    </div>
    {(carpetas.length > 0) && <FolderTabs carpetas={conteo} actual={carpeta} onChange={setCarpeta} total={documentos.length}
      extra={actual && <Menu label={'Acciones de la carpeta ' + actual.nombre} items={[
        { label: 'Renombrar carpeta', icon: 'square-pen', onSelect: () => setOverlay({ tipo: 'carpeta', carpeta: actual }) },
        { label: 'Eliminar carpeta', icon: 'trash-2', danger: true, onSelect: () => setOverlay({ tipo: 'borrarCarpeta', carpeta: actual }) }]}
        trigger={p => <IconButton icon="ellipsis" size="sm" label={'Acciones de la carpeta ' + actual.nombre} tooltip={false} {...p} />} />} />}
    <div className="nx-search-row">
      <div className="nx-search-row__search"><SearchField label="Buscar documentos" placeholder="Buscar documentos" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
      <div className="nx-search-row__sort"><SelectField label="Ordenar" hideLabel value={orden} onChange={e => setOrden(e.target.value)}>
        {Object.entries(ORDENES).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</SelectField></div>
    </div>
    {visibles.length ? <TablaDocumentos documentos={visibles} cuentas={cuentas} onEditar={d => setOverlay({ tipo: 'editar', id: d.id })} onEliminar={d => setOverlay({ tipo: 'eliminar', doc: d })} />
      : <div className="nx-card">{busqueda ? <EmptyState icon="search" title={`No encontramos «${busqueda}»`} action={<Button variant="secondary" onClick={() => setBusqueda('')}>Limpiar búsqueda</Button>}>Revisa el nombre del documento o busca en otra carpeta.</EmptyState>
        : <EmptyState icon={actual ? 'folder' : 'file-text'} title={actual ? 'Esta carpeta está vacía' : 'Aún no hay documentos'}
          action={<Button icon="upload" onClick={() => setOverlay({ tipo: 'subir' })}>Subir documentos</Button>}>
          {actual ? 'Sube documentos a esta carpeta o mueve otros desde «Editar».' : 'Sube tu primer PDF para empezar a organizar la biblioteca.'}</EmptyState>}</div>}

    {overlay?.tipo === 'subir' && <SubirDocumentos carpetas={carpetas} cuentas={cuentas} maxMb={parametros.max_mb} carpetaInicial={carpeta || ''}
      onClose={() => { cerrar(); recargar() }} onListo={() => { cerrar(); recargar() }} />}
    {overlay?.tipo === 'carpeta' && <CarpetaForm carpeta={overlay.carpeta} onClose={cerrar}
      onGuardada={c => { cerrar(); avisar(overlay.carpeta ? 'Carpeta renombrada' : 'Carpeta creada', c.nombre); recargar() }} />}
    {overlay?.tipo === 'borrarCarpeta' && <Confirmar titulo={`Eliminar la carpeta «${overlay.carpeta.nombre}»`} confirmar="Eliminar carpeta" onClose={cerrar}
      onConfirm={async () => { await eliminarCarpeta(overlay.carpeta.id); cerrar(); setCarpeta(null); avisar('Carpeta eliminada', 'Sus documentos quedaron sin carpeta.'); recargar() }}>
      Los documentos de esta carpeta no se eliminan: quedan sin carpeta y siguen asignados a los mismos clientes.</Confirmar>}
    {editando && <EditarDocumento documento={editando} carpetas={carpetas} cuentas={cuentas} maxMb={parametros.max_mb} onClose={cerrar}
      onGuardado={({ cerrar: c = true } = {}) => { if (c) { cerrar(); avisar('Documento actualizado') } else avisar('Nueva versión subida', 'La versión anterior se conserva con sus anotaciones.'); recargar() }} />}
    {overlay?.tipo === 'eliminar' && <Confirmar titulo={`Eliminar «${overlay.doc.titulo}»`} confirmar="Eliminar" onClose={cerrar}
      onConfirm={async () => { await eliminarDocumento(overlay.doc.id); cerrar(); avisar('Documento eliminado'); recargar() }}>
      El documento y todas sus versiones se quitarán de la biblioteca de {overlay.doc.cuentas.length === 1 ? 'su cliente asignado' : `los ${overlay.doc.cuentas.length} clientes asignados`}, junto con sus anotaciones. Esta acción no se puede deshacer.
    </Confirmar>}
  </main>
}
