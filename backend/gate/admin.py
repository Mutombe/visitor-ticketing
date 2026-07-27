from django.contrib import admin

from .models import (
    BandAssignment, GateConfig, Package, Profile, Sighting, Ticket, TimeOption,
    Wristband, Zone,
)

admin.site.register(Profile)
admin.site.register(Zone)
admin.site.register(Wristband)
admin.site.register(BandAssignment)
admin.site.register(Sighting)


@admin.register(GateConfig)
class GateConfigAdmin(admin.ModelAdmin):
    list_display = ["venue_name", "venue_city", "zig_per_usd", "closing_time"]


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ["name", "group", "pricing", "fixed_minutes",
                    "adult_price_usd", "child_price_usd",
                    "overstay_rate_usd", "active", "sort"]
    list_editable = ["active", "sort"]
    list_filter = ["group", "pricing"]


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
