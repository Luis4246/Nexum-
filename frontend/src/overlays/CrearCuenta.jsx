import { useMemo, useState } from 'react'
import { mensaje } from '../api'
import Icon from '../components/Icon'
import { Button } from '../components/Button'
import { PickerRow } from '../components/Carga'
import { InlineAlert } from '../components/Feedback'
import { PasswordField, SearchField, TextField } from '../components/Field'
import { FileTile } from '../components/Library'
import { Modal } from '../components/Overlay'
import useDatos from '../hooks/useDatos'
import { crearCuenta } from '../services/cuentas'
import { asignar, listarDocumentos } from '../services/documentos'
import { plural, tamano } from '../utils/formato'

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// A-07 · Crear cuenta (overlay). El correo es el usuario de acceso; la contraseña la define el administrador.
export default function CrearCuenta({ onClose, onCreada }) {
  const { datos: documentos } = useDatos(listarDocumentos)
  const [form, setForm] = useState({ nombre: '', correo: '', clave: '', estado: 'habilitada' })
  const [docs, setDocs] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [creada, setCreada] = useState(null)

  const visibles = useMemo(() => (documentos || []).filter(d => d.titulo.toLowerCase().includes(busqueda.toLowerCase())), [documentos, busqueda])
  const cambiar = campo => e => setForm(f => ({ ...f, [campo]: e.target.value }))

  async function enviar(e) {
    e.preventDefault()
    const faltan = {}
    if (!form.nombre.trim()) faltan.nombre = 'Escribe el nombre del cliente.'
    if (!CORREO.test(form.correo.trim())) faltan.correo = 'Escribe un correo válido.'
    if (form.clave.length < 8) faltan.clave = 'La contraseña debe tener al menos 8 caracteres.'
    setErrores(faltan)
    setAviso(Object.keys(faltan).length ? `Revisa ${plural(Object.keys(faltan).length, 'campo marcado', 'campos marcados')} antes de crear la cuenta.` : '')
    if (Object.keys(faltan).length) return
    setOcupado(true)
    let cuenta
    try {
      const correo = form.correo.trim().toLowerCase()
      cuenta = await crearCuenta({ codigo: correo, correo, nombre: form.nombre.trim(), clave: form.clave, estado: form.estado === 'habilitada' ? 'habilitada' : 'pendiente' })
    } catch (error) {
      const d = error.response?.data || {}
      const nuevos = {}
      if (d.codigo || /ya existe/.test(d[0] || d.detail || '')) nuevos.correo = 'Ya existe una cuenta con este correo.'
      if (d.correo) nuevos.correo = 'Escribe un correo válido.'
      if (d.clave) nuevos.clave = [].concat(d.clave).join(' ')
      setErrores(nuevos); setAviso(Object.keys(nuevos).length ? '' : mensaje(error)); setOcupado(false)
      return
    }
    try { if (docs.length) await asignar([cuenta.id], docs) }
    catch (error) { setAviso('La cuenta se creó, pero no se pudieron asignar los documentos: ' + mensaje(error)) }
    setOcupado(false)
    setCreada({ ...cuenta, clave: form.clave, documentos: docs.length })
  }

  if (creada) return <Modal title="Cuenta creada" onClose={() => onCreada(creada)} size="sm" footer={<>
    <Button variant="secondary" onClick={() => { setCreada(null); setForm({ nombre: '', correo: '', clave: '', estado: 'habilitada' }); setDocs([]); setAviso('') }}>Crear otra cuenta</Button>
    <Button onClick={() => onCreada(creada)}>Ver cuenta</Button></>}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <span className="nx-auth__icon" style={{ background: 'var(--nx-status-success-bg)', color: 'var(--nx-status-success)' }}><Icon name="circle-check" size={24} /></span>
      <p className="nx-body-sm nx-muted">La cuenta de {creada.nombre} {creada.estado === 'habilitada' ? 'está activa' : 'queda pendiente de autorización'} y tiene {plural(creada.documentos, 'documento asignado', 'documentos asignados')}. Entrégale estos datos de acceso por un medio seguro.</p>
    </div>
    {aviso && <InlineAlert type="warning">{aviso}</InlineAlert>}
    <dl className="nx-credenciales">
      <div><dt className="nx-caption nx-muted">Correo</dt><dd className="nx-label">{creada.codigo}</dd></div>
      <div><dt className="nx-caption nx-muted">Contraseña</dt><dd className="nx-label">{creada.clave}</dd></div>
    </dl>
  </Modal>

  return <Modal as="form" onSubmit={enviar} title="Crear nueva cuenta" onClose={ocupado ? undefined : onClose} size="lg"
    footerInfo={plural(docs.length, 'documento seleccionado', 'documentos seleccionados')}
    footer={<><Button variant="text" onClick={onClose} disabled={ocupado}>Cancelar</Button>
      <Button type="submit" loading={ocupado}>{ocupado ? 'Creando cuenta…' : 'Crear cuenta'}</Button></>}>
    {aviso && <InlineAlert type="error">{aviso}</InlineAlert>}
    <div className="nx-form-grid">
      <TextField label="Nombre del cliente" placeholder="Nombre y apellido" autoFocus value={form.nombre} onChange={cambiar('nombre')} error={errores.nombre} />
      <TextField label="Correo electrónico" type="email" placeholder="nombre@empresa.cl" value={form.correo} onChange={cambiar('correo')} error={errores.correo} />
    </div>
    <PasswordField label="Contraseña" placeholder="Mínimo 8 caracteres" autoComplete="new-password" value={form.clave} onChange={cambiar('clave')} error={errores.clave}
      help="Entrégala al cliente junto con su correo. Mínimo 8 caracteres; no puede ser solo números ni una contraseña común." />
    <fieldset className="nx-option-group">
      <legend className="nx-label">Estado de la cuenta</legend>
      {[['habilitada', 'Activa', 'El cliente puede iniciar sesión de inmediato.'], ['pendiente', 'Pendiente de autorización', 'El acceso queda en espera hasta que lo habilites.']].map(([valor, titulo, texto]) =>
        <label key={valor} className="nx-option-card"><input type="radio" name="estado" value={valor} checked={form.estado === valor} onChange={cambiar('estado')} />
          <span className="nx-option-card__dot" aria-hidden="true" /><span><span className="nx-label-strong">{titulo}</span><span className="nx-caption nx-muted" style={{ display: 'block' }}>{texto}</span></span></label>)}
    </fieldset>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div><p className="nx-label">Documentos disponibles</p><p className="nx-caption nx-muted">Elige qué documentos verá. Podrás cambiarlos más adelante.</p></div>
      <SearchField label="Buscar documentos" placeholder="Buscar documentos" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      <div className="nx-picker">{visibles.map(d => <PickerRow key={d.id} titulo={d.titulo} inicio={<FileTile />}
        detalle={[d.carpeta?.nombre, tamano(d.tamano)].filter(Boolean).join(' · ')} seleccionado={docs.includes(d.id)}
        onChange={v => setDocs(s => v ? [...s, d.id] : s.filter(x => x !== d.id))} />)}
        {documentos && !visibles.length && <p className="nx-body-sm nx-muted" style={{ padding: 12 }}>{documentos.length ? 'Ningún documento coincide con la búsqueda.' : 'Aún no hay documentos cargados.'}</p>}</div>
    </div>
  </Modal>
}
