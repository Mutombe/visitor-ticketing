"""Seed demo data: venue config, packages, time options and a day of tickets."""
import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from gate.models import GateConfig, Package, Ticket, TimeOption
from gate.serializers import IssueTicketSerializer

# Max Fun Entertainment — packages from the director.
PACKAGES = [
    # Play (hourly — price × hours picked at the gate, per person)
    dict(name="General Indoor Play", group="Play", emoji="🎪", pricing="HOURLY",
         description="Indoor play area — $10 per hour",
         adult_price_usd=10, child_price_usd=10, overstay_rate_usd=5, sort=0),
    dict(name="General Outdoor Play", group="Play", emoji="🛝", pricing="HOURLY",
         description="Outdoor play area — $5 per hour",
         adult_price_usd=5, child_price_usd=5, overstay_rate_usd=3, sort=1),
    dict(name="Play Combo", group="Play", emoji="🎡", pricing="HOURLY",
         description="Indoor + outdoor play — $13 per hour",
         adult_price_usd=13, child_price_usd=13, overstay_rate_usd=7, sort=2),
    # Play (flat price, fixed duration)
    dict(name="Play & Movie", group="Play", emoji="🎬", pricing="FIXED", fixed_minutes=180,
         description="Play + movie session — $15 for 3 hours",
         adult_price_usd=15, child_price_usd=15, overstay_rate_usd=3, sort=3),
    dict(name="Party Combo", group="Play", emoji="🎉", pricing="FIXED", fixed_minutes=360,
         description="$18 per child for 6 hours — accompanying adults free",
         adult_price_usd=0, child_price_usd=18, overstay_rate_usd=3, sort=4),
    # Museum (flat per person, valid until closing)
    dict(name="Museum Tour", group="Museum", emoji="🏛️", pricing="FIXED",
         description="Guided museum tour — $5 per person",
         adult_price_usd=5, child_price_usd=5, overstay_rate_usd=2, sort=5),
    dict(name="Flag Tour & ZDF Park", group="Museum", emoji="🚩", pricing="FIXED",
         description="Flag tour and ZDF park — $3 per person",
         adult_price_usd=3, child_price_usd=3, overstay_rate_usd=2, sort=6),
    dict(name="Tour Combo", group="Museum", emoji="🗺️", pricing="FIXED",
         description="Museum, flags and ZDF park — $7 per person",
         adult_price_usd=7, child_price_usd=7, overstay_rate_usd=2, sort=7),
]

TIMES = [
    dict(label="1 hour", minutes=60, sort=0),
    dict(label="2 hours", minutes=120, sort=1),
    dict(label="3 hours", minutes=180, sort=2),
    dict(label="4 hours", minutes=240, sort=3),
]

NAMES = ["Tendai Moyo", "Rudo Ncube", "Blessing Chirwa", "Nyasha Dube", "Tatenda Sibanda",
         "Chipo Mlambo", "Farai Gumbo", "Kudzai Mhofu", "", "", ""]
VEHICLES = [("ABZ 4521", "Sedan"), ("AEC 8890", "SUV"), ("AFH 1207", "Minibus"), ("", ""), ("", "")]
METHODS = ["CASH", "CASH", "ECOCASH", "ECOCASH", "ONEMONEY", "ZIPIT", "CARD", "INNBUCKS"]


class Command(BaseCommand):
    help = "Seed demo packages, time options and tickets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-empty", action="store_true",
            help="Only seed when no packages exist yet (safe for deploy hooks).",
        )
        parser.add_argument(
            "--no-tickets", action="store_true",
            help="Seed packages/config only, no demo tickets (production).",
        )

    def handle(self, *args, **opts):
        if opts["if_empty"] and Package.objects.exists():
            self.stdout.write("Packages already exist — skipping seed.")
            return
        random.seed(7)
        config = GateConfig.get()
        config.venue_name = "Max Fun Entertainment"
        config.save()

        Ticket.objects.all().delete()
        Package.objects.all().delete()
        TimeOption.objects.all().delete()

        packages = [Package.objects.create(**p) for p in PACKAGES]
        times = [TimeOption.objects.create(**t) for t in TIMES]

        if opts["no_tickets"]:
            self.stdout.write(self.style.SUCCESS(
                f"Seeded {len(packages)} packages and {len(times)} time options (no tickets)."))
            return

        now = timezone.now()
        made = 0
        for day_offset in (1, 0):  # yesterday + today
            day_start = (now - timedelta(days=day_offset)).replace(
                hour=8, minute=0, second=0, microsecond=0)
            for _ in range(18 if day_offset == 0 else 14):
                pkg = random.choice(packages)
                opt = random.choice(times)
                issued = day_start + timedelta(minutes=random.randint(0, 9 * 60))
                if issued > now:
                    continue
                adults = random.randint(1, 4)
                children = random.choice([0, 0, 1, 2, 3])
                if pkg.name == "Party Combo" and children == 0:
                    children = random.randint(4, 10)   # parties are for kids
                reg, vtype = random.choice(VEHICLES)
                currency = random.choice(["USD", "USD", "USD", "ZIG"])
                minutes, label = IssueTicketSerializer._duration(pkg, opt)
                total_usd = pkg.adult_price_usd * adults + pkg.child_price_usd * children
                if pkg.pricing == Package.Pricing.HOURLY:
                    total_usd = total_usd * Decimal(minutes) / Decimal(60)
                total_usd += pkg.vehicle_fee_usd if reg else 0
                t = Ticket(
                    package=pkg, duration_label=label, duration_minutes=minutes,
                    adults=adults, children=children,
                    visitor_name=random.choice(NAMES), phone="",
                    vehicle_reg=reg, vehicle_type=vtype,
                    currency=currency, payment_method=random.choice(METHODS),
                    zig_per_usd=config.zig_per_usd, total_usd=total_usd,
                    expires_at=Ticket.expiry_for(minutes, config, now=issued),
                    issued_by="Demo",
                )
                t.total = t.to_currency(total_usd)
                t.save()
                # issued_at is auto_now_add — backdate it
                Ticket.objects.filter(pk=t.pk).update(issued_at=issued)
                t.refresh_from_db()
                # most past-expiry tickets exited (some with an overstay fee)
                if t.expires_at < now and random.random() < 0.75:
                    exit_at = t.expires_at + timedelta(
                        minutes=random.choice([0, 0, 10, 25, 45, 75]))
                    if exit_at < now:
                        fee_usd = t.overstay_fee_due_usd(at=exit_at)
                        Ticket.objects.filter(pk=t.pk).update(
                            status=Ticket.Status.EXITED, exited_at=exit_at,
                            overstay_fee_usd=fee_usd, overstay_fee=t.to_currency(fee_usd),
                            overstay_method=t.payment_method if fee_usd else "",
                        )
                made += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(packages)} packages, {len(times)} time options, {made} tickets."))
