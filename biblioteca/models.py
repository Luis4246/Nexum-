import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Fechas(models.Model):
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Usuario(AbstractUser, Fechas):
    es_admin = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=0)
    fallos = models.PositiveIntegerField(default=0)
    bloqueo = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["es_admin"], condition=Q(es_admin=True), name="un_administrador")]


class Cuenta(Fechas):
    PENDIENTE, HABILITADA, SUSPENDIDA, DESHABILITADA = "pendiente", "habilitada", "suspendida", "deshabilitada"
    ESTADOS = [(PENDIENTE, "Pendiente de autorización"), (HABILITADA, "Habilitada"),
               (SUSPENDIDA, "Suspendida"), (DESHABILITADA, "Deshabilitada")]

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE)
    # El acceso depende solo del estado. «suspendida» se conserva sincronizado por compatibilidad.
    estado = models.CharField(max_length=13, choices=ESTADOS, default=PENDIENTE)
    suspendida = models.BooleanField(default=False)
    nombre = models.CharField(max_length=160, blank=True)
    correo = models.CharField(max_length=254, blank=True)
    autorizada_en = models.DateTimeField(null=True, blank=True)

    def cambiar_estado(self, estado):
        self.estado = estado
        self.suspendida = estado in (self.SUSPENDIDA, self.DESHABILITADA)
        if estado == self.HABILITADA and self.autorizada_en is None:
            self.autorizada_en = timezone.now()


class Arrendatario(Fechas):
    nombre = models.CharField(max_length=160)
    contacto = models.CharField(max_length=200)


class Renta(Fechas):
    cuenta = models.ForeignKey(Cuenta, on_delete=models.SET_NULL, null=True)
    codigo = models.CharField(max_length=150)
    arrendatario = models.ForeignKey(Arrendatario, on_delete=models.PROTECT)
    inicio = models.DateField()
    fin = models.DateField()
    cerrada = models.DateField(null=True)
    cancelada = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cuenta"], condition=Q(cerrada__isnull=True), name="una_renta_abierta"),
            models.CheckConstraint(condition=Q(fin__gte=models.F("inicio")), name="periodo_valido"),
        ]


def ruta_pdf(instance, nombre):
    return f"{uuid.uuid4().hex}.pdf"


class Carpeta(Fechas):
    nombre = models.CharField(max_length=120, unique=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "nombre"]


class Documento(Fechas):
    # archivo, original, paginas y version describen siempre la versión vigente.
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    archivo = models.FileField(upload_to=ruta_pdf)
    original = models.CharField(max_length=255)
    paginas = models.PositiveIntegerField()
    version = models.PositiveIntegerField(default=1)
    carpeta = models.ForeignKey(Carpeta, on_delete=models.SET_NULL, null=True, blank=True)


class DocumentoVersion(Fechas):
    """Cada versión subida de un documento, incluida la vigente. Nunca se borra al reemplazar."""
    documento = models.ForeignKey(Documento, on_delete=models.CASCADE, related_name="versiones")
    numero = models.PositiveIntegerField()
    archivo = models.FileField(upload_to=ruta_pdf)
    original = models.CharField(max_length=255)
    paginas = models.PositiveIntegerField()
    tamano = models.PositiveBigIntegerField(default=0)

    class Meta:
        ordering = ["-numero"]
        constraints = [models.UniqueConstraint(fields=["documento", "numero"], name="version_unica")]


class AsignacionDocumento(Fechas):
    cuenta = models.ForeignKey(Cuenta, on_delete=models.CASCADE)
    documento = models.ForeignKey(Documento, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["cuenta", "documento"], name="asignacion_unica")]


class Destacado(Fechas):
    """Anotación de un cliente sobre una versión concreta de un documento."""
    RESALTADO, SUBRAYADO, DIBUJO, LAPIZ, TEXTO = "resaltado", "subrayado", "dibujo", "lapiz", "texto"
    TIPOS = [(RESALTADO, "Resaltado"), (SUBRAYADO, "Subrayado"), (DIBUJO, "Dibujo libre"),
             (LAPIZ, "Lápiz"), (TEXTO, "Texto")]

    cuenta = models.ForeignKey(Cuenta, on_delete=models.CASCADE, null=True)
    # Histórico: renta en la que se creó (anotaciones anteriores a la migración). Ya no se usa para el acceso.
    renta = models.ForeignKey(Renta, on_delete=models.SET_NULL, null=True, blank=True)
    documento = models.ForeignKey(Documento, on_delete=models.CASCADE)
    version_documento = models.PositiveIntegerField(default=1)
    tipo = models.CharField(max_length=10, choices=TIPOS, default=RESALTADO)
    pagina = models.PositiveIntegerField()
    texto = models.TextField(blank=True)
    rectangulos = models.JSONField(default=list, blank=True)
    trazos = models.JSONField(default=list, blank=True)
    contenido = models.TextField(blank=True)
    color = models.CharField(max_length=7)
    nota = models.TextField(blank=True)  # Sin uso desde que se descartaron los comentarios; se conserva.


class EventoAuditoria(Fechas):
    usuario = models.ForeignKey(Usuario, null=True, on_delete=models.SET_NULL)
    actor = models.CharField(max_length=150)
    accion = models.CharField(max_length=120)
    detalle = models.JSONField(default=dict)


class Parametros(models.Model):
    ultimo_codigo = models.PositiveBigIntegerField(default=0)
    max_mb = models.PositiveIntegerField(default=20)
    retencion = models.PositiveIntegerField(default=30)



