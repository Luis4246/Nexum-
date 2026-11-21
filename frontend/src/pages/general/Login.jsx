import { useState } from 'react'
import { mensaje } from '../../api'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Choice'
import { InlineAlert } from '../../components/Feedback'
import { PasswordField, TextField } from '../../components/Field'
import { navigate } from '../../router'
import { iniciarSesion } from '../../services/sesion'
import AuthLayout from './AuthLayout'

// G-02 · Iniciar sesión. Estados: por defecto, campos vacíos, ingresando, credenciales incorrectas y acceso
// suspendido o deshabilitado. Una cuenta pendiente lleva a G-04.
export default function Login({ alEntrar }) {
  const [datos, setDatos] = useState({ usuario: '', clave: '', recordar: false })
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    const faltan = {}
    if (!datos.usuario.trim()) faltan.usuario = 'Ingresa tu correo electrónico.'
    if (!datos.clave) faltan.clave = 'Ingresa tu contraseña.'
    setErrores(faltan); setAviso(null)
    if (Object.keys(faltan).length) return
    setEnviando(true)
    try {
      const r = await iniciarSesion(datos.usuario.trim(), datos.clave, datos.recordar)
      if (r.denegado === 'pendiente') return navigate('/pendiente')
      if (r.denegado) return setAviso({ tipo: 'warning', texto: r.mensaje })
      alEntrar(r.sesion)
    } catch (error) {
      const estado = error.response?.status
      setAviso({ tipo: 'error', texto: estado === 401
        ? 'Correo o contraseña incorrectos. Revisa los datos que te entregó tu administrador.'
        : mensaje(error) })
    } finally { setEnviando(false) }
  }

  const cambiar = campo => e => setDatos(d => ({ ...d, [campo]: e.target.value }))
  return <AuthLayout>
    <form className="nx-auth__form" onSubmit={enviar} noValidate>
      <div className="nx-auth__heading">
        <h1 className="nx-h1">Iniciar sesión</h1>
        <p className="nx-body-sm nx-muted">Ingresa con el correo y la contraseña que te entregó tu administrador.</p>
      </div>
      {aviso && <InlineAlert type={aviso.tipo}>{aviso.texto}</InlineAlert>}
      <TextField label="Correo electrónico" placeholder="nombre@empresa.cl" autoComplete="username" autoFocus
        value={datos.usuario} onChange={cambiar('usuario')} error={errores.usuario} />
      <PasswordField label="Contraseña" placeholder="Tu contraseña" autoComplete="current-password"
        value={datos.clave} onChange={cambiar('clave')} error={errores.clave} />
      <div className="nx-auth__row">
        <Checkbox label="Recordar sesión" checked={datos.recordar} onChange={v => setDatos(d => ({ ...d, recordar: v }))} />
        <Button variant="text" size="sm" onClick={() => navigate('/recuperar')}>¿Olvidaste tu contraseña?</Button>
      </div>
      <Button type="submit" block loading={enviando}>{enviando ? 'Ingresando…' : 'Iniciar sesión'}</Button>
      <div className="nx-auth__rule" />
      <p className="nx-caption nx-muted">¿No tienes cuenta? Solo el administrador puede crearla. Contáctalo para solicitar acceso.</p>
    </form>
  </AuthLayout>
}
