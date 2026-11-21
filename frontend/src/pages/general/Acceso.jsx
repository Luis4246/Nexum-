import Icon from '../../components/Icon'
import { Button } from '../../components/Button'
import { StatusTag } from '../../components/Feedback'
import { navigate } from '../../router'
import AuthLayout from './AuthLayout'

// G-04 · Cuenta pendiente de autorización. Se muestra cuando el login responde que la cuenta está pendiente.
export function Pendiente() {
  return <AuthLayout>
    <div className="nx-auth__form">
      <span className="nx-auth__icon nx-auth__icon--warning"><Icon name="lock" size={24} /></span>
      <StatusTag estado="pendiente" />
      <div className="nx-auth__heading">
        <h1 className="nx-h1">Tu cuenta está pendiente de autorización</h1>
        <p className="nx-body-sm nx-muted">El administrador todavía debe habilitar tu acceso a NEXUM. Cuando lo haga, podrás iniciar sesión con el mismo correo y contraseña que te entregó.</p>
      </div>
      <Button icon="chevron-left" block onClick={() => navigate('/ingresar')}>Volver a iniciar sesión</Button>
      <p className="nx-caption nx-muted">Si crees que es un error, escribe a tu administrador.</p>
    </div>
  </AuthLayout>
}

// G-03 · Recuperar contraseña, adaptado a los requisitos: no hay recuperación por correo, así que la
// pantalla explica cómo obtener una contraseña nueva, sin formulario.
export function Recuperar() {
  return <AuthLayout>
    <div className="nx-auth__form">
      <Button variant="text" size="sm" icon="chevron-left" className="nx-auth__back" onClick={() => navigate('/ingresar')}>Volver a iniciar sesión</Button>
      <span className="nx-auth__icon nx-auth__icon--accent"><Icon name="lock-open" size={24} /></span>
      <div className="nx-auth__heading">
        <h1 className="nx-h1">Recuperar contraseña</h1>
        <p className="nx-body-sm nx-muted">En NEXUM las contraseñas las gestiona tu administrador. Pídele que la restablezca: él te entregará una contraseña nueva para iniciar sesión.</p>
      </div>
      <Button block onClick={() => navigate('/ingresar')}>Volver a iniciar sesión</Button>
    </div>
  </AuthLayout>
}
