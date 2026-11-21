from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Cuenta, Destacado, EventoAuditoria, Parametros, Renta, Usuario
from .serializers import Configuracion, CuentaEdicion, CuentaEntrada, CuentaSalida, validar
from .services import clave_nueva, invalidar, registrar

# Acción → (estados de origen permitidos, estado de destino)
TRANSICIONES = {
    "autorizar": ({Cuenta.PENDIENTE}, Cuenta.HABILITADA),
    "habilitar": ({Cuenta.SUSPENDIDA, Cuenta.DESHABILITADA, Cuenta.PENDIENTE}, Cuenta.HABILITADA),
    "reactivar": ({Cuenta.SUSPENDIDA, Cuenta.DESHABILITADA}, Cuenta.HABILITADA),
    "suspender": ({Cuenta.HABILITADA, Cuenta.PENDIENTE}, Cuenta.SUSPENDIDA),
    "deshabilitar": ({Cuenta.HABILITADA, Cuenta.PENDIENTE, Cuenta.SUSPENDIDA}, Cuenta.DESHABILITADA),
}
SIN_RENTAS = "NEXUM ya no usa rentas: el acceso depende del estado de la cuenta. El historial de rentas sigue disponible."


def salida(cuenta):
    return CuentaSalida(cuenta).data


@transaction.atomic
def cuentas(request):
    if request.method == "GET":
        qs = Cuenta.objects.select_related("usuario").order_by("usuario__username")
        estado = request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        return Response(CuentaSalida(qs, many=True).data)
    datos = validar(CuentaEntrada, request.data)
    serie = None
    if "codigo" not in datos:
        serie, _ = Parametros.objects.select_for_update().get_or_create(pk=1)
    creadas = []
    for i in range(1, datos["cantidad"] + 1):
        if serie is None:
            codigo = datos["codigo"] if datos["cantidad"] == 1 else f"{datos['codigo']}{i:03}"
        else:
            while True:
                serie.ultimo_codigo += 1
                codigo = f"cliente{serie.ultimo_codigo:03}"
                if not Usuario.objects.filter(username=codigo).exists() and not Renta.objects.filter(codigo=codigo).exists():
                    break
        if Usuario.objects.filter(username=codigo).exists():
            raise ValidationError(f"El código {codigo} ya existe.")
        usuario = Usuario.objects.create_user(username=codigo)
        clave = clave_nueva(usuario, datos.get("clave"))
        cuenta = Cuenta(usuario=usuario, nombre=datos.get("nombre", "") if datos["cantidad"] == 1 else "",
                        correo=datos.get("correo", "") if datos["cantidad"] == 1 else "")
        cuenta.cambiar_estado(datos["estado"])
        cuenta.save()
        registrar(request.user, "cuenta.crear", cuenta=cuenta.pk, codigo=codigo, estado=cuenta.estado)
        creadas.append({**salida(cuenta), "clave": clave})
    if serie is not None:
        serie.save(update_fields=["ultimo_codigo"])
    return Response(creadas, status=201)


@transaction.atomic
def cuenta(request, pk):
    """Edición de los datos del cliente. Solo el administrador puede hacerlo."""
    objeto = get_object_or_404(Cuenta.objects.select_related("usuario"), pk=pk)
    datos = validar(CuentaEdicion, request.data)
    if "codigo" in datos and datos["codigo"] != objeto.usuario.username:
        if Usuario.objects.filter(username=datos["codigo"]).exists():
            raise ValidationError(f"El código {datos['codigo']} ya existe.")
        objeto.usuario.username = datos["codigo"]
        objeto.usuario.save(update_fields=["username"])
    for campo in ("nombre", "correo"):
        if campo in datos:
            setattr(objeto, campo, datos[campo])
    objeto.save()
    registrar(request.user, "cuenta.editar", cuenta=pk, campos=sorted(datos))
    return Response(salida(objeto))


@transaction.atomic
def operar_cuenta(request, pk, accion):
    objeto = get_object_or_404(Cuenta.objects.select_related("usuario"), pk=pk)
    respuesta = {}
    if accion == "eliminar":
        Destacado.objects.filter(cuenta=objeto).delete()
        objeto.usuario.delete()
    elif accion in TRANSICIONES:
        origen, destino = TRANSICIONES[accion]
        if objeto.estado not in origen:
            raise ValidationError(f"No se puede {accion} una cuenta en estado {objeto.estado}.")
        objeto.cambiar_estado(destino)
        objeto.save()
        if destino != Cuenta.HABILITADA:
            invalidar(objeto.usuario)
        respuesta = salida(objeto)
    elif accion == "clave":
        clave = request.data.get("clave")
        if clave is not None and not isinstance(clave, str):
            raise ValidationError("La clave debe ser texto.")
        respuesta["clave"] = clave_nueva(objeto.usuario, clave)
    elif accion == "liberar":
        return Response({"detail": "«Liberar» ya no aplica sin rentas. Usa «deshabilitar» y, si hace falta, "
                                   "genera una contraseña nueva."}, status=410)
    else:
        raise ValidationError("Operación inválida.")
    registrar(request.user, f"cuenta.{accion}", cuenta=pk)
    return Response(respuesta)


def rentas(request):
    if request.method != "GET":
        return Response({"detail": SIN_RENTAS}, status=410)
    qs = Renta.objects.select_related("arrendatario").order_by("-id")
    for campo in ("cuenta", "arrendatario"):
        valor = request.query_params.get(campo)
        if valor:
            if not valor.isdecimal():
                raise ValidationError("Filtro inválido.")
            qs = qs.filter(**{campo: valor})
    return Response([{"id": r.pk, "cuenta": r.cuenta_id, "codigo": r.codigo,
                      "arrendatario": r.arrendatario_id, "nombre": r.arrendatario.nombre,
                      "contacto": r.arrendatario.contacto, "inicio": r.inicio, "fin": r.fin,
                      "estado": ("cancelada" if r.cancelada else "finalizada") if r.cerrada
                      else ("programada" if r.inicio > timezone.localdate() else "activa")} for r in qs])


def operar_renta(request, pk, accion):
    return Response({"detail": SIN_RENTAS}, status=410)


@transaction.atomic
def parametros(request):
    config = Parametros.objects.get_or_create(pk=1)[0]
    if request.method == "PUT":
        for campo, valor in validar(Configuracion, request.data).items():
            setattr(config, campo, valor)
        config.save()
        registrar(request.user, "parametros.actualizar", max_mb=config.max_mb, retencion=config.retencion)
    return Response(Configuracion(config).data)


def auditoria(request):
    eventos = EventoAuditoria.objects.order_by("-pk")
    antes = request.query_params.get("antes")
    if antes:
        if not antes.isdecimal():
            raise ValidationError("Cursor inválido.")
        eventos = eventos.filter(pk__lt=antes)
    return Response(list(eventos.values("id", "creado_en", "actor", "accion", "detalle")[:100]))
