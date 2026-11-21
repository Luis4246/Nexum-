import Icon from '../../components/Icon'
import { Button, IconButton } from '../../components/Button'
import { StatusTag } from '../../components/Feedback'
import { Avatar, FileTile, FolderTag } from '../../components/Library'
import { Menu } from '../../components/Menu'
import { fecha, nombreCuenta, plural, tamano } from '../../utils/formato'
import { asignadosTexto, documentosDe } from './datos'

// C10 · Tabla de documentos del administrador (A-05 y A-10).
export function TablaDocumentos({ documentos, cuentas, onEditar, onEliminar }) {
  return <div className="nx-table" role="table" aria-label="Documentos">
    <div className="nx-table__row nx-table__row--head" role="row">
      <span className="nx-cell nx-cell--grow" role="columnheader">Documento</span>
      <span className="nx-cell" style={{ width: 150 }} role="columnheader">Carpeta</span>
      <span className="nx-cell" style={{ width: 80 }} role="columnheader">Tamaño</span>
      <span className="nx-cell" style={{ width: 120 }} role="columnheader">Fecha de carga</span>
      <span className="nx-cell" style={{ width: 190 }} role="columnheader">Asignado a</span>
      <span className="nx-cell" style={{ width: 80 }} role="columnheader"><span className="nx-sr-only">Acciones</span></span>
    </div>
    {documentos.map(d => <div key={d.id} className="nx-table__row nx-table__row--body" role="row">
      <span className="nx-cell nx-cell--grow" role="cell"><FileTile />
        <span className="nx-label-strong nx-ellipsis" title={d.titulo}>{d.titulo}</span>
        {d.version > 1 && <span className="nx-caption nx-muted">v{d.version}</span>}</span>
      <span className="nx-cell" style={{ width: 150 }} role="cell">{d.carpeta ? <FolderTag nombre={d.carpeta.nombre} /> : <span className="nx-body-sm nx-muted">Sin carpeta</span>}</span>
      <span className="nx-cell nx-body-sm nx-muted" style={{ width: 80 }} role="cell">{tamano(d.tamano)}</span>
      <span className="nx-cell nx-body-sm nx-muted" style={{ width: 120 }} role="cell">{fecha(d.creado_en)}</span>
      <span className="nx-cell nx-body-sm" style={{ width: 190 }} role="cell">{asignadosTexto(d.cuentas, cuentas)}</span>
      <span className="nx-cell nx-cell--end" style={{ width: 80 }} role="cell">
        <IconButton icon="square-pen" size="sm" label={'Editar ' + d.titulo} onClick={() => onEditar(d)} />
        <IconButton icon="trash-2" size="sm" tone="danger" label={'Eliminar ' + d.titulo} onClick={() => onEliminar(d)} />
      </span>
    </div>)}
  </div>
}

// C10 · Tabla de clientes (A-05 y A-08). «Gestionar» abre el detalle; el menú reúne acciones rápidas.
export function TablaClientes({ cuentas, documentos, onGestionar, acciones }) {
  return <div className="nx-table" role="table" aria-label="Clientes">
    <div className="nx-table__row nx-table__row--head" role="row">
      <span className="nx-cell nx-cell--grow" role="columnheader">Cliente</span>
      <span className="nx-cell" style={{ width: 260 }} role="columnheader">Correo electrónico</span>
      <span className="nx-cell" style={{ width: 130 }} role="columnheader">Estado</span>
      <span className="nx-cell" style={{ width: 120 }} role="columnheader">Documentos</span>
      <span className="nx-cell" style={{ width: 160 }} role="columnheader"><span className="nx-sr-only">Acciones</span></span>
    </div>
    {cuentas.map(c => <div key={c.id} className="nx-table__row nx-table__row--body nx-table__row--client" role="row">
      <span className="nx-cell nx-cell--grow" role="cell" style={{ gap: 12 }}><Avatar nombre={nombreCuenta(c)} />
        <span className="nx-label-strong nx-ellipsis">{nombreCuenta(c)}</span></span>
      <span className="nx-cell nx-body-sm nx-muted" style={{ width: 260 }} role="cell"><span className="nx-ellipsis">{c.correo || c.codigo}</span></span>
      <span className="nx-cell" style={{ width: 130 }} role="cell"><StatusTag estado={c.estado} /></span>
      <span className="nx-cell nx-body-sm" style={{ width: 120 }} role="cell">{plural(documentosDe(c.id, documentos).length, 'documento', 'documentos')}</span>
      <span className="nx-cell nx-cell--end" style={{ width: 160 }} role="cell">
        <Button variant="secondary" size="sm" onClick={() => onGestionar(c)}>Gestionar</Button>
        {acciones && <Menu label={'Acciones de ' + nombreCuenta(c)} items={acciones(c)} trigger={p =>
          <button type="button" className="nx-icon-btn nx-icon-btn--sm" aria-label={'Más acciones de ' + nombreCuenta(c)} {...p}>
            <Icon name="ellipsis" size={16} />
          </button>} />}
      </span>
    </div>)}
  </div>
}
