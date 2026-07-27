"""
Gatepass — visitor gate ticketing domain.

    Attendant ──issues──> Ticket (party of adults+children, a Package,
                          a timed duration, optional vehicle) with a QR.
    At exit the QR is scanned: valid / time remaining / expired, and an
    overstay fee is charged per started half-hour past expiry.
"""
import math
import secrets
import uuid
from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Administrator"          # everything incl. settings & staff
    MANAGER = "MANAGER", "Manager"            # reports + all gate operations
    CASHIER = "CASHIER", "Gate cashier"       # issue tickets, scan, children
    SECURITY = "SECURITY", "Security"         # scan exits, children


class Profile(models.Model):
    user = models.OneToOneField(User, related_name="profile", on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CASHIER)

    def __str__(self):
        return f"{self.user.username} · {self.role}"


class Currency(models.TextChoices):
    USD = "USD", "US Dollar"
    ZIG = "ZIG", "Zimbabwe Gold (ZiG)"


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Cash"
    ECOCASH = "ECOCASH", "EcoCash"
    ONEMONEY = "ONEMONEY", "OneMoney"
    INNBUCKS = "INNBUCKS", "InnBucks"
    OMARI = "OMARI", "O'mari"
    ZIPIT = "ZIPIT", "ZimSwitch"
    CARD = "CARD", "Visa / Mastercard"


def _token():
    return uuid.uuid4().hex


def _number():
    return "GP-" + secrets.token_hex(3).upper()


class GateConfig(models.Model):
    """Singleton venue settings (pk=1)."""

    venue_name = models.CharField(max_length=120, default="Max Fun Entertainment")
    venue_city = models.CharField(max_length=80, default="Harare")
    zig_per_usd = models.DecimalField(max_digits=12, decimal_places=2, default=30)
    closing_time = models.TimeField(default=time(18, 0))  # full-day tickets expire here
    gateway_key = models.CharField(
        max_length=64, default=_token,
        help_text="Shared secret BLE gateways send as X-Gateway-Key.",
    )

    class Meta:
        verbose_name = "Gate settings"

    def __str__(self):
        return self.venue_name

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Package(models.Model):
    class Pricing(models.TextChoices):
        HOURLY = "HOURLY", "Per hour"       # price × hours picked at the gate
        FIXED = "FIXED", "Flat price"       # one price; duration fixed or until close

    name = models.CharField(max_length=80)               # General Indoor Play / Museum Tour…
    group = models.CharField(max_length=40, default="General")  # section on the gate screen
    description = models.CharField(max_length=200, blank=True)
    emoji = models.CharField(max_length=8, default="🎟️")
    pricing = models.CharField(max_length=8, choices=Pricing.choices, default=Pricing.FIXED)
    fixed_minutes = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="FIXED only: locked duration (e.g. 180 for Play & Movie). "
                  "Blank = valid until closing time.",
    )
    adult_price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    child_price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    vehicle_fee_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    overstay_rate_usd = models.DecimalField(
        max_digits=10, decimal_places=2, default=2,
        help_text="Charged per started 30 minutes past expiry (whole party).",
    )
    active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "adult_price_usd"]

    def __str__(self):
        return self.name


class TimeOption(models.Model):
    label = models.CharField(max_length=40)  # "2 hours" / "Full day"
    minutes = models.PositiveIntegerField(
        null=True, blank=True, help_text="Blank = full day (expires at closing time)."
    )
    active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return self.label


