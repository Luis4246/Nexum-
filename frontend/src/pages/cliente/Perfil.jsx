import { Button } from '../../components/Button'
import { StatusTag } from '../../components/Feedback'
import Icon from '../../components/Icon'
import { cerrarSesion } from '../../services/sesion'

// C-13 · Perfil, adaptado a los requisitos: el cliente solo consulta sus datos de acceso.
// No puede editar su perfil ni cambiar su contraseña; eso lo gestiona el administrador.
export default function Perfil({ usuario }) {
  return <main className="nx-page" style={{ maxWidth: 640 + 240 }}>
    <div className="nx-page__title"><h1 className="nx-h1">Perfil</h1><p className="nx-body nx-muted">Tus datos de acceso a NEXUM.</p></div>
    <section className="nx-card">
      <h2 className="nx-h3">Datos de la cuenta</h2>
      <div className="nx-kv"><span className="nx-caption nx-muted">Correo o usuario de acceso</span><span className="nx-body">{usuario.usuario}</span></div>
      <div className="nx-kv" style={{ gap: 6 }}><span className="nx-caption nx-muted">Estado de la cuenta</span><StatusTag estado="habilitada" /></div>
      <p className="nx-hero__note nx-caption nx-muted"><Icon name="info" size={16} />Para cambiar tus datos o tu contraseña, pídeselo al administrador de tu cuenta.</p>
    </section>
    <section className="nx-card">
      <h2 className="nx-h3">Sesión</h2>
      <p className="nx-body-sm nx-muted">Cierra la sesión si usas un equipo compartido.</p>
      <Button variant="secondary" icon="log-out" style={{ alignSelf: 'flex-start' }} onClick={() => cerrarSesion()}>Cerrar sesión</Button>
    </section>
  </main>
}
