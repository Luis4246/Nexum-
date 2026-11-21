from django.core.management.base import BaseCommand
from biblioteca.services import mantenimiento


class Command(BaseCommand):
    help = "Sin tareas desde el cambio a cuentas autorizadas; se conserva por compatibilidad."

    def handle(self, *args, **options):
        mantenimiento()

