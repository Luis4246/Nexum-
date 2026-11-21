from getpass import getpass

from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from biblioteca.models import Usuario
from biblioteca.services import clave_nueva, registrar


class Command(BaseCommand):
    help = "Instala el único administrador. Solicita la clave sin mostrarla."

    def add_arguments(self, parser):
        parser.add_argument("usuario")

    def handle(self, *args, **options):
        if Usuario.objects.filter(es_admin=True).exists():
            raise CommandError("Ya existe un administrador.")
        try:
            with transaction.atomic():
                usuario = Usuario.objects.create_user(username=options["usuario"], es_admin=True)
                clave_nueva(usuario, getpass("Contraseña del administrador: "))
                registrar(usuario, "administrador.crear")
        except (IntegrityError, ValidationError) as error:
            raise CommandError(str(error))
        self.stdout.write("Administrador creado.")

