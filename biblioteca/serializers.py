from rest_framework import serializers as s

from .models import Carpeta, Cuenta, Destacado, Documento, DocumentoVersion


class CuentaEntrada(s.Serializer):
    codigo = s.RegexField(r"^[\w.@+-]+$", max_length=130, required=False)
    cantidad = s.IntegerField(default=1, min_value=1, max_value=500)
    clave = s.CharField(required=False, trim_whitespace=False, max_length=128)
    nombre = s.CharField(max_length=160, required=False, allow_blank=True)
    correo = s.EmailField(max_length=254, required=False, allow_blank=True)
    estado = s.ChoiceField([Cuenta.PENDIENTE, Cuenta.HABILITADA], default=Cuenta.PENDIENTE)


class CuentaEdicion(s.Serializer):
    codigo = s.RegexField(r"^[\w.@+-]+$", max_length=130, required=False)
    nombre = s.CharField(max_length=160, required=False, allow_blank=True)
    correo = s.EmailField(max_length=254, required=False, allow_blank=True)


class CuentaSalida(s.ModelSerializer):
    codigo = s.CharField(source="usuario.username")

    class Meta:
        model = Cuenta
        fields = ["id", "codigo", "estado", "nombre", "correo", "creado_en", "autorizada_en"]


class Asignaciones(s.Serializer):
    cuentas = s.ListField(child=s.IntegerField(min_value=1), allow_empty=False)
    documentos = s.ListField(child=s.IntegerField(min_value=1), allow_empty=False)


class Configuracion(s.Serializer):
    max_mb = s.IntegerField(min_value=1, max_value=1024)
    retencion = s.IntegerField(min_value=0, max_value=3650)


class CarpetaSerializer(s.ModelSerializer):
    nombre = s.CharField(max_length=120, trim_whitespace=True)

    class Meta:
        model = Carpeta
        fields = ["id", "nombre", "orden"]


class CarpetaBreve(s.ModelSerializer):
    class Meta:
        model = Carpeta
        fields = ["id", "nombre"]


class VersionSalida(s.ModelSerializer):
    class Meta:
        model = DocumentoVersion
        fields = ["numero", "original", "paginas", "tamano", "creado_en"]


class DocumentoSalida(s.ModelSerializer):
    carpeta = CarpetaBreve(read_only=True)
    tamano = s.SerializerMethodField()
    versiones = s.SerializerMethodField()

    def _versiones(self, doc):
        return list(doc.versiones.all())

    def get_tamano(self, doc):
        actual = next((v for v in self._versiones(doc) if v.numero == doc.version), None)
        return actual.tamano if actual else None

    def get_versiones(self, doc):
        return VersionSalida(self._versiones(doc), many=True).data

    class Meta:
        model = Documento
        fields = ["id", "titulo", "descripcion", "original", "version", "paginas", "carpeta", "tamano",
                  "versiones", "creado_en", "actualizado_en"]


class DocumentoEdicion(s.Serializer):
    titulo = s.CharField(max_length=200, required=False)
    descripcion = s.CharField(required=False, allow_blank=True)
    carpeta = s.IntegerField(min_value=1, required=False, allow_null=True)


def Unidad():
    return s.FloatField(min_value=0, max_value=1)
LIMITE_PUNTOS = 4000


class Trazo(s.Serializer):
    puntos = s.ListField(child=s.ListField(child=Unidad(), min_length=2, max_length=2), min_length=1,
                         max_length=LIMITE_PUNTOS)
    grosor = s.FloatField(min_value=0.0005, max_value=0.05)


class Marca(s.ModelSerializer):
    """Anotación. Cada tipo exige sus propios datos; un POST con el formato antiguo crea un resaltado."""
    tipo = s.ChoiceField([t for t, _ in Destacado.TIPOS], default=Destacado.RESALTADO)
    color = s.RegexField(r"^#[a-fA-F0-9]{6}$")
    texto = s.CharField(max_length=10000, required=False, allow_blank=True)
    nota = s.CharField(max_length=5000, required=False, allow_blank=True)
    contenido = s.CharField(max_length=2000, required=False, allow_blank=True)
    pagina = s.IntegerField(min_value=1)
    rectangulos = s.ListField(child=s.ListField(child=Unidad(), min_length=4, max_length=4),
                              required=False, max_length=500)
    trazos = s.ListField(child=Trazo(), required=False, max_length=200)

    def validate_rectangulos(self, rectangulos):
        for x, y, ancho, alto in rectangulos:
            if not (0 < ancho <= 1 and 0 < alto <= 1 and x + ancho <= 1.001 and y + alto <= 1.001):
                raise s.ValidationError("Selección fuera de la página.")
        return rectangulos

    def validate(self, datos):
        if self.partial:
            return datos
        tipo = datos.get("tipo", Destacado.RESALTADO)
        rect, trazos = datos.get("rectangulos") or [], datos.get("trazos") or []
        if tipo in (Destacado.RESALTADO, Destacado.SUBRAYADO):
            if not rect or not datos.get("texto", "").strip():
                raise s.ValidationError("Selecciona el texto que quieres marcar.")
            datos["trazos"], datos["contenido"] = [], ""
        elif tipo in (Destacado.DIBUJO, Destacado.LAPIZ):
            if not trazos:
                raise s.ValidationError("El dibujo no tiene trazos.")
            if sum(len(t["puntos"]) for t in trazos) > LIMITE_PUNTOS:
                raise s.ValidationError("El dibujo es demasiado extenso. Divídelo en partes.")
            datos["rectangulos"], datos["texto"], datos["contenido"] = [], "", ""
        else:
            if len(rect) != 1 or not datos.get("contenido", "").strip():
                raise s.ValidationError("Escribe el texto y su posición en la página.")
            datos["trazos"], datos["texto"] = [], ""
        datos.setdefault("rectangulos", rect)
        datos.setdefault("trazos", trazos)
        return datos

    class Meta:
        model = Destacado
        read_only_fields = ["version_documento"]
        fields = ["id", "version_documento", "tipo", "pagina", "texto", "color", "nota", "contenido",
                  "rectangulos", "trazos", "creado_en"]


class Lote(s.Serializer):
    version_documento = s.IntegerField(min_value=1)
    crear = s.ListField(child=s.DictField(), required=False, max_length=500, default=list)
    eliminar = s.ListField(child=s.IntegerField(min_value=1), required=False, max_length=500, default=list)


def validar(clase, datos, **kwargs):
    intento = clase(data=datos, **kwargs)
    intento.is_valid(raise_exception=True)
    return intento.validated_data
