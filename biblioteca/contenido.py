from pathlib import Path

from django.db import IntegrityError, transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from pypdf import PdfReader
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from .models import AsignacionDocumento, Carpeta, Cuenta, Destacado, Documento, DocumentoVersion, Parametros
from .serializers import (Asignaciones, CarpetaSerializer, DocumentoEdicion, DocumentoSalida, Lote, Marca,
                          VersionSalida, validar)
from .services import cuenta_habilitada, registrar


def paginas_pdf(archivo, max_mb):
    if archivo.size > max_mb * 1024 * 1024:
        raise ValidationError(f"El máximo permitido es {max_mb} MB por archivo.")
    try:
        if archivo.read(5) != b"%PDF-":
            raise ValueError
        archivo.seek(0)
        pdf = PdfReader(archivo, strict=True)
        if pdf.is_encrypted or not len(pdf.pages):
            raise ValueError
        return len(pdf.pages)
    except Exception:
        raise ValidationError("Selecciona un PDF válido, con páginas y sin contraseña.")
    finally:
        archivo.seek(0)


def carpeta_de(valor):
    if valor in (None, "", "null"):
        return None
    if not str(valor).isdecimal():
        raise ValidationError("Carpeta inválida.")
    return get_object_or_404(Carpeta, pk=valor)


def documentos_qs():
    return Documento.objects.select_related("carpeta").prefetch_related("versiones")


def guardar(request, reemplazo=None):
    """Sube documentos nuevos o una versión nueva de uno existente.

    Al reemplazar, la versión anterior se conserva con su archivo y sus anotaciones.
    """
    archivos = request.FILES.getlist("archivos")
    if not archivos or (reemplazo and len(archivos) != 1):
        raise ValidationError("Selecciona los archivos PDF.")
    titulo = request.data.get("titulo", "").strip()
    descripcion = request.data.get("descripcion", "")
    carpeta = None if reemplazo else carpeta_de(request.data.get("carpeta"))
    limite = Parametros.objects.get_or_create(pk=1)[0].max_mb
    paginas = [paginas_pdf(f, limite) for f in archivos]
    escritos, resultados = [], []
    try:
        with transaction.atomic():
            for archivo, cantidad in zip(archivos, paginas):
                doc = get_object_or_404(Documento, pk=reemplazo) if reemplazo else Documento()
                if reemplazo:
                    doc.version += 1
                else:
                    doc.titulo = titulo or Path(archivo.name).stem
                    doc.descripcion = descripcion
                    doc.carpeta = carpeta
                if len(doc.titulo) > 200:
                    raise ValidationError("El título supera los 200 caracteres.")
                doc.original, doc.paginas = archivo.name, cantidad
                doc.archivo.save(archivo.name, archivo, save=False)
                escritos.append((doc.archivo.storage, doc.archivo.name))
                doc.save()
                DocumentoVersion.objects.create(documento=doc, numero=doc.version, archivo=doc.archivo.name,
                                                original=archivo.name, paginas=cantidad, tamano=archivo.size)
                registrar(request.user, "documento.reemplazar" if reemplazo else "documento.subir",
                          documento=doc.pk, version=doc.version)
                resultados.append(DocumentoSalida(documentos_qs().get(pk=doc.pk)).data)
    except Exception:
        for almacen, nombre in escritos:
            if not Documento.objects.filter(archivo=nombre).exists():
                almacen.delete(nombre)
        raise
    return Response(resultados, status=200 if reemplazo else 201)


def documentos(request):
    if request.method == "POST":
        return guardar(request)
    docs = documentos_qs().prefetch_related("asignaciondocumento_set").order_by("titulo")
    return Response([{**DocumentoSalida(d).data, "cuentas": [a.cuenta_id for a in d.asignaciondocumento_set.all()]}
                     for d in docs])


