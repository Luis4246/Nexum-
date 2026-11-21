import io
import shutil
from uuid import uuid4
from datetime import timedelta
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APIClient, APITestCase

from biblioteca.models import (Arrendatario, Cuenta, Destacado, Documento, DocumentoVersion,
                               EventoAuditoria, Parametros, Renta, Usuario)


def pdf_bytes(paginas=1):
    pdf = PdfWriter()
    for _ in range(paginas):
        pdf.add_blank_page(200, 300)
    stream = io.BytesIO()
    pdf.write(stream)
    return stream.getvalue()


class FlujoLocal(APITestCase):
    def setUp(self):
        carpeta = Path(__file__).resolve().parent / ("prueba-" + uuid4().hex)
        carpeta.mkdir()
        self.addCleanup(shutil.rmtree, carpeta)
        config = override_settings(MEDIA_ROOT=carpeta, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
        config.enable()
        self.addCleanup(config.disable)
        self.root = carpeta
        self.hoy = timezone.localdate()
        self.admin = Usuario.objects.create_user("admin", password="Admin-8-muestra", es_admin=True)
        self.login(self.client, self.admin.username, "Admin-8-muestra")
        self.cuenta = self.post(self.client, "cuentas/", {"codigo":"lector"})[0]
        self.lector = APIClient()

    def post(self, client, ruta, datos, status=201):
        respuesta = client.post("/api/" + ruta, datos, format="json")
        self.assertEqual(respuesta.status_code, status, getattr(respuesta, "data", respuesta))
        return respuesta.data

    def login(self, client, codigo, clave):
        tokens = self.post(client, "auth/login/", {"username":codigo,"password":clave}, 200)
        client.credentials(HTTP_AUTHORIZATION="Bearer " + tokens["access"])
        return tokens

    def habilitar(self):
        """Reemplaza al antiguo «rentar»: el administrador autoriza la cuenta y el cliente inicia sesión."""
        self.post(self.client, f"cuentas/{self.cuenta['id']}/autorizar/", {}, 200)
        return self.login(self.lector, self.cuenta["codigo"], self.cuenta["clave"])

    def subir(self, carpeta=None, asignar=True):
        datos = {"archivos":SimpleUploadedFile("guia.pdf", pdf_bytes(2)), "titulo":"Guía"}
        if carpeta:
            datos["carpeta"] = carpeta
        respuesta = self.client.post("/api/documentos/", datos, format="multipart")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        doc = respuesta.data[0]
        if asignar:
            self.post(self.client, "asignaciones/", {"cuentas":[self.cuenta["id"]],"documentos":[doc["id"]]}, 204)
        return doc

    def marcar(self, doc, **extra):
        self.url = f"biblioteca/{doc['id']}/destacados/"
        datos = {"pagina":1,"texto":"selección","color":"#ffd666","rectangulos":[[0.1,0.1,0.3,0.1]], **extra}
        return self.post(self.lector, self.url, datos)

    def test_ciclo_completo_de_acceso(self):
        tokens = self.habilitar()
        doc = self.subir()
        self.assertEqual(self.lector.get("/api/cuentas/").status_code, 403)
        respuesta = self.lector.get(f"/api/biblioteca/{doc['id']}/contenido/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(b"".join(respuesta.streaming_content).startswith(b"%PDF"))
        self.assertTrue(EventoAuditoria.objects.filter(accion="documento.abrir").exists())
        self.assertNotIn("archivo", doc)
        marca = self.marcar(doc)
        pk = self.cuenta["id"]
        # Suspender corta el acceso y las sesiones, pero no borra nada.
        self.post(self.client, f"cuentas/{pk}/suspender/", {}, 200)
        self.assertEqual(self.lector.get("/api/"+self.url).status_code, 401)
        self.post(APIClient(), "auth/refrescar/", {"refresh":tokens["refresh"]}, 403)
        self.assertTrue(Destacado.objects.filter(pk=marca["id"]).exists())
        self.post(self.client, f"cuentas/{pk}/reactivar/", {}, 200)
        self.login(self.lector, self.cuenta["codigo"], self.cuenta["clave"])
        self.assertEqual(self.lector.get("/api/"+self.url).data[0]["id"], marca["id"])
        # Deshabilitar también conserva todo, y se puede volver a habilitar.
        self.post(self.client, f"cuentas/{pk}/deshabilitar/", {}, 200)
        self.assertEqual(self.lector.get("/api/"+self.url).status_code, 401)
        self.post(self.client, f"cuentas/{pk}/habilitar/", {}, 200)
        self.login(self.lector, self.cuenta["codigo"], self.cuenta["clave"])
        self.assertEqual(len(self.lector.get("/api/"+self.url).data), 1)
        # El mantenimiento ya no borra anotaciones aunque la retención sea cero.
        Parametros.objects.update(retencion=0)
        self.client.get("/api/auditoria/")
        self.assertTrue(Destacado.objects.filter(pk=marca["id"]).exists())

    def test_estados_motivos_y_sin_vencimiento(self):
        pk = self.cuenta["id"]
        credenciales = {"username":self.cuenta["codigo"], "password":self.cuenta["clave"]}
        self.assertEqual(self.cuenta["estado"], "pendiente")
        denegado = self.post(self.lector, "auth/login/", credenciales, 403)
        self.assertEqual(denegado["motivo"], "pendiente")
        self.assertEqual(denegado["detail"], "Tu cuenta está pendiente de autorización.")
        self.post(self.client, f"cuentas/{pk}/autorizar/", {}, 200)
        self.post(self.client, f"cuentas/{pk}/autorizar/", {}, 400)
        self.assertIsNotNone(Cuenta.objects.get(pk=pk).autorizada_en)
        self.login(self.lector, **{"codigo":credenciales["username"], "clave":credenciales["password"]})
        # Una renta antigua y vencida ya no afecta el acceso.
        persona = Arrendatario.objects.create(nombre="Ana", contacto="ana@correo.cl")
        Renta.objects.create(cuenta_id=pk, codigo="lector", arrendatario=persona,
                             inicio=self.hoy-timedelta(days=10), fin=self.hoy-timedelta(days=1))
        self.assertEqual(self.lector.get("/api/biblioteca/").status_code, 200)
        self.post(self.client, f"cuentas/{pk}/suspender/", {}, 200)
        self.assertEqual(self.post(APIClient(), "auth/login/", credenciales, 403)["motivo"], "suspendida")
        self.post(self.client, f"cuentas/{pk}/deshabilitar/", {}, 200)
        self.assertEqual(self.post(APIClient(), "auth/login/", credenciales, 403)["motivo"], "deshabilitada")
        self.assertTrue(Cuenta.objects.get(pk=pk).suspendida)
        self.assertEqual(self.client.get("/api/cuentas/?estado=deshabilitada").data[0]["id"], pk)
        self.post(self.client, f"cuentas/{pk}/eliminar/", {}, 200)
        self.assertFalse(Cuenta.objects.exists())
        self.assertEqual(Renta.objects.get().codigo, "lector")

    def test_validacion_asignacion_y_borrado(self):
        self.habilitar()
        doc = self.subir()
        self.marcar(doc)
        archivo = Documento.objects.get().archivo.path
        self.assertNotIn("guia", archivo)
        res = self.client.post("/api/documentos/",{"archivos":SimpleUploadedFile("falso.pdf",b"%PDF-falso")},format="multipart")
        self.assertEqual(res.status_code, 400)
        data = {"cuentas":[self.cuenta["id"]], "documentos":[doc["id"]]}
        self.assertEqual(self.client.delete("/api/asignaciones/",data,format="json").status_code,204)
        self.assertEqual(self.lector.get("/api/"+self.url).status_code,404)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(f"/api/documentos/{doc['id']}/").status_code,204)
        self.assertFalse(Path(archivo).exists())
        self.assertFalse(Destacado.objects.exists())
        self.assertFalse(DocumentoVersion.objects.exists())

    def test_bloqueo_logout_y_lote_atomico(self):
        lector = APIClient()
        for _ in range(5):
            self.post(lector,"auth/login/",{"username":"lector","password":"incorrecta"},401)
        self.post(lector,"auth/login/",{"username":"lector","password":"incorrecta"},429)
        tokens = self.login(self.client, "admin", "Admin-8-muestra")
        self.post(self.client,"auth/salir/",{"refresh":tokens["refresh"]},204)
        self.post(lector,"auth/refrescar/",{"refresh":tokens["refresh"]},403)
        self.post(self.client,"cuentas/",{"codigo":"serie002"})
        self.post(self.client,"cuentas/",{"codigo":"serie","cantidad":2},400)
        self.assertFalse(Usuario.objects.filter(username="serie001").exists())

    def test_reemplazo_conserva_version_anterior_y_sus_anotaciones(self):
        self.habilitar()
        doc = self.subir()
        marca = self.marcar(doc)
        anterior = Path(Documento.objects.get().archivo.path)
        archivo = SimpleUploadedFile("segunda.pdf", pdf_bytes(3))
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.put(f"/api/documentos/{doc['id']}/", {"archivos":archivo}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data[0]["version"], 2)
        self.assertEqual([v["numero"] for v in res.data[0]["versiones"]], [2, 1])
        self.assertTrue(anterior.exists())
        self.assertEqual(len(self.client.get(f"/api/documentos/{doc['id']}/versiones/").data), 2)
        # La versión vigente empieza sin anotaciones; la anterior conserva las suyas.
        self.assertEqual(self.lector.get("/api/"+self.url+"?version=2").data, [])
        anteriores = self.lector.get("/api/"+self.url+"?version=1").data
        self.assertEqual([m["id"] for m in anteriores], [marca["id"]])
        # El cliente puede abrir la versión anterior, pero sus anotaciones son de solo consulta.
        self.assertEqual(self.lector.get(f"/api/biblioteca/{doc['id']}/contenido/?version=1").status_code, 200)
        self.assertEqual(self.lector.get(f"/api/biblioteca/{doc['id']}/contenido/?version=9").status_code, 404)
        url = "/api/" + self.url + str(marca["id"]) + "/"
        self.assertEqual(self.lector.patch(url, {"color":"#123456"}, format="json").status_code, 400)
        self.assertEqual(self.lector.delete(url).status_code, 400)
        self.post(self.lector, self.url, {"pagina":1,"texto":"x","color":"#ffd666","rectangulos":[[0.1,0.1,0.3,0.1]],
                                          "version_documento":1}, 400)
        nueva = self.marcar(doc, pagina=3)
        self.assertEqual(nueva["version_documento"], 2)
        self.assertEqual(self.lector.delete("/api/"+self.url+str(nueva["id"])+"/").status_code, 204)
        archivos = [Path(v.archivo.path) for v in DocumentoVersion.objects.all()]
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(f"/api/documentos/{doc['id']}/").status_code, 204)
        self.assertFalse(any(a.exists() for a in archivos))

    def test_clave_cierra_sesiones_y_liberar_ya_no_aplica(self):
        tokens = self.habilitar()
        pk = self.cuenta["id"]
        clave = self.post(self.client, f"cuentas/{pk}/clave/", {}, 200)["clave"]
        self.assertEqual(self.lector.get("/api/biblioteca/").status_code, 401)
        self.post(APIClient(), "auth/refrescar/", {"refresh":tokens["refresh"]}, 403)
        self.login(self.lector, self.cuenta["codigo"], clave)
        self.post(self.client, f"cuentas/{pk}/clave/", {"clave":"Otra-clave-segura-9"}, 200)
        self.login(APIClient(), self.cuenta["codigo"], "Otra-clave-segura-9")
        self.post(self.client, f"cuentas/{pk}/liberar/", {}, 410)
        self.assertEqual(self.client.get("/api/cuentas/").data[0]["estado"], "habilitada")

    def test_rentas_solo_como_historial(self):
        datos = {"cuenta":self.cuenta["id"], "nombre":"Ana", "contacto":"correo",
                 "inicio":self.hoy+timedelta(days=1), "fin":self.hoy+timedelta(days=3)}
        self.post(self.client, "rentas/", datos, 410)
        persona = Arrendatario.objects.create(nombre="Ana", contacto="correo")
        renta = Renta.objects.create(cuenta_id=self.cuenta["id"], codigo="lector", arrendatario=persona,
                                     inicio=self.hoy, fin=self.hoy+timedelta(days=3))
        self.assertEqual(self.client.get("/api/rentas/").data[0]["id"], renta.pk)
        self.post(self.client, f"rentas/{renta.pk}/renovar/", {"fin":self.hoy+timedelta(days=9)}, 410)
        # Tener una renta ya no da acceso: la cuenta sigue pendiente.
        self.post(self.lector, "auth/login/", {"username":"lector", "password":self.cuenta["clave"]}, 403)

    def test_unico_administrador(self):
        from django.core.management import call_command, CommandError
        from django.db import IntegrityError, transaction

        with self.assertRaises(CommandError):
            call_command("crear_admin", "segundo")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Usuario.objects.create_user(username="segundo", es_admin=True)

    def test_usuarios_automaticos_individuales_y_en_lote(self):
        self.post(self.client, "cuentas/", {"codigo":"cliente001"})
        unica = self.post(self.client, "cuentas/", {})[0]
        self.assertEqual(unica["codigo"], "cliente002")
        self.post(self.client, f"cuentas/{unica['id']}/eliminar/", {}, 200)
        lote = self.post(self.client, "cuentas/", {"cantidad":2})
        self.assertEqual([c["codigo"] for c in lote], ["cliente003", "cliente004"])

    # ---------- Funcionalidades nuevas ----------

    def test_crear_cuenta_con_datos_y_editarla(self):
        nueva = self.post(self.client, "cuentas/", {"codigo":"maria@empresa.cl", "clave":"Clave-de-Maria-7",
                                                   "nombre":"María González", "correo":"maria@empresa.cl",
                                                   "estado":"habilitada"})[0]
        self.assertEqual((nueva["estado"], nueva["nombre"]), ("habilitada", "María González"))
        self.login(APIClient(), "maria@empresa.cl", "Clave-de-Maria-7")
        self.post(self.client, "cuentas/", {"codigo":"maria@empresa.cl"}, 400)
        self.post(self.client, "cuentas/", {"codigo":"x@y.cl", "estado":"suspendida"}, 400)
        res = self.client.patch(f"/api/cuentas/{nueva['id']}/", {"nombre":"María G.", "codigo":"maria.g@empresa.cl"},
                                format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["codigo"], "maria.g@empresa.cl")
        self.login(APIClient(), "maria.g@empresa.cl", "Clave-de-Maria-7")
        res = self.client.patch(f"/api/cuentas/{nueva['id']}/", {"codigo":"lector"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.lector.patch(f"/api/cuentas/{nueva['id']}/", {"nombre":"x"}, format="json").status_code, 401)

    def test_carpetas_del_administrador_y_vista_del_cliente(self):
        self.habilitar()
        informes = self.post(self.client, "carpetas/", {"nombre":"Informes"})
        self.post(self.client, "carpetas/", {"nombre":"informes"}, 400)
        contratos = self.post(self.client, "carpetas/", {"nombre":"Contratos"})
        doc = self.subir(carpeta=informes["id"])
        self.assertEqual(doc["carpeta"]["nombre"], "Informes")
        res = self.client.patch(f"/api/documentos/{doc['id']}/", {"carpeta":contratos["id"], "titulo":"Contrato marco"},
                                format="json")
        self.assertEqual((res.data["carpeta"]["id"], res.data["titulo"]), (contratos["id"], "Contrato marco"))
        propia = self.lector.get("/api/biblioteca/").data[0]
        self.assertEqual(propia["carpeta"]["nombre"], "Contratos")
        self.assertIsNotNone(propia["asignado_en"])
        self.assertIsNotNone(propia["tamano"])
        self.assertEqual(self.client.patch(f"/api/carpetas/{contratos['id']}/", {"nombre":"Acuerdos"}, format="json").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/carpetas/{contratos['id']}/").status_code, 204)
        self.assertIsNone(Documento.objects.get().carpeta)
        self.assertEqual(self.lector.get("/api/carpetas/").status_code, 403)

    def test_cinco_tipos_de_anotacion_y_guardado_en_lote(self):
        self.habilitar()
        doc = self.subir()
        self.marcar(doc)
        self.marcar(doc, tipo="subrayado")
        trazo = {"puntos":[[0.1,0.1],[0.2,0.25],[0.3,0.2]], "grosor":0.004}
        self.marcar(doc, tipo="dibujo", texto="", rectangulos=[], trazos=[trazo])
        self.marcar(doc, tipo="lapiz", texto="", rectangulos=[], trazos=[trazo], color="#111c30")
        texto = self.marcar(doc, tipo="texto", texto="", rectangulos=[[0.5,0.5,0.2,0.05]], contenido="Revisar")
        self.assertEqual(texto["contenido"], "Revisar")
        self.assertEqual(sorted(m["tipo"] for m in self.lector.get("/api/"+self.url).data),
                         ["dibujo", "lapiz", "resaltado", "subrayado", "texto"])
        self.post(self.lector, self.url, {"pagina":1,"tipo":"subrayado","color":"#ffd666","rectangulos":[]}, 400)
        self.post(self.lector, self.url, {"pagina":1,"tipo":"dibujo","color":"#ffd666","trazos":[]}, 400)
        self.post(self.lector, self.url, {"pagina":1,"tipo":"texto","color":"#ffd666","rectangulos":[[0.1,0.1,0.1,0.1]]}, 400)
        self.post(self.lector, self.url, {"pagina":1,"tipo":"dibujo","color":"#ffd666",
                                          "trazos":[{"puntos":[[1.5,0.1]],"grosor":0.004}]}, 400)
        self.post(self.lector, self.url, {"pagina":1,"tipo":"comentario","color":"#ffd666","texto":"x",
                                          "rectangulos":[[0.1,0.1,0.1,0.1]]}, 400)
        lote = self.url + "lote/"
        ids = [m["id"] for m in self.lector.get("/api/"+self.url).data]
        nuevo = {"pagina":2, "tipo":"lapiz", "color":"#4d8ff7", "trazos":[trazo]}
        res = self.post(self.lector, lote, {"version_documento":1, "crear":[nuevo], "eliminar":ids[:2]}, 200)
        self.assertEqual(len(res["creadas"]), 1)
        self.assertEqual(len(res["anotaciones"]), 4)
        # Si un elemento es inválido, no se aplica nada del lote.
        self.post(self.lector, lote, {"version_documento":1, "crear":[nuevo, {**nuevo, "pagina":99}],
                                      "eliminar":[ids[2]]}, 400)
        self.assertEqual(len(self.lector.get("/api/"+self.url).data), 4)
        self.post(self.lector, lote, {"version_documento":2, "crear":[nuevo]}, 400)

    def test_un_cliente_no_accede_a_lo_ajeno(self):
        self.habilitar()
        doc = self.subir()
        marca = self.marcar(doc)
        otra = self.post(self.client, "cuentas/", {"codigo":"otra", "estado":"habilitada"})[0]
        ajeno = APIClient()
        self.login(ajeno, "otra", otra["clave"])
        self.assertEqual(ajeno.get("/api/biblioteca/").data, [])
        self.assertEqual(ajeno.get(f"/api/biblioteca/{doc['id']}/contenido/").status_code, 404)
        self.assertEqual(ajeno.get(f"/api/biblioteca/{doc['id']}/destacados/").status_code, 404)
        self.post(self.client, "asignaciones/", {"cuentas":[otra["id"]], "documentos":[doc["id"]]}, 204)
        self.assertEqual(ajeno.get(f"/api/biblioteca/{doc['id']}/destacados/").data, [])
        self.assertEqual(ajeno.delete(f"/api/biblioteca/{doc['id']}/destacados/{marca['id']}/").status_code, 404)
        for ruta in ("cuentas/", "documentos/", "carpetas/", "rentas/", "auditoria/"):
            self.assertEqual(ajeno.get("/api/" + ruta).status_code, 403, ruta)


class MigracionDeDatos(TransactionTestCase):
    """Comprueba que 0005 convierte rentas en estados y une las anotaciones a la cuenta sin borrar nada."""

    antes = [("biblioteca", "0003_parametros_ultimo_codigo")]
    despues = [("biblioteca", "0005_migrar_datos_existentes")]

    def tearDown(self):
        MigrationExecutor(connection).migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

    def test_conversion(self):
        ejecutor = MigrationExecutor(connection)
        ejecutor.migrate(self.antes)
        viejo = ejecutor.loader.project_state(self.antes).apps
        U, C, A, R, D, Doc = (viejo.get_model("biblioteca", n) for n in
                              ("Usuario", "Cuenta", "Arrendatario", "Renta", "Destacado", "Documento"))
        hoy = timezone.localdate()
        vigente = C.objects.create(usuario=U.objects.create(username="vigente"))
        sin_renta = C.objects.create(usuario=U.objects.create(username="sin_renta"))
        suspendida = C.objects.create(usuario=U.objects.create(username="suspendida"), suspendida=True)
        vencida = C.objects.create(usuario=U.objects.create(username="vencida"))
        ana = A.objects.create(nombre="Ana Pérez", contacto="ana@correo.cl")
        beto = A.objects.create(nombre="Beto", contacto="+56 9 1234")
        renta = R.objects.create(cuenta=vigente, codigo="vigente", arrendatario=ana, inicio=hoy, fin=hoy+timedelta(days=5))
        R.objects.create(cuenta=vencida, codigo="vencida", arrendatario=beto, inicio=hoy-timedelta(days=9),
                         fin=hoy-timedelta(days=2), cerrada=hoy-timedelta(days=2))
        doc = Doc.objects.create(titulo="Guía", archivo="no-existe.pdf", original="guia.pdf", paginas=2)
        D.objects.create(renta=renta, documento=doc, pagina=1, texto="t", rectangulos=[[0.1,0.1,0.1,0.1]], color="#ffffff")

        ejecutor = MigrationExecutor(connection)
        ejecutor.migrate(self.despues)
        nuevo = ejecutor.loader.project_state(self.despues).apps
        C2, D2, V2, R2 = (nuevo.get_model("biblioteca", n) for n in ("Cuenta", "Destacado", "DocumentoVersion", "Renta"))
        estados = {c.usuario.username: c.estado for c in C2.objects.select_related("usuario")}
        self.assertEqual(estados, {"vigente":"habilitada", "sin_renta":"pendiente", "suspendida":"suspendida",
                                   "vencida":"pendiente"})
        self.assertEqual((C2.objects.get(pk=vigente.pk).nombre, C2.objects.get(pk=vigente.pk).correo),
                         ("Ana Pérez", "ana@correo.cl"))
        self.assertEqual((C2.objects.get(pk=vencida.pk).nombre, C2.objects.get(pk=vencida.pk).correo), ("Beto", ""))
        marca = D2.objects.get()
        self.assertEqual((marca.cuenta_id, marca.tipo, marca.renta_id), (vigente.pk, "resaltado", renta.pk))
        self.assertEqual(V2.objects.get().numero, 1)
        self.assertEqual(R2.objects.count(), 2)
