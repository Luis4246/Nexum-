from django.urls import path
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from . import auth, contenido, cuentas
from .permissions import Administrador, Cliente


def ruta(url, methods, permiso, funcion):
    if permiso is AllowAny:
        funcion = authentication_classes([])(funcion)
    return path(url, api_view(methods)(permission_classes([permiso])(funcion)))


urlpatterns = [
    ruta("auth/login/", ["POST"], AllowAny, auth.login),
    ruta("auth/refrescar/", ["POST"], AllowAny, auth.refrescar),
    ruta("auth/salir/", ["POST"], IsAuthenticated, auth.salir),
    ruta("cuentas/", ["GET", "POST"], Administrador, cuentas.cuentas),
    ruta("cuentas/<int:pk>/", ["PATCH"], Administrador, cuentas.cuenta),
    ruta("cuentas/<int:pk>/<str:accion>/", ["POST"], Administrador, cuentas.operar_cuenta),
    ruta("rentas/", ["GET", "POST"], Administrador, cuentas.rentas),
    ruta("rentas/<int:pk>/<str:accion>/", ["POST"], Administrador, cuentas.operar_renta),
    ruta("parametros/", ["GET", "PUT"], Administrador, cuentas.parametros),
    ruta("auditoria/", ["GET"], Administrador, cuentas.auditoria),
    ruta("documentos/", ["GET", "POST"], Administrador, contenido.documentos),
    ruta("documentos/<int:pk>/", ["DELETE", "PUT", "PATCH"], Administrador, contenido.documento),
    ruta("documentos/<int:pk>/versiones/", ["GET"], Administrador, contenido.versiones),
    ruta("carpetas/", ["GET", "POST"], Administrador, contenido.carpetas),
    ruta("carpetas/<int:pk>/", ["PATCH", "DELETE"], Administrador, contenido.carpeta),
    ruta("asignaciones/", ["POST", "DELETE"], Administrador, contenido.asignaciones),
    ruta("biblioteca/", ["GET"], Cliente, contenido.biblioteca),
    ruta("biblioteca/<int:pk>/contenido/", ["GET"], Cliente, contenido.contenido),
    ruta("biblioteca/<int:pk>/destacados/", ["GET", "POST"], Cliente, contenido.destacados),
    ruta("biblioteca/<int:pk>/destacados/lote/", ["POST"], Cliente, contenido.lote),
    ruta("biblioteca/<int:pk>/destacados/<int:marca>/", ["PATCH", "DELETE"], Cliente, contenido.destacados),
]

