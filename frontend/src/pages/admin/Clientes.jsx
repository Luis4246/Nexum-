import { useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { EmptyState, ESTADOS, InlineAlert, Spinner } from '../../components/Feedback'
import { SearchField } from '../../components/Field'
import { useToast } from '../../components/Toast'
import useDatos from '../../hooks/useDatos'
import { navigate } from '../../router'
import CrearCuenta from '../../overlays/CrearCuenta'
import { Credenciales, CrearLote } from '../../overlays/Varios'
import { nombreCuenta, plural } from '../../utils/formato'
import { cargarTodo } from './datos'
import { accionesRapidas, OverlaysCuenta } from './AccionesCuenta'
import { TablaClientes } from './Tablas'

const FILTROS = [['todos', 'Todos'], ['habilitada', 'Activas'], ['pendiente', 'Pendientes'], ['suspendida', 'Suspendidas'], ['deshabilitada', 'Deshabilitadas']]

// A-08 · Gestión de cuentas: búsqueda, filtros por estado y acciones por fila.
export default function Clientes() {
  const { datos, error, recargar } = useDatos(cargarTodo)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [overlay, setOverlay] = useState(null)
  const avisar = useToast()
  const visibles = useMemo(() => (datos?.cuentas || []).filter(c => (filtro === 'todos' || c.estado === filtro)
    && (nombreCuenta(c) + ' ' + c.correo + ' ' + c.codigo).toLowerCase().includes(busqueda.toLowerCase())), [datos, filtro, busqueda])
  if (!datos) return error ? <div className="nx-page"><InlineAlert type="error">{error}</InlineAlert></div> : <Spinner />
  const { cuentas, documentos, carpetas } = datos
  const pendientes = cuentas.filter(c => c.estado === 'pendiente').length

  return <main className="nx-page">
    <div className="nx-page__top">
      <div className="nx-page__title"><h1 className="nx-h1">Clientes</h1>
        <p className="nx-body nx-muted">{plural(cuentas.length, 'cuenta', 'cuentas')}{pendientes ? ` · ${plural(pendientes, 'pendiente', 'pendientes')} de autorización` : ''}</p></div>
      <div className="nx-page__tools">
        <Button variant="text" icon="users" onClick={() => setOverlay({ tipo: 'lote' })}>Crear cuentas en lote</Button>
        <Button icon="user-plus" onClick={() => setOverlay({ tipo: 'crear' })}>Crear cuenta</Button>
      </div>
    </div>
    <div className="nx-filter-row">
      <SearchField label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      <div className="nx-folder-tabs" role="toolbar" aria-label="Filtrar por estado">{FILTROS.map(([valor, texto]) =>
        <button key={valor} type="button" className="nx-folder-tab" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
          {texto}<span className="nx-folder-tab__count">{valor === 'todos' ? cuentas.length : cuentas.filter(c => c.estado === valor).length}</span></button>)}</div>
    </div>
    {visibles.length ? <TablaClientes cuentas={visibles} documentos={documentos} onGestionar={c => navigate('/admin/clientes/' + c.id)}
      acciones={c => accionesRapidas(c, setOverlay)} />
      : <div className="nx-card">{busqueda ? <EmptyState icon="search" title={`No hay clientes que coincidan con «${busqueda}»`}
        action={<Button variant="secondary" onClick={() => setBusqueda('')}>Limpiar búsqueda</Button>}>Revisa el nombre o el correo, o crea una cuenta nueva.</EmptyState>
        : <EmptyState icon="users" title={filtro === 'todos' ? 'Aún no hay clientes' : `No hay cuentas en estado «${ESTADOS[filtro]}»`}
          action={filtro === 'todos' && <Button onClick={() => setOverlay({ tipo: 'crear' })}>Crear la primera cuenta</Button>}>
          {filtro === 'todos' ? 'Crea la primera cuenta para darle acceso a un cliente.' : 'Cambia el filtro para ver las demás cuentas.'}</EmptyState>}</div>}

    {overlay?.tipo === 'crear' && <CrearCuenta onClose={() => { setOverlay(null); recargar() }} onCreada={c => navigate('/admin/clientes/' + c.id)} />}
    {overlay?.tipo === 'lote' && <CrearLote onClose={() => setOverlay(null)} onCreadas={lista => { setOverlay({ tipo: 'credencialesLote', lista }); recargar() }} />}
    {overlay?.tipo === 'credencialesLote' && <Credenciales titulo="Cuentas creadas" credenciales={overlay.lista} onClose={() => setOverlay(null)} />}
    <OverlaysCuenta overlay={overlay} setOverlay={setOverlay} documentos={documentos} carpetas={carpetas}
      alTerminar={(titulo, texto) => { setOverlay(null); avisar(titulo, texto); recargar() }} />
  </main>
}
