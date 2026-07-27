from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers

from .models import (
    BandAssignment, GateConfig, Package, Profile, Role, Ticket, TimeOption,
    Wristband, Zone,
)


class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = [
            "id", "name", "group", "description", "emoji",
            "pricing", "fixed_minutes",
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
    bands = serializers.SerializerMethodField()

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
            "issued_by", "venue_name", "venue_city", "bands",
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

    def get_bands(self, t):
        return [
            {"code": b.wristband.code, "child_name": b.child_name,
             "returned": b.returned_at is not None}
            for b in t.bands.select_related("wristband")
        ]


class IssueTicketSerializer(serializers.Serializer):
    package = serializers.PrimaryKeyRelatedField(queryset=Package.objects.filter(active=True))
    time_option = serializers.PrimaryKeyRelatedField(
        queryset=TimeOption.objects.filter(active=True), required=False, allow_null=True
    )
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
    bands = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    def validate(self, data):
        if data["adults"] + data.get("children", 0) < 1:
            raise serializers.ValidationError("At least one visitor is required.")
        pkg = data["package"]
        opt = data.get("time_option")
        if pkg.pricing == Package.Pricing.HOURLY and not (opt and opt.minutes):
            raise serializers.ValidationError("Pick how many hours for this package.")
        # resolve wristband codes up front so a bad code fails the whole sale
        resolved = []
        for b in data.get("bands", []):
            code = str(b.get("code", "")).strip().upper()
            name = str(b.get("child_name", "")).strip()
            if not code:
                continue
            band = Wristband.objects.filter(code__iexact=code, active=True).first()
            if not band:
                raise serializers.ValidationError(f"Wristband {code} is not registered.")
            if band.current_assignment:
                raise serializers.ValidationError(f"Wristband {code} is already worn by a child.")
            resolved.append((band, name or "Child"))
        if len({b.pk for b, _ in resolved}) != len(resolved):
            raise serializers.ValidationError("The same wristband was entered twice.")
        data["resolved_bands"] = resolved
        return data

    @staticmethod
    def _duration(pkg, opt):
        """(minutes, label) the ticket runs for, per the package's pricing."""
        if pkg.pricing == Package.Pricing.HOURLY:
            return opt.minutes, opt.label
        if pkg.fixed_minutes:
            h = pkg.fixed_minutes / 60
            return pkg.fixed_minutes, f"{h:g} hour{'s' if h != 1 else ''}"
        return None, "Until closing"

    def create(self, validated):
        config = GateConfig.get()
        pkg = validated["package"]
        minutes, label = self._duration(pkg, validated.get("time_option"))
        per_person = (
            pkg.adult_price_usd * validated["adults"]
            + pkg.child_price_usd * validated.get("children", 0)
        )
        if pkg.pricing == Package.Pricing.HOURLY:
            per_person = per_person * Decimal(minutes) / Decimal(60)
        total_usd = (per_person + (pkg.vehicle_fee_usd if validated.get("vehicle_reg") else Decimal("0"))
                     ).quantize(Decimal("0.01"))
        t = Ticket(
            package=pkg,
            duration_label=label,
            duration_minutes=minutes,
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
            expires_at=Ticket.expiry_for(minutes, config),
        )
        t.total = t.to_currency(total_usd)
        t.save()
        for band, child_name in validated.get("resolved_bands", []):
            BandAssignment.objects.create(wristband=band, ticket=t, child_name=child_name)
        return t


# --- Child safety ------------------------------------------------------------
class ChildStatusSerializer(serializers.ModelSerializer):
    band_code = serializers.CharField(source="wristband.code", read_only=True)
    ticket_number = serializers.CharField(source="ticket.number", read_only=True)
    qr_token = serializers.CharField(source="ticket.qr_token", read_only=True)
    guardian = serializers.CharField(source="ticket.visitor_name", read_only=True)
    guardian_phone = serializers.CharField(source="ticket.phone", read_only=True)
    zone = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()

    class Meta:
        model = BandAssignment
        fields = ["id", "child_name", "band_code", "ticket_number", "qr_token",
                  "guardian", "guardian_phone", "assigned_at", "returned_at",
                  "zone", "last_seen"]

    def get_zone(self, a):
        s = a.last_sighting
        return s.zone.name if s else None

    def get_last_seen(self, a):
        s = a.last_sighting
        return s.seen_at if s else None


# --- Staff & admin management ------------------------------------------------
class StaffSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=Role.choices, source="profile.role")
    name = serializers.CharField(source="first_name", allow_blank=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "is_active", "password"]

    def create(self, validated):
        import secrets
        profile = validated.pop("profile", {})
        password = validated.pop("password", "") or secrets.token_urlsafe(8)
        user = User.objects.create_user(
            username=validated["username"],
            first_name=validated.get("first_name", ""),
            password=password,
        )
        Profile.objects.create(user=user, role=profile.get("role", Role.CASHIER))
        return user

    def update(self, user, validated):
        profile = validated.pop("profile", None)
        password = validated.pop("password", "")
        for k, v in validated.items():
            setattr(user, k, v)
        if password:
            user.set_password(password)
        user.save()
        if profile and profile.get("role"):
            p, _ = Profile.objects.get_or_create(user=user)
            p.role = profile["role"]
            p.save()
        return user


class PackageAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = ["id", "name", "group", "description", "emoji", "pricing",
                  "fixed_minutes", "adult_price_usd", "child_price_usd",
                  "vehicle_fee_usd", "overstay_rate_usd", "active", "sort"]


class TimeOptionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeOption
        fields = ["id", "label", "minutes", "active", "sort"]


class ConfigAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = GateConfig
        fields = ["venue_name", "venue_city", "zig_per_usd", "closing_time", "gateway_key"]


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = ["id", "name", "sort"]


class WristbandSerializer(serializers.ModelSerializer):
    in_use = serializers.SerializerMethodField()

    class Meta:
        model = Wristband
        fields = ["id", "code", "active", "in_use"]

    def get_in_use(self, w):
        return w.current_assignment is not None
