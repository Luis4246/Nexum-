import Icon from './Icon'
import Logo from './Logo'
import { Button } from './Button'
import { Menu } from './Menu'
import { Avatar } from './Library'
import { navigate } from '../router'

// C06 · Top nav, distinta por rol. Sin barra lateral.
const ENLACES = {
  admin: [['Inicio', '/admin'], ['Documentos', '/admin/documentos'], ['Clientes', '/admin/clientes'], ['Configuración', '/admin/configuracion']],
  cliente: [['Mis documentos', '/biblioteca']],
}

export default function TopNav({ rol, nombre, actual, onSalir, onCrearCuenta }) {
  const activo = ruta => ruta === actual || (ruta !== '/admin' && actual.startsWith(ruta + '/'))
  const cuenta = rol === 'admin'
    ? [{ label: 'Cerrar sesión', icon: 'log-out', onSelect: onSalir }]
    : [{ label: 'Perfil', icon: 'user', onSelect: () => navigate('/perfil') }, 'divider', { label: 'Cerrar sesión', icon: 'log-out', onSelect: onSalir }]
  return <header className="nx-topnav">
    <div className="nx-topnav__left">
      <a className="nx-topnav__logo" href={rol === 'admin' ? '#/admin' : '#/biblioteca'} aria-label="NEXUM, ir al inicio"><Logo ancho={120} /></a>
      <nav className="nx-topnav__links" aria-label="Navegación principal">
        {ENLACES[rol].map(([texto, ruta]) => <a key={ruta} href={'#' + ruta} className="nx-navlink" aria-current={activo(ruta) ? 'page' : undefined}>{texto}</a>)}
      </nav>
    </div>
    <div className="nx-topnav__right">
      {rol === 'admin' && <Button size="sm" icon="user-plus" onClick={onCrearCuenta} aria-label="Crear cuenta"><span className="nx-topnav__crear">Crear cuenta</span></Button>}
      <Menu label="Cuenta" items={cuenta} trigger={props => <button type="button" className="nx-account" {...props}>
        <Avatar nombre={nombre} /><span className="nx-account__name">{nombre}</span><Icon name="chevron-right" size={16} />
      </button>} />
    </div>
  </header>
}