def documento(request, pk):
    if request.method == "PUT":
        return guardar(request, pk)
    if request.method == "PATCH":
        with transaction.atomic():
            doc = get_object_or_404(Documento, pk=pk)
            datos = validar(DocumentoEdicion, request.data)
            if "titulo" in datos:
                if not datos["titulo"].strip():
                    raise ValidationError("El título no puede quedar vacío.")
                doc.titulo = datos["titulo"].strip()
            if "descripcion" in datos:
                doc.descripcion = datos["descripcion"]
            if "carpeta" in datos:
                doc.carpeta = carpeta_de(datos["carpeta"])
            doc.save()
            registrar(request.user, "documento.editar", documento=pk, campos=sorted(datos))
        return Response(DocumentoSalida(documentos_qs().get(pk=pk)).data)
    with transaction.atomic():
        doc = get_object_or_404(Documento, pk=pk)
        archivos = {(doc.archivo.storage, doc.archivo.name)}
        archivos |= {(v.archivo.storage, v.archivo.name) for v in doc.versiones.all()}
        doc.delete()
        transaction.on_commit(lambda: [almacen.delete(nombre) for almacen, nombre in archivos])
        registrar(request.user, "documento.eliminar", documento=pk)
    return Response(status=204)


def versiones(request, pk):
    doc = get_object_or_404(Documento, pk=pk)
    return Response(VersionSalida(doc.versiones.all(), many=True).data)


@transaction.atomic
def carpetas(request):
    if request.method == "GET":
        return Response(CarpetaSerializer(Carpeta.objects.order_by("orden", "pk"), many=True).data)
    serie = CarpetaSerializer(data=request.data)
    serie.is_valid(raise_exception=True)
    if Carpeta.objects.filter(nombre__iexact=serie.validated_data["nombre"]).exists():
        raise ValidationError("Ya existe una carpeta con ese nombre.")
    carpeta = serie.save()
    registrar(request.user, "carpeta.crear", carpeta=carpeta.pk)
    return Response(CarpetaSerializer(carpeta).data, status=201)


@transaction.atomic
def carpeta(request, pk):
    objeto = get_object_or_404(Carpeta, pk=pk)
    if request.method == "DELETE":
        # Los documentos no se borran: quedan sin carpeta.
        cantidad = Documento.objects.filter(carpeta=objeto).update(carpeta=None)
        objeto.delete()
        registrar(request.user, "carpeta.eliminar", carpeta=pk, documentos=cantidad)
        return Response(status=204)
    serie = CarpetaSerializer(objeto, data=request.data, partial=True)
    serie.is_valid(raise_exception=True)
    nombre = serie.validated_data.get("nombre")
    if nombre and Carpeta.objects.filter(nombre__iexact=nombre).exclude(pk=pk).exists():
        raise ValidationError("Ya existe una carpeta con ese nombre.")
    try:
        serie.save()
    except IntegrityError:
        raise ValidationError("Ya existe una carpeta con ese nombre.")
    registrar(request.user, "carpeta.editar", carpeta=pk)
    return Response(serie.data)


@transaction.atomic
def asignaciones(request):
    datos = validar(Asignaciones, request.data)
    cuentas, docs = set(datos["cuentas"]), set(datos["documentos"])
    if Cuenta.objects.filter(pk__in=cuentas).count() != len(cuentas) or Documento.objects.filter(pk__in=docs).count() != len(docs):
        raise ValidationError("Una cuenta o documento ya no existe.")
    if request.method == "POST":
        for cuenta in cuentas:
            for doc in docs:
                AsignacionDocumento.objects.get_or_create(cuenta_id=cuenta, documento_id=doc)
    else:
        AsignacionDocumento.objects.filter(cuenta_id__in=cuentas, documento_id__in=docs).delete()
    registrar(request.user, "documentos.asignar" if request.method == "POST" else "documentos.quitar", **datos)
    return Response(status=204)


def asignados(request):
    """Cuenta habilitada del cliente y los documentos asignados a ella. Se valida en cada petición."""
    usuario = request.user
    usuario.refresh_from_db()
    if usuario.version != request.auth.get("version"):
        raise NotFound()
    cuenta = cuenta_habilitada(usuario)
    if not cuenta:
        raise NotFound()
    return cuenta, documentos_qs().filter(asignaciondocumento__cuenta=cuenta)


