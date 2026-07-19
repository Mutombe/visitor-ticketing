"""Seed demo data: venue config, packages, time options and a day of tickets."""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from gate.models import GateConfig, Package, Ticket, TimeOption

PACKAGES = [
    dict(name="Pool & Picnic", emoji="🏊", description="Pools, picnic lawns and braai stands",
         adult_price_usd=5, child_price_usd=3, vehicle_fee_usd=2, overstay_rate_usd=2, sort=0),
    dict(name="Game Park Drive", emoji="🦓", description="Self-drive through the game park",
         adult_price_usd=10, child_price_usd=5, vehicle_fee_usd=5, overstay_rate_usd=3, sort=1),
    dict(name="Boat Cruise", emoji="🚤", description="Lake cruise with a guide",
         adult_price_usd=15, child_price_usd=8, vehicle_fee_usd=0, overstay_rate_usd=3, sort=2),
    dict(name="Full Access", emoji="🎉", description="Everything — pools, park, cruise and trails",
         adult_price_usd=25, child_price_usd=12, vehicle_fee_usd=5, overstay_rate_usd=4, sort=3),
]

TIMES = [
    dict(label="1 hour", minutes=60, sort=0),
    dict(label="2 hours", minutes=120, sort=1),
    dict(label="4 hours", minutes=240, sort=2),
    dict(label="Full day", minutes=None, sort=3),
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

    def handle(self, *args, **opts):
        if opts["if_empty"] and Package.objects.exists():
            self.stdout.write("Packages already exist — skipping seed.")
            return
        random.seed(7)
        config = GateConfig.get()

        Ticket.objects.all().delete()
        Package.objects.all().delete()
        TimeOption.objects.all().delete()

        packages = [Package.objects.create(**p) for p in PACKAGES]
        times = [TimeOption.objects.create(**t) for t in TIMES]

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
                reg, vtype = random.choice(VEHICLES)
                currency = random.choice(["USD", "USD", "USD", "ZIG"])
                total_usd = (pkg.adult_price_usd * adults + pkg.child_price_usd * children
                             + (pkg.vehicle_fee_usd if reg else 0))
                t = Ticket(
                    package=pkg, duration_label=opt.label, duration_minutes=opt.minutes,
                    adults=adults, children=children,
                    visitor_name=random.choice(NAMES), phone="",
                    vehicle_reg=reg, vehicle_type=vtype,
                    currency=currency, payment_method=random.choice(METHODS),
                    zig_per_usd=config.zig_per_usd, total_usd=total_usd,
                    expires_at=Ticket.expiry_for(opt.minutes, config, now=issued),
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
