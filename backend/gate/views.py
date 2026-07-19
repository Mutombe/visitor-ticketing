from collections import Counter
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import GateConfig, Package, Ticket, TimeOption
from .serializers import (
    IssueTicketSerializer, PackageSerializer, TicketSerializer, TimeOptionSerializer,
)


@api_view(["GET"])
def config(request):
    """Everything the gate screen needs to price a ticket."""
    c = GateConfig.get()
    return Response({
        "venue_name": c.venue_name,
        "venue_city": c.venue_city,
        "zig_per_usd": str(c.zig_per_usd),
        "closing_time": c.closing_time.strftime("%H:%M"),
        "packages": PackageSerializer(Package.objects.filter(active=True), many=True).data,
        "time_options": TimeOptionSerializer(TimeOption.objects.filter(active=True), many=True).data,
    })


@api_view(["GET", "POST"])
def tickets(request):
    if request.method == "POST":
        ser = IssueTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        t = ser.save()
        return Response(TicketSerializer(t).data, status=status.HTTP_201_CREATED)

    # GET — history with search + filters
    qs = Ticket.objects.select_related("package")
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(
            Q(number__icontains=q) | Q(visitor_name__icontains=q)
            | Q(phone__icontains=q) | Q(vehicle_reg__icontains=q)
        )
    day = request.GET.get("date", "").strip()
    if day:
        d = datetime.strptime(day, "%Y-%m-%d").date()
        tz = timezone.get_current_timezone()
        start = timezone.make_aware(datetime.combine(d, time.min), tz)
        qs = qs.filter(issued_at__gte=start, issued_at__lt=start + timedelta(days=1))
    st = request.GET.get("state", "").strip()
    now = timezone.now()
    if st == "VALID":
        qs = qs.filter(status=Ticket.Status.ACTIVE, expires_at__gte=now)
    elif st == "EXPIRED":
        qs = qs.filter(status=Ticket.Status.ACTIVE, expires_at__lt=now)
    elif st:
        qs = qs.filter(status=st)
    return Response(TicketSerializer(qs[:200], many=True).data)


def _find(ref):
    """Accept a QR token, a 'GATEPASS:<token>' scan, or a ticket number."""
    ref = ref.strip().replace("GATEPASS:", "")
    return (
        Ticket.objects.select_related("package")
        .filter(Q(qr_token=ref) | Q(number__iexact=ref))
        .first()
    )


@api_view(["GET"])
def ticket_lookup(request, ref):
    t = _find(ref)
    if not t:
        return Response({"detail": "Ticket not found."}, status=404)
    return Response(TicketSerializer(t).data)


@api_view(["POST"])
def ticket_exit(request, ref):
    t = _find(ref)
    if not t:
        return Response({"detail": "Ticket not found."}, status=404)
    if t.status == Ticket.Status.EXITED:
        return Response({"detail": "Already exited.", "ticket": TicketSerializer(t).data})
    if t.status == Ticket.Status.CANCELLED:
        return Response({"detail": "Ticket was cancelled."}, status=400)
    t.record_exit(method=request.data.get("payment_method", ""))
    return Response({"ticket": TicketSerializer(t).data})


@api_view(["GET"])
def reports(request):
    tz = timezone.get_current_timezone()
    today = timezone.localdate()
    d_from = request.GET.get("from") or str(today)
    d_to = request.GET.get("to") or d_from
    start = timezone.make_aware(
        datetime.combine(datetime.strptime(d_from, "%Y-%m-%d").date(), time.min), tz)
    end = timezone.make_aware(
        datetime.combine(datetime.strptime(d_to, "%Y-%m-%d").date(), time.max), tz)

    qs = Ticket.objects.select_related("package").filter(
        issued_at__range=(start, end)).exclude(status=Ticket.Status.CANCELLED)

    revenue = {"USD": Decimal("0"), "ZIG": Decimal("0")}
    overstay = {"USD": Decimal("0"), "ZIG": Decimal("0")}
    pay_mix, hourly = Counter(), Counter()
    pkg_mix = {}
    adults = children = vehicles = inside = 0
    now = timezone.now()

    for t in qs:
        revenue[t.currency] += t.total
        overstay[t.currency] += t.overstay_fee
        pay_mix[t.payment_method] += 1
        adults += t.adults
        children += t.children
        vehicles += 1 if t.vehicle_reg else 0
        if t.status == Ticket.Status.ACTIVE and t.expires_at >= now:
            inside += t.visitors
        hourly[timezone.localtime(t.issued_at).hour] += 1
        p = pkg_mix.setdefault(t.package.name, {
            "name": t.package.name, "emoji": t.package.emoji,
            "tickets": 0, "visitors": 0, "revenue_usd": Decimal("0"),
        })
        p["tickets"] += 1
        p["visitors"] += t.visitors
        p["revenue_usd"] += t.total_usd + t.overstay_fee_usd

    recent = TicketSerializer(qs[:12], many=True).data
    return Response({
        "from": d_from, "to": d_to,
        "tickets": qs.count(),
        "adults": adults, "children": children,
        "visitors": adults + children,
        "vehicles": vehicles,
        "inside_now": inside,
        "revenue": {k: str(v) for k, v in revenue.items()},
        "overstay": {k: str(v) for k, v in overstay.items()},
        "payment_mix": dict(pay_mix),
        "package_mix": sorted(
            ({**p, "revenue_usd": str(p["revenue_usd"])} for p in pkg_mix.values()),
            key=lambda p: p["tickets"], reverse=True),
        "hourly": [{"hour": h, "count": hourly.get(h, 0)} for h in range(6, 22)],
        "recent": recent,
    })
