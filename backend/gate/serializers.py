from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import GateConfig, Package, Ticket, TimeOption


class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = [
            "id", "name", "description", "emoji",
            "adult_price_usd", "child_price_usd", "vehicle_fee_usd",
            "overstay_rate_usd",
        ]


class TimeOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeOption
        fields = ["id", "label", "minutes"]


class TicketSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source="package.name", read_only=True)
    package_emoji = serializers.CharField(source="package.emoji", read_only=True)
    visitors = serializers.IntegerField(read_only=True)
    remaining_seconds = serializers.IntegerField(read_only=True)
    overstay_minutes = serializers.IntegerField(read_only=True)
    state = serializers.SerializerMethodField()
    overstay_due_usd = serializers.SerializerMethodField()
    overstay_due = serializers.SerializerMethodField()
    venue_name = serializers.SerializerMethodField()
    venue_city = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "number", "qr_token", "package_name", "package_emoji",
            "duration_label", "duration_minutes",
            "adults", "children", "visitors", "visitor_name", "phone",
            "vehicle_reg", "vehicle_type",
            "currency", "payment_method", "total", "total_usd",
            "status", "state", "issued_at", "expires_at", "exited_at",
            "remaining_seconds", "overstay_minutes",
            "overstay_due_usd", "overstay_due",
            "overstay_fee", "overstay_fee_usd", "overstay_method",
            "issued_by", "venue_name", "venue_city",
        ]

    def get_state(self, t):
        """What the scanner shows: VALID / EXPIRED / EXITED / CANCELLED."""
        if t.status == Ticket.Status.ACTIVE:
            return "VALID" if timezone.now() <= t.expires_at else "EXPIRED"
        return t.status

    def get_overstay_due_usd(self, t):
        if t.status != Ticket.Status.ACTIVE:
            return str(t.overstay_fee_usd)
        return str(t.overstay_fee_due_usd())

    def get_overstay_due(self, t):
        if t.status != Ticket.Status.ACTIVE:
            return str(t.overstay_fee)
        return str(t.to_currency(t.overstay_fee_due_usd()))

    def get_venue_name(self, t):
        return GateConfig.get().venue_name

    def get_venue_city(self, t):
        return GateConfig.get().venue_city


class IssueTicketSerializer(serializers.Serializer):
    package = serializers.PrimaryKeyRelatedField(queryset=Package.objects.filter(active=True))
    time_option = serializers.PrimaryKeyRelatedField(queryset=TimeOption.objects.filter(active=True))
    adults = serializers.IntegerField(min_value=0, max_value=200)
    children = serializers.IntegerField(min_value=0, max_value=200, default=0)
    visitor_name = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")
    phone = serializers.CharField(max_length=32, allow_blank=True, required=False, default="")
    vehicle_reg = serializers.CharField(max_length=20, allow_blank=True, required=False, default="")
    vehicle_type = serializers.CharField(max_length=40, allow_blank=True, required=False, default="")
    currency = serializers.ChoiceField(choices=["USD", "ZIG"], default="USD")
    payment_method = serializers.ChoiceField(
        choices=[c[0] for c in Ticket._meta.get_field("payment_method").choices], default="CASH"
    )
    issued_by = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")

    def validate(self, data):
        if data["adults"] + data.get("children", 0) < 1:
            raise serializers.ValidationError("At least one visitor is required.")
        return data

    def create(self, validated):
        config = GateConfig.get()
        pkg = validated["package"]
        opt = validated["time_option"]
        total_usd = (
            pkg.adult_price_usd * validated["adults"]
            + pkg.child_price_usd * validated.get("children", 0)
            + (pkg.vehicle_fee_usd if validated.get("vehicle_reg") else Decimal("0"))
        )
        t = Ticket(
            package=pkg,
            duration_label=opt.label,
            duration_minutes=opt.minutes,
            adults=validated["adults"],
            children=validated.get("children", 0),
            visitor_name=validated.get("visitor_name", ""),
            phone=validated.get("phone", ""),
            vehicle_reg=validated.get("vehicle_reg", "").upper(),
            vehicle_type=validated.get("vehicle_type", ""),
            currency=validated["currency"],
            payment_method=validated["payment_method"],
            zig_per_usd=config.zig_per_usd,
            total_usd=total_usd,
            issued_by=validated.get("issued_by", ""),
            expires_at=Ticket.expiry_for(opt.minutes, config),
        )
        t.total = t.to_currency(total_usd)
        t.save()
        return t
