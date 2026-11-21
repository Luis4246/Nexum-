"""Completa los campos nuevos a partir de los datos existentes, sin borrar nada.

- Estado de cada cuenta: suspendida → suspendida; con una renta vigente hoy → habilitada; si no → pendiente.
- Nombre y correo de cada cuenta: del arrendatario de su última renta (el contacto solo si parece un correo).
- Versiones: registra la versión vigente de cada documento con su archivo actual.
- Anotaciones: las une a la cuenta de su renta y las marca como resaltado.

Las rentas y los arrendatarios quedan intactos como historial. La reversión no borra datos.
"""
import re

from django.db import migrations
from django.utils import timezone

CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def migrar(apps, schema_editor):
    Cuenta = apps.get_model("biblioteca", "Cuenta")
    Renta = apps.get_model("biblioteca", "Renta")
    Documento = apps.get_model("biblioteca", "Documento")
    DocumentoVersion = apps.get_model("biblioteca", "DocumentoVersion")
    Destacado = apps.get_model("biblioteca", "Destacado")
    hoy = timezone.localdate()

    for cuenta in Cuenta.objects.all():
        rentas = Renta.objects.filter(cuenta=cuenta).select_related("arrendatario").order_by("-id")
        vigente = rentas.filter(cerrada__isnull=True, inicio__lte=hoy, fin__gte=hoy).first()
        if cuenta.suspendida:
            cuenta.estado = "suspendida"
        elif vigente:
            cuenta.estado = "habilitada"
            cuenta.autorizada_en = vigente.creado_en
        else:
            cuenta.estado = "pendiente"
        ultima = rentas.first()
        if ultima and not cuenta.nombre:
            cuenta.nombre = ultima.arrendatario.nombre[:160]
            contacto = (ultima.arrendatario.contacto or "").strip()
            if CORREO.match(contacto):
                cuenta.correo = contacto[:254]
        cuenta.save(update_fields=["estado", "autorizada_en", "nombre", "correo"])

    for doc in Documento.objects.all():
        if DocumentoVersion.objects.filter(documento=doc, numero=doc.version).exists():
            continue
        try:
            tamano = doc.archivo.size
        except (FileNotFoundError, OSError, ValueError):
            tamano = 0
        DocumentoVersion.objects.create(documento=doc, numero=doc.version, archivo=doc.archivo.name,
                                        original=doc.original, paginas=doc.paginas, tamano=tamano)

    for marca in Destacado.objects.filter(cuenta__isnull=True).select_related("renta"):
        if marca.renta_id and marca.renta.cuenta_id:
            marca.cuenta_id = marca.renta.cuenta_id
        marca.tipo = "resaltado"
        marca.save(update_fields=["cuenta", "tipo"])


class Migration(migrations.Migration):
    dependencies = [("biblioteca", "0004_estados_carpetas_versiones_anotaciones")]
    operations = [migrations.RunPython(migrar, migrations.RunPython.noop)]
