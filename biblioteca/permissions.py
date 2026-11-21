from rest_framework.permissions import BasePermission


class Administrador(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.es_admin


class Cliente(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and not request.user.es_admin

