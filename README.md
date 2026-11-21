# NEXUM

Plataforma privada de gestión y anotación de PDF, con dos roles: administrador y cliente. El backend Django utiliza SQLite y almacena los archivos en `privado/`. El panel React se encuentra en `frontend/`. La aplicación Django `biblioteca/` concentra los modelos, la autenticación, los permisos, los servicios y las rutas bajo `/api/`.

## Estructura del proyecto

```text
manage.py              Comandos del backend Django
requirements.txt       Dependencias de Python
config/                Configuración, rutas principales y arranque de Django
biblioteca/            Aplicación de cuentas, carpetas, documentos, versiones y anotaciones
  management/commands/ Comandos de administración y mantenimiento
  migrations/          Historial del esquema de la base de datos
frontend/              Interfaz React (Vite)
  src/styles/          Tokens del diseño (colores, tipografía, espaciado) y estilos por capa
  src/components/      Componentes base: botones, campos, menús, overlays, avisos, navegación
  src/overlays/        Ventanas superpuestas (subir, crear cuenta, asignar, editar, confirmar)
  src/pages/           Pantallas: general (acceso), admin y cliente
  src/visor/           Visor y editor PDF del cliente
  src/services/        Llamadas a la API agrupadas por área
db.sqlite3             Base de datos local
privado/               Archivos PDF de los usuarios
```

## Inicio en Windows

Desde la carpeta que contiene `manage.py`, con Python 3.13 y Node.js 22.12 o superior:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py crear_admin administrador
.\.venv\Scripts\python manage.py runserver 127.0.0.1:8000
```

El comando de instalación del administrador solicita su contraseña de forma interactiva. Solo se ejecuta una vez. Para iniciar el frontend, abre otra terminal en la misma carpeta:

```powershell
npm.cmd ci --prefix frontend
npm.cmd run dev --prefix frontend
```

Abre [la biblioteca local](http://localhost:5173). Vite envía las peticiones de `/api/` al backend del puerto 8000.

## Primer uso

1. Inicia sesión como administrador. Con **Crear cuenta** registra al cliente con su nombre, correo y contraseña, y elige si queda **Activa** o **Pendiente de autorización**. Entrega los datos de acceso por un medio seguro: la contraseña solo se muestra una vez.
2. En **Documentos**, crea carpetas y sube los PDF. Al subirlos puedes elegir la carpeta y los clientes que los verán.
3. El cliente entra con su correo y contraseña, ve sus documentos ordenados por carpeta y los abre en el visor. Puede resaltar, subrayar, dibujar, escribir con lápiz y agregar texto. Los cambios se guardan con el botón **Guardar**. Los clientes no pueden descargar documentos.
4. Para reemplazar un PDF, abre **Editar** en el documento y usa **Subir nueva versión**. La versión anterior y sus anotaciones se conservan y el cliente puede consultarlas en modo de solo lectura; la versión nueva empieza sin anotaciones.

## Estados de las cuentas

Una cuenta puede estar **Activa**, **Pendiente**, **Suspendida** (bloqueo temporal) o **Deshabilitada** (cierre). Solo las cuentas activas pueden iniciar sesión, y el backend lo comprueba en cada petición. Ningún cambio de estado borra documentos asignados ni anotaciones, y todos son reversibles desde el detalle del cliente. Al suspender, deshabilitar o cambiar la contraseña se cierran las sesiones abiertas de ese cliente; un visor abierto lo detecta en un máximo de 15 segundos.

## Operación local

Cinco intentos fallidos de inicio de sesión bloquean la cuenta durante 15 minutos. En **Configuración** se ajusta el tamaño máximo por PDF (20 MB por defecto) y se consulta el registro de actividad. Los PDF se guardan en `privado/` con nombres aleatorios y solo se entregan a través de la API a quien tiene el documento asignado.

El comando `manage.py mantenimiento` se conserva por compatibilidad, pero ya no realiza tareas: el acceso dejó de depender de fechas de renta y las anotaciones no se purgan.

## Verificación

```powershell
.\.venv\Scripts\python manage.py test
npm.cmd run build --prefix frontend
```



## Despliegue en Render

1. En Render abre **New → Blueprint**, conecta el repositorio **Luis4246/Nexum-**, selecciona la rama **main** y el archivo **render.yaml**. Revisa el costo antes de aplicar. El backend utiliza una instancia de pago con un disco persistente de 1 GB. SQLite y los PDF privados se guardan en ese disco y las migraciones se ejecutan al iniciar el servicio.
2. El Blueprint pide **FRONTEND_ORIGIN** para Django (URL HTTPS del Static Site, sin ruta) y **VITE_API_URL** para React (URL HTTPS del Web Service seguida de `/api/`). Si todavía desconoces las direcciones, usa temporalmente `https://frontend.invalid` y `https://api.invalid/api/`. Render genera la clave secreta del backend.
3. Después de crear ambos servicios, copia sus URL reales desde el panel. En **Environment** de cada servicio reemplaza los valores provisionales. Guarda y redespliega el backend, y selecciona **Save, rebuild, and deploy** en el frontend para incorporar la URL de la API al JavaScript.
4. En **Shell** del Web Service ejecuta `python manage.py crear_admin administrador` una sola vez. Ingresa la contraseña cuando se solicite. La base de producción empieza vacía. Los usuarios y PDF de tu PC están excluidos de Git.
5. Abre el enlace del Static Site, inicia sesión, carga un PDF de prueba y comprueba que puedes abrirlo después de reiniciar el backend. Los siguientes cambios se publican enviando commits a la rama conectada.
