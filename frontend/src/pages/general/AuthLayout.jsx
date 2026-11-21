import Logo from '../../components/Logo'

// G-02 a G-04: panel de marca azul noche de 560 px a la izquierda y el contenido centrado a la derecha.
export default function AuthLayout({ children }) {
  return <div className="nx-auth">
    <aside className="nx-auth__brand">
      <a href="#/" aria-label="NEXUM, ir al inicio"><Logo tono="claro" ancho={150} /></a>
      <div className="nx-auth__mark" aria-hidden="true"><Logo variante="isotipo" tono="claro" ancho={200} /></div>
      <div className="nx-auth__message">
        <p className="nx-h1" style={{ color: 'var(--nx-text-on-inverse)' }}>Tus documentos, en un espacio de trabajo privado.</p>
        <p className="nx-body-sm">El acceso se otorga solo con una cuenta creada por el administrador.</p>
      </div>
    </aside>
    <main className="nx-auth__main">{children}</main>
  </div>
}
