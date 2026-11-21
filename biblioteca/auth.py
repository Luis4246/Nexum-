from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario
from .services import cuenta_de, cuenta_habilitada, mantenimiento, registrar


class MantenimientoMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/"):
            mantenimiento()
        return self.get_response(request)


def habilitado(usuario):
    return usuario.is_active and (usuario.es_admin or cuenta_habilitada(usuario) is not None)


MOTIVOS = {
    "pendiente": "Tu cuenta está pendiente de autorización.",
    "suspendida": "Tu cuenta está suspendida. Contacta a tu administrador.",
    "deshabilitada": "Tu cuenta está deshabilitada. Contacta a tu administrador.",
}


def motivo(usuario):
    cuenta = None if usuario.es_admin else cuenta_de(usuario)
    estado = cuenta.estado if cuenta and usuario.is_active else "deshabilitada"
    return estado if estado in MOTIVOS else "deshabilitada"


class AutenticacionJWT(JWTAuthentication):
    def get_user(self, validated_token):
        usuario = super().get_user(validated_token)
        if validated_token.get("version") != usuario.version or not habilitado(usuario):
            raise AuthenticationFailed("La sesión ya no está vigente.")
        return usuario


@transaction.atomic
def login(request):
    nombre, clave = request.data.get("username"), request.data.get("password")
    if not isinstance(nombre, str) or not isinstance(clave, str):
        raise ValidationError("Ingresa el usuario y la contraseña.")
    usuario = Usuario.objects.filter(username=nombre).first()
    ahora = timezone.now()
    if usuario and usuario.bloqueo and usuario.bloqueo > ahora:
        return Response({"detail": "Cuenta bloqueada temporalmente."}, status=429)
    if not usuario or not usuario.check_password(clave):
        if usuario:
            usuario.fallos = 1 if usuario.bloqueo else usuario.fallos + 1
            usuario.bloqueo = ahora + timedelta(minutes=15) if usuario.fallos >= 5 else None
            usuario.save()
            registrar(usuario, "login.fallido")
        return Response({"detail": "Credenciales incorrectas."}, status=401)
    usuario.fallos = 0
    usuario.bloqueo = None
    usuario.save()
    if not habilitado(usuario):
        causa = motivo(usuario)
        registrar(usuario, "login.denegado", motivo=causa)
        return Response({"detail": MOTIVOS[causa], "motivo": causa}, status=403)
    refresh = RefreshToken.for_user(usuario)
    refresh["version"] = usuario.version
    registrar(usuario, "login")
    return Response({"access": str(refresh.access_token), "refresh": str(refresh),
                     "usuario": usuario.username, "admin": usuario.es_admin})


def token_refresco(request):
    try:
        return RefreshToken(request.data.get("refresh") or "inválido")
    except (TokenError, TypeError):
        raise AuthenticationFailed("Token de refresco inválido.")


@transaction.atomic
def refrescar(request):
    token = token_refresco(request)
    usuario = Usuario.objects.filter(pk=token["user_id"]).first()
    if not usuario or token.get("version") != usuario.version or not habilitado(usuario):
        raise AuthenticationFailed("Sesión vencida.")
    return Response({"access": str(token.access_token)})


@transaction.atomic
def salir(request):
    token = token_refresco(request)
    if str(token["user_id"]) != str(request.user.pk):
        raise AuthenticationFailed("Token de otra cuenta.")
    token.blacklist()
    registrar(request.user, "logout")
    return Response(status=204)

