import secrets

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoError
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import Cuenta, EventoAuditoria, Renta


def registrar(usuario, accion, **detalle):
    EventoAuditoria.objects.create(usuario=usuario, actor=usuario.username if usuario else "sistema",
                                  accion=accion, detalle=detalle)


def invalidar(usuario):
    usuario.version += 1
    usuario.save(update_fields=["version"])
    for token in OutstandingToken.objects.filter(user=usuario, blacklistedtoken__isnull=True):
        BlacklistedToken.objects.get_or_create(token=token)


def clave_nueva(usuario, clave=None):
    clave = clave if clave is not None else secrets.token_urlsafe(16)
    try:
        validate_password(clave, usuario)
    except DjangoError as error:
        raise ValidationError({"clave": error.messages})
    usuario.set_password(clave)
    usuario.fallos = 0
    usuario.bloqueo = None
    usuario.save()
    invalidar(usuario)
    return clave


def cuenta_de(usuario):
    return Cuenta.objects.filter(usuario=usuario).first()


def cuenta_habilitada(usuario):
    """El acceso del cliente depende solo del estado de su cuenta, sin fechas."""
    return Cuenta.objects.filter(usuario=usuario, estado=Cuenta.HABILITADA).first()


def renta_activa(usuario):
    """Histórico: ya no decide el acceso. Se conserva para consultas del historial de rentas."""
    hoy = timezone.localdate()
    return Renta.objects.filter(cuenta__usuario=usuario, cuenta__suspendida=False,
                                cerrada=None, inicio__lte=hoy, fin__gte=hoy).first()


def mantenimiento():
    """Sin tareas desde el cambio a cuentas autorizadas.

    Antes cerraba rentas vencidas, cambiaba la contraseña de esas cuentas y borraba anotaciones
    pasada la retención. Ya no hay vencimiento y las anotaciones no deben perderse, así que no hace
    nada; se mantiene para no romper el middleware ni el comando programado en Windows.
    """
    return None

