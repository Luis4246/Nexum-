import React, { useEffect, useState } from 'react'
import { sesion } from './api'
import { Spinner } from './components/Feedback'
import TopNav from './components/TopNav'
import { useToast } from './components/Toast'
import { match, navigate, useRoute } from './router'
import { cerrarSesion } from './services/sesion'
import Landing from './pages/general/Landing'
import Login from './pages/general/Login'
import { Pendiente, Recuperar } from './pages/general/Acceso'
import InicioAdmin from './pages/admin/Inicio'
import DocumentosAdmin from './pages/admin/Documentos'
import Clientes from './pages/admin/Clientes'
import DetalleCliente from './pages/admin/DetalleCliente'
import Configuracion from './pages/admin/Configuracion'
import CrearCuenta from './overlays/CrearCuenta'
import BibliotecaCliente from './pages/cliente/Biblioteca'
import Perfil from './pages/cliente/Perfil'

const Visor = React.lazy(() => import('./visor/Visor'))

// Rutas por rol. El backend valida cada petición; esto solo decide qué pantalla mostrar.
const ADMIN = [['/admin', InicioAdmin], ['/admin/documentos', DocumentosAdmin], ['/admin/clientes', Clientes],
  ['/admin/clientes/:id', DetalleCliente], ['/admin/configuracion', Configuracion]]
const CLIENTE = [['/biblioteca', BibliotecaCliente], ['/perfil', Perfil]]

export default function App() {
  const [usuario, setUsuario] = useState(sesion)
  const [crear, setCrear] = useState(false)
  const [version, setVersion] = useState(0)
  const ruta = useRoute()
  const avisar = useToast()

  useEffect(() => {
    const salir = () => { setUsuario(null); navigate('/ingresar', { replace: true }) }
    window.addEventListener('salir', salir)
    return () => window.removeEventListener('salir', salir)
  }, [])

  const inicio = u => u.admin ? '/admin' : '/biblioteca'
  const publicas = ['/', '/ingresar', '/recuperar', '/pendiente']

  // Redirecciones según la sesión y el rol.
  useEffect(() => {
    if (!usuario && !publicas.includes(ruta.path)) navigate('/ingresar', { replace: true })
    else if (usuario && (publicas.includes(ruta.path) || (usuario.admin !== ruta.path.startsWith('/admin') && !ruta.path.startsWith('/biblioteca/'))))
      navigate(inicio(usuario), { replace: true })
    else if (usuario?.admin && ruta.path.startsWith('/biblioteca/')) navigate('/admin', { replace: true })
  }, [usuario, ruta.path])

  async function salir() {
    try { await cerrarSesion() } catch { /* la sesión local se cierra igual */ }
    avisar('Sesión cerrada', '', 'info')
  }

  if (!usuario) {
    if (ruta.path === '/ingresar') return <Login alEntrar={u => { setUsuario(u); navigate(inicio(u), { replace: true }) }} />
    if (ruta.path === '/recuperar') return <Recuperar />
    if (ruta.path === '/pendiente') return <Pendiente />
    return <Landing />
  }

  const visor = !usuario.admin && match('/biblioteca/:id', ruta.path)
  if (visor) return <React.Suspense fallback={<Spinner label="Abriendo documento…" />}>
    <Visor id={Number(visor.id)} version={ruta.query.version ? Number(ruta.query.version) : null} usuario={usuario.usuario} />
  </React.Suspense>

  const rutas = usuario.admin ? ADMIN : CLIENTE
  let Pagina = null, params = {}
  for (const [patron, componente] of rutas) {
    const m = match(patron, ruta.path)
    if (m) { Pagina = componente; params = m; break }
  }
  return <>
    <TopNav rol={usuario.admin ? 'admin' : 'cliente'} nombre={usuario.admin ? 'Administrador' : usuario.usuario} actual={ruta.path}
      onSalir={salir} onCrearCuenta={() => setCrear(true)} />
    {Pagina ? <Pagina key={ruta.path + version} {...params} query={ruta.query} usuario={usuario} /> : <Spinner />}
    {crear && <CrearCuenta onClose={() => setCrear(false)} onCreada={c => { setCrear(false); setVersion(v => v + 1); navigate('/admin/clientes/' + c.id) }} />}
  </>
}
