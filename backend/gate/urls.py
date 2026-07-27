from django.urls import path

from . import views

urlpatterns = [
    # auth
    path("auth/login/", views.login),
    path("auth/google/", views.google_login),
    path("auth/logout/", views.logout),
    path("auth/me/", views.me),
    # public storefront (no sign-in required)
    path("public/config/", views.public_config),
    path("public/orders/", views.public_order),
    # gate
    path("config/", views.config),
    path("tickets/", views.tickets),
    path("tickets/mine/", views.my_tickets),
    path("tickets/<str:ref>/", views.ticket_lookup),
    path("tickets/<str:ref>/exit/", views.ticket_exit),
    path("tickets/<str:ref>/bands/", views.band_assign),
    # security
    path("security/", views.security_stats),
    # child safety
    path("children/", views.children),
    path("bands/<str:code>/return/", views.band_return),
    path("ble/sightings/", views.ble_sighting),
    # management
    path("reports/", views.reports),
    # admin
    path("admin/packages/", views.admin_packages),
    path("admin/packages/<int:pk>/", views.admin_package),
    path("admin/time-options/", views.admin_times),
    path("admin/time-options/<int:pk>/", views.admin_time),
    path("admin/zones/", views.admin_zones),
    path("admin/zones/<int:pk>/", views.admin_zone),
    path("admin/wristbands/", views.admin_bands),
    path("admin/wristbands/<int:pk>/", views.admin_band),
    path("admin/config/", views.admin_config),
    path("admin/staff/", views.admin_staff),
    path("admin/staff/<int:pk>/", views.admin_staff_one),
]