class Ticket(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        EXITED = "EXITED", "Exited"
        CANCELLED = "CANCELLED", "Cancelled"

    number = models.CharField(max_length=16, unique=True, default=_number, db_index=True)
    qr_token = models.CharField(max_length=64, unique=True, default=_token)

    package = models.ForeignKey(Package, related_name="tickets", on_delete=models.PROTECT)
    duration_label = models.CharField(max_length=40)          # snapshot of TimeOption
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    adults = models.PositiveSmallIntegerField(default=1)
    children = models.PositiveSmallIntegerField(default=0)
    visitor_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    vehicle_reg = models.CharField(max_length=20, blank=True)
    vehicle_type = models.CharField(max_length=40, blank=True)

    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.USD)
    payment_method = models.CharField(max_length=12, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    zig_per_usd = models.DecimalField(max_digits=12, decimal_places=2, default=30)  # snapshot
    total_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # in `currency`

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    exited_at = models.DateTimeField(null=True, blank=True)

    overstay_fee_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    overstay_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # in `currency`
    overstay_method = models.CharField(max_length=12, choices=PaymentMethod.choices, blank=True)

    issued_by = models.CharField(max_length=80, blank=True)  # attendant name

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self):
        return f"{self.number} · {self.package.name}"

    @property
    def visitors(self):
        return self.adults + self.children

    @staticmethod
    def expiry_for(minutes, config, now=None):
        now = now or timezone.now()
        if minutes:
            return now + timedelta(minutes=minutes)
        close = timezone.localtime(now).replace(
            hour=config.closing_time.hour, minute=config.closing_time.minute,
            second=0, microsecond=0,
        )
        return max(close, now)  # issued after closing → expires immediately

    # --- live state (what the exit scanner shows) ---------------------------
    @property
    def remaining_seconds(self):
        if self.status != self.Status.ACTIVE:
            return 0
        return max(int((self.expires_at - timezone.now()).total_seconds()), 0)

    @property
    def overstay_minutes(self):
        end = self.exited_at or timezone.now()
        over = (end - self.expires_at).total_seconds() / 60
        return max(int(math.ceil(over)), 0)

    def overstay_fee_due_usd(self, at=None):
        """Fee for time past expiry — per started half-hour, whole party.

        Hourly packages overstay at their own hourly party rate (half-rate per
        30-min block); flat packages use the package's overstay rate.
        """
        end = at or self.exited_at or timezone.now()
        over_min = (end - self.expires_at).total_seconds() / 60
        if over_min <= 0:
            return Decimal("0")
        blocks = math.ceil(over_min / 30)
        if self.package.pricing == Package.Pricing.HOURLY:
            party_hour = (self.package.adult_price_usd * self.adults
                          + self.package.child_price_usd * self.children)
            return (blocks * party_hour / 2).quantize(Decimal("0.01"))
        return blocks * self.package.overstay_rate_usd

    def to_currency(self, usd_amount):
        if self.currency == Currency.ZIG:
            return (Decimal(usd_amount) * self.zig_per_usd).quantize(Decimal("0.01"))
        return Decimal(usd_amount).quantize(Decimal("0.01"))

    def record_exit(self, method=""):
        fee_usd = self.overstay_fee_due_usd()
        self.exited_at = timezone.now()
        self.status = self.Status.EXITED
        self.overstay_fee_usd = fee_usd
        self.overstay_fee = self.to_currency(fee_usd)
        if fee_usd > 0:
            self.overstay_method = method or self.payment_method
        self.save()
        # returning the party's wristbands is implied by leaving
        BandAssignment.objects.filter(ticket=self, returned_at__isnull=True).update(
            returned_at=timezone.now())


# --- Child safety (BLE wristbands) -------------------------------------------
class Zone(models.Model):
    """A monitored area — one or more BLE gateways report into a zone."""

    name = models.CharField(max_length=80, unique=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "name"]

    def __str__(self):
        return self.name


class Wristband(models.Model):
    """A reusable BLE wristband, identified by the code printed on it."""

    code = models.CharField(max_length=40, unique=True)  # printed code / BLE MAC
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code

    @property
    def current_assignment(self):
        return self.assignments.filter(returned_at__isnull=True).first()


class BandAssignment(models.Model):
    """A wristband worn by one child for the duration of a visit."""

    wristband = models.ForeignKey(Wristband, related_name="assignments", on_delete=models.CASCADE)
    ticket = models.ForeignKey(Ticket, related_name="bands", on_delete=models.CASCADE)
    child_name = models.CharField(max_length=120)
    assigned_at = models.DateTimeField(auto_now_add=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.child_name} · {self.wristband.code}"

    @property
    def last_sighting(self):
        return (Sighting.objects.filter(wristband=self.wristband, seen_at__gte=self.assigned_at)
                .select_related("zone").order_by("-seen_at").first())


class Sighting(models.Model):
    """A gateway detected a wristband in a zone."""

    wristband = models.ForeignKey(Wristband, related_name="sightings", on_delete=models.CASCADE)
    zone = models.ForeignKey(Zone, related_name="sightings", on_delete=models.CASCADE)
    gateway_id = models.CharField(max_length=64, blank=True)
    seen_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-seen_at"]
