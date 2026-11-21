import Icon from '../../components/Icon'
import Logo from '../../components/Logo'
import { Button } from '../../components/Button'
import { CORREO_CONTACTO } from '../../config'
import { navigate } from '../../router'

const FUNCIONES = [
  ['upload', 'El administrador sube y organiza', 'Carga los PDF en una biblioteca central, los ordena en carpetas y decide qué documentos ve cada cliente.'],
  ['users', 'Cuentas creadas por el administrador', 'Cada cliente recibe un correo y una contraseña. El administrador autoriza, suspende o deshabilita el acceso cuando lo necesita.'],
  ['highlighter', 'El cliente trabaja sobre el PDF', 'Resalta, subraya, dibuja y escribe. Sus anotaciones se guardan en su propia capa.'],
]
const HERRAMIENTAS = [['highlighter', 'Resaltar'], ['underline', 'Subrayar'], ['brush', 'Dibujo libre'], ['pencil', 'Lápiz'],
  ['type', 'Texto'], ['eraser', 'Borrador'], ['undo-2', 'Deshacer y rehacer'], ['save', 'Guardar cambios']]
const BARRA = ['mouse-pointer-2', 'brush', 'pencil', 'highlighter', 'underline', 'type', 'eraser', 'undo-2', 'redo-2']

function Contacto({ variant = 'secondary', size, children = 'Solicitar información' }) {
  if (!CORREO_CONTACTO) return null
  return <a className={`nx-btn nx-btn--${variant}${size === 'sm' ? ' nx-btn--sm' : ''}`} href={'mailto:' + CORREO_CONTACTO}>
    {variant === 'secondary' && <Icon name="mail" size={20} />}{children}</a>
}

// G-01 · Landing pública.
export default function Landing() {
  const entrar = () => navigate('/ingresar')
  return <div>
    <header className="nx-landing__nav">
      <Logo ancho={132} />
      <nav className="nx-landing__links" aria-label="Secciones"><a href="#funciones" onClick={e => { e.preventDefault(); document.getElementById('funciones').scrollIntoView({ behavior: 'smooth' }) }}>Funciones</a>
        <a href="#herramientas" onClick={e => { e.preventDefault(); document.getElementById('herramientas').scrollIntoView({ behavior: 'smooth' }) }}>Herramientas PDF</a></nav>
      <div className="nx-landing__actions"><Contacto variant="text" size="sm">Contacto</Contacto><Button size="sm" onClick={entrar}>Iniciar sesión</Button></div>
    </header>
    <main>
      <section className="nx-hero">
        <div className="nx-hero__text">
          <p className="nx-eyebrow">Plataforma privada de documentos</p>
          <h1 className="nx-display">Tus documentos PDF, compartidos y anotados en un solo lugar.</h1>
          <p className="nx-body nx-muted">NEXUM reúne en un espacio privado los documentos que tu administrador te asigna. Ábrelos, resalta, subraya, dibuja y escribe sobre ellos, y guarda tu trabajo sin salir del navegador.</p>
          <div className="nx-hero__cta"><Button onClick={entrar}>Iniciar sesión</Button><Contacto /></div>
          <p className="nx-hero__note nx-caption nx-muted"><Icon name="lock" size={16} />El acceso es solo con una cuenta creada por tu administrador.</p>
        </div>
        <div className="nx-hero__shot" aria-hidden="true">
          <div className="nx-hero__page">
            <small>INFORME · NOVIEMBRE 2026</small><strong>Informe de avance del proyecto</strong>
            <em>Preparado por el equipo de operaciones · Versión 2</em><hr />
            <b>1. Resumen</b>
            <p>Durante el tercer trimestre el proyecto avanzó según lo planificado en sus tres frentes principales. La migración de documentos históricos alcanzó el 82 % del total previsto y se incorporaron dos nuevos equipos de trabajo a la plataforma.</p>
            <p>El presupuesto ejecutado al cierre del período fue de 41,2 millones de pesos, equivalente <mark>al 68 % del monto aprobado.</mark> La diferencia responde a la postergación de la compra de licencias, que se trasladó al siguiente trimestre.</p>
            <b>2. Hitos alcanzados</b>
            <p>Se completó la revisión de contratos con proveedores y se estandarizaron los formatos de entrega. Los equipos reportan una reducción del tiempo de búsqueda de documentos cercana al 30 %, medida durante las últimas seis semanas.</p>
            <p>También se definió un responsable por área para validar los documentos antes de compartirlos con clientes externos, lo que redujo las correcciones posteriores.</p>
            <b>3. Próximos pasos</b>
            <p>Para el cierre del año se espera terminar la migración, capacitar a los equipos restantes y definir el procedimiento de respaldo mensual.</p>
          </div>
          <div className="nx-hero__toolbar">{BARRA.map(i => <span key={i} className={i === 'highlighter' ? 'activo' : ''}><Icon name={i} size={16} /></span>)}</div>
        </div>
      </section>
      <section id="funciones" className="nx-section nx-section--raised">
        <div className="nx-section__head"><h2 className="nx-h1">Cómo funciona</h2>
          <p className="nx-body nx-muted">Dos roles con espacios distintos. El administrador prepara; el cliente trabaja.</p></div>
        <div className="nx-features">{FUNCIONES.map(([icono, titulo, texto]) => <div key={titulo} className="nx-feature">
          <span className="nx-feature__icon"><Icon name={icono} size={24} /></span>
          <h3 className="nx-h3">{titulo}</h3><p className="nx-body-sm nx-muted">{texto}</p></div>)}</div>
      </section>
      <section id="herramientas" className="nx-section">
        <div className="nx-section__head"><h2 className="nx-h1">Herramientas para trabajar el documento</h2>
          <p className="nx-body nx-muted">Todo en una barra compacta que deja el PDF al centro.</p></div>
        <ul className="nx-chips" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{HERRAMIENTAS.map(([icono, nombre]) =>
          <li key={nombre} className="nx-chip"><Icon name={icono} size={20} />{nombre}</li>)}</ul>
      </section>
      <section className="nx-band">
        <div className="nx-section__head"><h2 className="nx-h2">¿Ya tienes tu cuenta?</h2>
          <p className="nx-body">Ingresa con el correo y la contraseña que te entregó tu administrador.</p></div>
        <div className="nx-band__actions"><Contacto /><Button className="nx-btn--light" onClick={entrar}>Iniciar sesión</Button></div>
      </section>
    </main>
    <footer className="nx-foot"><span>© 2026 NEXUM</span>{CORREO_CONTACTO && <span>{CORREO_CONTACTO}</span>}</footer>
  </div>
}