def biblioteca(request):
    cuenta, docs = asignados(request)
    fechas = dict(AsignacionDocumento.objects.filter(cuenta=cuenta).values_list("documento_id", "creado_en"))
    return Response([{**DocumentoSalida(d).data, "asignado_en": fechas.get(d.pk)} for d in docs.order_by("titulo")])


def version_pedida(request, doc):
    valor = request.query_params.get("version")
    if valor in (None, ""):
        return doc.version
    if not valor.isdecimal():
        raise ValidationError("Versión inválida.")
    return int(valor)


@transaction.atomic
def contenido(request, pk):
    _, docs = asignados(request)
    doc = get_object_or_404(docs, pk=pk)
    numero = version_pedida(request, doc)
    version = get_object_or_404(DocumentoVersion, documento=doc, numero=numero)
    registrar(request.user, "documento.abrir", documento=pk, version=numero)
    response = FileResponse(version.archivo.open("rb"), content_type="application/pdf")
    response["Cache-Control"] = "private, no-store"
    return response


def crear_marca(cuenta, doc, datos):
    if datos["pagina"] > doc.paginas:
        raise ValidationError("Página fuera del documento.")
    return Destacado.objects.create(cuenta=cuenta, documento=doc, version_documento=doc.version, **datos)


def editable(marca, doc):
    if marca.version_documento != doc.version:
        raise ValidationError("Las anotaciones de versiones anteriores solo se pueden consultar.")


@transaction.atomic
def destacados(request, pk, marca=None):
    cuenta, docs = asignados(request)
    doc = get_object_or_404(docs, pk=pk)
    qs = Destacado.objects.filter(cuenta=cuenta, documento=doc)
    if request.method == "GET":
        if request.query_params.get("version"):
            qs = qs.filter(version_documento=version_pedida(request, doc))
        return Response(Marca(qs.order_by("pagina", "pk"), many=True).data)
    if request.method == "POST":
        if request.data.get("version_documento", doc.version) != doc.version:
            raise ValidationError("El documento cambió. Abre la nueva versión.")
        objeto = crear_marca(cuenta, doc, validar(Marca, request.data))
    else:
        objeto = get_object_or_404(qs, pk=marca)
        editable(objeto, doc)
        if request.method == "PATCH":
            if set(request.data) - {"color", "nota"}:
                raise ValidationError("Solo puedes editar el color.")
            for campo, valor in validar(Marca, request.data, partial=True).items():
                setattr(objeto, campo, valor)
            objeto.save()
    registrar(request.user, f"destacado.{request.method.lower()}", destacado=objeto.pk, documento=pk,
              tipo=objeto.tipo)
    if request.method == "DELETE":
        objeto.delete()
        return Response(status=204)
    return Response(Marca(objeto).data, status=201 if request.method == "POST" else 200)


@transaction.atomic
def lote(request, pk):
    """Guardado del editor: crea y elimina anotaciones de la versión vigente en una sola operación."""
    cuenta, docs = asignados(request)
    doc = get_object_or_404(docs, pk=pk)
    datos = validar(Lote, request.data)
    if datos["version_documento"] != doc.version:
        raise ValidationError("El documento cambió. Abre la nueva versión.")
    qs = Destacado.objects.filter(cuenta=cuenta, documento=doc)
    borrar = qs.filter(pk__in=datos["eliminar"])
    if borrar.count() != len(set(datos["eliminar"])):
        raise ValidationError("Una de las anotaciones a eliminar ya no existe.")
    if borrar.exclude(version_documento=doc.version).exists():
        raise ValidationError("Las anotaciones de versiones anteriores solo se pueden consultar.")
    borrar.delete()
    creadas = [crear_marca(cuenta, doc, validar(Marca, item)) for item in datos["crear"]]
    registrar(request.user, "anotaciones.guardar", documento=pk, version=doc.version,
              creadas=len(creadas), eliminadas=len(datos["eliminar"]))
    vigentes = qs.filter(version_documento=doc.version).order_by("pagina", "pk")
    return Response({"creadas": [m.pk for m in creadas], "anotaciones": Marca(vigentes, many=True).data})
