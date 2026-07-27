from rest_framework.permissions import BasePermission

from .models import Role


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return Role.ADMIN
    profile = getattr(user, "profile", None)
    return profile.role if profile else None


def role_required(*roles):
    """Permission class factory: any of the given roles (ADMIN always allowed)."""

    class _RolePermission(BasePermission):
        message = "Your role does not allow this action."

        def has_permission(self, request, view):
            r = user_role(request.user)
            return r is not None and (r == Role.ADMIN or r in roles)

    return _RolePermission


AnyStaff = role_required(Role.MANAGER, Role.CASHIER, Role.SECURITY)
CanSell = role_required(Role.MANAGER, Role.CASHIER)
CanScan = role_required(Role.MANAGER, Role.CASHIER, Role.SECURITY)
CanReport = role_required(Role.MANAGER)
AdminOnly = role_required()
