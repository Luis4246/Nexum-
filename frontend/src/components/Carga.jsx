import { useRef, useState } from 'react'
import Icon from './Icon'
import { Button, IconButton } from './Button'
import { Checkbox } from './Choice'
import { FileTile } from './Library'
import { tamano } from '../utils/formato'

// C10 · Dropzone: arrastrar y soltar o seleccionar archivos. Estados Default, Dragover y Error.
export function Dropzone({ onFiles, maxMb, error, compact = false }) {
  const [encima, setEncima] = useState(false)
  const entrada = useRef(null)
  const recibir = lista => { const archivos = [...lista]; if (archivos.length) onFiles(archivos) }
  const clase = 'nx-dropzone' + (encima ? ' nx-dropzone--drag' : error ? ' nx-dropzone--error' : '')
  return <div className={clase} style={compact ? { padding: '20px 24px', gap: 8 } : undefined}
    onDragOver={e => { e.preventDefault(); setEncima(true) }} onDragLeave={() => setEncima(false)}
    onDrop={e => { e.preventDefault(); setEncima(false); recibir(e.dataTransfer.files) }}>
    <span className="nx-dropzone__icon"><Icon name={error && !encima ? 'circle-alert' : 'upload'} size={24} /></span>
    <span className="nx-label-strong">{encima ? 'Suelta los archivos para subirlos' : error || 'Arrastra tus archivos PDF aquí'}</span>
    {!encima && <span className="nx-dropzone__row"><span className="nx-body-sm nx-muted">o</span>
      <Button variant="secondary" size="sm" onClick={() => entrada.current.click()}>Seleccionar archivos</Button></span>}
    <span className={'nx-caption ' + (error ? 'nx-text-error' : 'nx-muted')}>Solo archivos PDF{maxMb ? `, hasta ${maxMb} MB por archivo` : ''}.</span>
    <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { recibir(e.target.files); e.target.value = '' }} />
  </div>
}

// C10 · Upload item: en espera, subiendo con progreso, subido o con error.
export function UploadItem({ archivo, estado, progreso = 0, error, onQuitar }) {
  const meta = {
    espera: [`${tamano(archivo.size)} · Listo para subir`, 'nx-muted'],
    subiendo: [`${tamano(archivo.size * progreso)} de ${tamano(archivo.size)} · ${Math.round(progreso * 100)} %`, 'nx-muted'],
    listo: [`${tamano(archivo.size)} · Subido`, 'nx-text-success'],
    error: [error, 'nx-text-error'],
  }[estado]
  return <div className={'nx-upload' + (estado === 'error' ? ' nx-upload--error' : '')}>
    <FileTile large />
    <div className="nx-upload__mid">
      <span className="nx-label-strong nx-ellipsis">{archivo.name}</span>
      {estado === 'subiendo' && <div className="nx-progress" role="progressbar" aria-valuenow={Math.round(progreso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={'Subiendo ' + archivo.name}>
        <span style={{ width: `${Math.round(progreso * 100)}%` }} /></div>}
      <span className={'nx-caption ' + meta[1]}>{meta[0]}</span>
    </div>
    {estado === 'listo' ? <span className="nx-upload__ok"><Icon name="circle-check" size={20} title="Subido" /></span>
      : estado !== 'subiendo' && onQuitar && <IconButton icon="x" size="sm" tone="muted" label={'Quitar ' + archivo.name} onClick={onQuitar} />}
  </div>
}

// C10 · Picker row: fila seleccionable con casilla para clientes o documentos.
export function PickerRow({ seleccionado, onChange, titulo, detalle, inicio }) {
  return <label className={'nx-picker-row' + (seleccionado ? ' nx-picker-row--selected' : '')}>
    <Checkbox label={titulo} hideLabel checked={seleccionado} onChange={onChange} />
    {inicio}
    <span className="nx-picker-row__text"><span className="nx-label nx-ellipsis">{titulo}</span>
      {detalle && <span className="nx-caption nx-muted nx-ellipsis">{detalle}</span>}</span>
  </label>
}
