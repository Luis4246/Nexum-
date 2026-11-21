import { useState } from 'react'
import { mensaje } from '../api'
import { Button } from '../components/Button'
import { InlineAlert } from '../components/Feedback'
import { PasswordField, TextField } from '../components/Field'
import { Modal } from '../components/Overlay'
import { editarCuenta, operarCuenta } from '../services/cuentas'

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// A-09 · Editar datos del cliente (overlay). Solo el administrador gestiona los datos y las contraseñas.
// Si el usuario de acceso de la cuenta es su correo, cambiar el correo cambia también el usuario de acceso.
export default function EditarCliente({ cuenta, onClose, onGuardado }) {
  const usaCorreo = !cuenta.correo || cuenta.codigo === cuenta.correo
  const [form, setForm] = useState({ nombre: cuenta.nombre, correo: cuenta.correo, codigo: cuenta.codigo, clave: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const cambiar = campo => e => setForm(f => ({ ...f, [campo]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    const faltan = {}
    if (form.correo && !CORREO.test(form.correo.trim())) faltan.correo = 'Escribe un correo válido.'
    if (form.clave && form.clave.length < 8) faltan.clave = 'La contraseña debe tener al menos 8 caracteres.'
    if (!usaCorreo && !form.codigo.trim()) faltan.codigo = 'El usuario de acceso no puede quedar vacío.'
    setErrores(faltan); if (Object.keys(faltan).length) return
    setOcupado(true); setError('')
    const correo = form.correo.trim().toLowerCase()
    const datos = { nombre: form.nombre.trim(), correo }
    const codigo = usaCorreo && correo ? correo : form.codigo.trim()
    if (codigo && codigo !== cuenta.codigo) datos.codigo = codigo
    try {
      const actualizada = await editarCuenta(cuenta.id, datos)
      if (form.clave) await operarCuenta(cuenta.id, 'clave', { clave: form.clave })
      onGuardado(actualizada, !!form.clave)
    } catch (err) {
      const d = err.response?.data || {}
      if (d.clave) setErrores({ clave: [].concat(d.clave).join(' ') })
      else if (d.correo) setErrores({ correo: 'Escribe un correo válido.' })
      else setError(/ya existe/.test(mensaje(err)) ? 'Ya existe otra cuenta con ese correo o usuario.' : mensaje(err))
      setOcupado(false)
    }
  }

  return <Modal as="form" onSubmit={guardar} title="Editar datos del cliente" onClose={ocupado ? undefined : onClose}
    footer={<><Button variant="text" onClick={onClose} disabled={ocupado}>Cancelar</Button><Button type="submit" loading={ocupado}>Guardar cambios</Button></>}>
    {error && <InlineAlert type="error">{error}</InlineAlert>}
    <TextField label="Nombre del cliente" value={form.nombre} onChange={cambiar('nombre')} autoFocus />
    <TextField label="Correo electrónico" type="email" value={form.correo} onChange={cambiar('correo')} error={errores.correo}
      help={usaCorreo ? 'Es también el correo con el que inicia sesión.' : undefined} />
    {!usaCorreo && <TextField label="Usuario de acceso" value={form.codigo} onChange={cambiar('codigo')} error={errores.codigo}
      help="Esta cuenta inicia sesión con este usuario. Puedes cambiarlo por su correo." />}
    <div className="nx-section-title"><p className="nx-label">Restablecer contraseña</p>
      <p className="nx-caption nx-muted">Opcional. Si defines una nueva, entrégasela al cliente; la anterior dejará de funcionar y se cerrarán sus sesiones.</p></div>
    <PasswordField label="Nueva contraseña" placeholder="Déjala vacía para mantener la actual" autoComplete="new-password" value={form.clave} onChange={cambiar('clave')} error={errores.clave} />
  </Modal>
}
