from django.urls import path

from . import views

urlpatterns = [
    path("config/", views.config),
    path("tickets/", views.tickets),
    path("tickets/<str:ref>/", views.ticket_lookup),
    path("tickets/<str:ref>/exit/", views.ticket_exit),
    path("reports/", views.reports),
]
