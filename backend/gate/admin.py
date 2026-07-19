from django.contrib import admin

from .models import GateConfig, Package, Ticket, TimeOption


@admin.register(GateConfig)
class GateConfigAdmin(admin.ModelAdmin):
    list_display = ["venue_name", "venue_city", "zig_per_usd", "closing_time"]


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ["name", "adult_price_usd", "child_price_usd",
                    "vehicle_fee_usd", "overstay_rate_usd", "active", "sort"]
    list_editable = ["active", "sort"]


@admin.register(TimeOption)
class TimeOptionAdmin(admin.ModelAdmin):
    list_display = ["label", "minutes", "active", "sort"]
    list_editable = ["active", "sort"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["number", "package", "adults", "children", "duration_label",
                    "total", "currency", "status", "issued_at", "expires_at"]
    list_filter = ["status", "package", "currency", "payment_method"]
    search_fields = ["number", "visitor_name", "phone", "vehicle_reg"]
    readonly_fields = ["number", "qr_token", "issued_at"]
