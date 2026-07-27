from collections import Counter
from datetime import datetime, time, timedelta
from decimal import Decimal

import requests as http
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    BandAssignment, GateConfig, Package, Profile, Role, Sighting, Ticket,
    TimeOption, Wristband, Zone,
)
from .permissions import AdminOnly, AnyStaff, CanReport, CanScan, CanSell, user_role
from .serializers import (
    ChildStatusSerializer, ConfigAdminSerializer, IssueTicketSerializer,
    PackageAdminSerializer, PackageSerializer, StaffSerializer,
    TicketSerializer, TimeOptionAdminSerializer, TimeOptionSerializer,
    WristbandSerializer, ZoneSerializer,
)


# --- Auth --------------------------------------------------------------------
def _user_payload(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "name": user.get_full_name() or user.first_name or user.username,
        "email": user.email,
        "role": user_role(user),
        "avatar_url": profile.avatar_url if profile else "",
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(
        username=request.data.get("username", ""),
        password=request.data.get("password", ""),
    )
    if not user or not user.is_active:
        return Response({"detail": "Wrong username or password."}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": _user_payload(user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    """Optional visitor sign-in. Accepts {credential} (GIS) or {access_token} (popup).
    Staff keep username/password; Google accounts get the VISITOR role."""
    if not settings.GOOGLE_CLIENT_ID:
        return Response({"detail": "Google sign-in is not configured."}, status=400)
    credential = request.data.get("credential")
    access_token = request.data.get("access_token")
    info = None
    if credential:
        try:
            info = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        except ValueError as exc:
            return Response({"detail": f"Invalid Google token: {exc}"}, status=401)
    elif access_token:
        try:
            ti = http.get("https://oauth2.googleapis.com/tokeninfo",
                          params={"access_token": access_token}, timeout=10).json()
            if settings.GOOGLE_CLIENT_ID not in (ti.get("aud"), ti.get("azp")):
                return Response({"detail": "Token not issued for this app."}, status=401)
            info = http.get("https://www.googleapis.com/oauth2/v3/userinfo",
                            headers={"Authorization": f"Bearer {access_token}"},
                            timeout=10).json()
        except Exception as exc:
            return Response({"detail": f"Could not verify Google sign-in: {exc}"}, status=401)
    else:
        return Response({"detail": "Missing credential."}, status=400)

    email = info.get("email", "")
    if not email:
        return Response({"detail": "Google account has no email."}, status=400)
    user, _ = User.objects.get_or_create(
        username=email,
        defaults={"email": email,
                  "first_name": info.get("given_name", "")[:30],
                  "last_name": info.get("family_name", "")[:150]},
    )
    # New Google users are visitors; an existing staff profile keeps its role.
    profile, _ = Profile.objects.get_or_create(user=user, defaults={"role": Role.VISITOR})
    profile.google_sub = info.get("sub", "")
    profile.avatar_url = info.get("picture", "")
    profile.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": _user_payload(user)})


@api_view(["POST"])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=204)


@api_view(["GET"])
def me(request):
    return Response(_user_payload(request.user))


# --- Gate --------------------------------------------------------------------
def _config_payload():
    c = GateConfig.get()
    return {
        "venue_name": c.venue_name,
        "venue_city": c.venue_city,
        "zig_per_usd": str(c.zig_per_usd),
        "closing_time": c.closing_time.strftime("%H:%M"),
        "packages": PackageSerializer(Package.objects.filter(active=True), many=True).data,
        "time_options": TimeOptionSerializer(TimeOption.objects.filter(active=True), many=True).data,
    }


@api_view(["GET"])
@permission_classes([AnyStaff])
def config(request):
    """Everything the gate screen needs to price a ticket."""
    return Response(_config_payload())


@api_view(["GET"])
@permission_classes([AllowAny])
def public_config(request):
    """The public storefront: packages and prices are public information."""
    return Response(_config_payload())


PUBLIC_ORDER_FIELDS = {"package", "time_option", "adults", "children",
                       "visitor_name", "phone", "email", "currency", "payment_method"}


@api_view(["POST"])
@permission_classes([AllowAny])
def public_order(request):
    """Visitors buy their own ticket online — no account needed.
    Payment is recorded as paid (simulated) — wire Paynow/EcoCash checkout next."""
    data = {k: v for k, v in request.data.items() if k in PUBLIC_ORDER_FIELDS}
    ser = IssueTicketSerializer(data=data)
    ser.is_valid(raise_exception=True)
    t = ser.save(
        issued_by="Online",
        buyer=request.user if getattr(request.user, "is_authenticated", False) else None,
    )
    return Response(TicketSerializer(t).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_tickets(request):
    qs = Ticket.objects.select_related("package").filter(buyer=request.user)[:50]
    return Response(TicketSerializer(qs, many=True).data)


@api_view(["GET", "POST"])
@permission_classes([AnyStaff])
def tickets(request):
    if request.method == "POST":
        if not CanSell().has_permission(request, None):
            return Response({"detail": "Your role cannot issue tickets."}, status=403)
        ser = IssueTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        t = ser.save()
        if not t.issued_by:
            t.issued_by = request.user.first_name or request.user.username
            t.save(update_fields=["issued_by"])
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
@permission_classes([AllowAny])   # visitors open their own ticket by unguessable token
def ticket_lookup(request, ref):
    t = _find(ref)
    if not t:
        return Response({"detail": "Ticket not found."}, status=404)
    return Response(TicketSerializer(t).data)


@api_view(["POST"])
@permission_classes([CanScan])
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


# --- Security dashboard ------------------------------------------------------
@api_view(["GET"])
@permission_classes([CanScan])
def security_stats(request):
    """Live numbers + activity for the exit-gate dashboard."""
    now = timezone.now()
    tz = timezone.get_current_timezone()
    day_start = timezone.make_aware(datetime.combine(timezone.localdate(), time.min), tz)
    active = Ticket.objects.filter(status=Ticket.Status.ACTIVE)
    inside = active.filter(expires_at__gte=now)
    overdue = active.filter(expires_at__lt=now).select_related("package")
    exited_today = Ticket.objects.filter(status=Ticket.Status.EXITED, exited_at__gte=day_start)
    return Response({
        "inside_tickets": inside.count(),
        "inside_visitors": sum(t.visitors for t in inside),
        "overdue_tickets": overdue.count(),
        "children_banded": BandAssignment.objects.filter(returned_at__isnull=True).count(),
        "exits_today": exited_today.count(),
        "overtime_today": str(sum((t.overstay_fee_usd for t in exited_today), Decimal("0"))),
        "overdue": TicketSerializer(overdue[:20], many=True).data,
        "recent_exits": TicketSerializer(
            exited_today.order_by("-exited_at")[:10], many=True).data,
    })


# --- Child safety ------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AnyStaff])
def children(request):
    """Children currently wearing wristbands (or all of today with ?all=1)."""
    qs = BandAssignment.objects.select_related("wristband", "ticket")
    if request.GET.get("all") != "1":
        qs = qs.filter(returned_at__isnull=True)
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(
            Q(child_name__icontains=q) | Q(wristband__code__icontains=q)
            | Q(ticket__number__icontains=q) | Q(ticket__visitor_name__icontains=q)
        )
    return Response(ChildStatusSerializer(qs[:100], many=True).data)


@api_view(["POST"])
@permission_classes([AnyStaff])
def band_assign(request, ref):
    """Put a wristband on a child mid-visit (after the ticket was issued)."""
    t = _find(ref)
    if not t:
        return Response({"detail": "Ticket not found."}, status=404)
    code = str(request.data.get("code", "")).strip()
    band = Wristband.objects.filter(code__iexact=code, active=True).first()
    if not band:
        return Response({"detail": f"Wristband {code} is not registered."}, status=400)
    if band.current_assignment:
        return Response({"detail": f"Wristband {code} is already worn by a child."}, status=400)
    a = BandAssignment.objects.create(
        wristband=band, ticket=t,
        child_name=str(request.data.get("child_name", "")).strip() or "Child",
    )
    return Response(ChildStatusSerializer(a).data, status=201)


@api_view(["POST"])
@permission_classes([AnyStaff])
def band_return(request, code):
    a = (BandAssignment.objects.filter(wristband__code__iexact=code, returned_at__isnull=True)
         .first())
    if not a:
        return Response({"detail": "This wristband is not currently assigned."}, status=404)
    a.returned_at = timezone.now()
    a.save(update_fields=["returned_at"])
    return Response(ChildStatusSerializer(a).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def ble_sighting(request):
    """BLE gateways report wristband detections. Auth: X-Gateway-Key header.

    Body: {"wristband": "MFB-001", "zone": <zone id or name>, "gateway": "gw-hall-1"}
    """
    key = request.headers.get("X-Gateway-Key", "")
    if not key or key != GateConfig.get().gateway_key:
        return Response({"detail": "Bad gateway key."}, status=401)
    band = Wristband.objects.filter(code__iexact=str(request.data.get("wristband", "")).strip()).first()
    if not band:
        return Response({"detail": "Unknown wristband."}, status=404)
    z = request.data.get("zone", "")
    zone = Zone.objects.filter(Q(pk=z) if str(z).isdigit() else Q(name__iexact=str(z))).first()
    if not zone:
        return Response({"detail": "Unknown zone."}, status=404)
    Sighting.objects.create(
        wristband=band, zone=zone, gateway_id=str(request.data.get("gateway", ""))[:64])
    return Response({"ok": True}, status=201)


# --- Reports (management) ----------------------------------------------------
@api_view(["GET"])
@permission_classes([CanReport])
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
    pay_mix, hourly, staff = Counter(), Counter(), {}
    pkg_mix = {}
    adults = children_n = vehicles = inside = 0
    now = timezone.now()

    for t in qs:
        revenue[t.currency] += t.total
        overstay[t.currency] += t.overstay_fee
        pay_mix[t.payment_method] += 1
        adults += t.adults
        children_n += t.children
        vehicles += 1 if t.vehicle_reg else 0
        if t.status == Ticket.Status.ACTIVE and t.expires_at >= now:
            inside += t.visitors
        hourly[timezone.localtime(t.issued_at).hour] += 1
        s = staff.setdefault(t.issued_by or "—", {"name": t.issued_by or "—",
                                                  "tickets": 0, "revenue_usd": Decimal("0")})
        s["tickets"] += 1
        s["revenue_usd"] += t.total_usd + t.overstay_fee_usd
        p = pkg_mix.setdefault(t.package.name, {
            "name": t.package.name, "emoji": t.package.emoji,
            "tickets": 0, "visitors": 0, "revenue_usd": Decimal("0"),
        })
        p["tickets"] += 1
        p["visitors"] += t.visitors
        p["revenue_usd"] += t.total_usd + t.overstay_fee_usd

    bands = BandAssignment.objects.filter(assigned_at__range=(start, end))
    recent = TicketSerializer(qs[:12], many=True).data
    return Response({
        "from": d_from, "to": d_to,
        "tickets": qs.count(),
        "adults": adults, "children": children_n,
        "visitors": adults + children_n,
        "vehicles": vehicles,
        "inside_now": inside,
        "children_banded_now": BandAssignment.objects.filter(returned_at__isnull=True).count(),
        "bands_used": bands.count(),
        "revenue": {k: str(v) for k, v in revenue.items()},
        "overstay": {k: str(v) for k, v in overstay.items()},
        "payment_mix": dict(pay_mix),
        "staff_activity": sorted(
            ({**s, "revenue_usd": str(s["revenue_usd"])} for s in staff.values()),
            key=lambda s: s["tickets"], reverse=True),
        "package_mix": sorted(
            ({**p, "revenue_usd": str(p["revenue_usd"])} for p in pkg_mix.values()),
            key=lambda p: p["tickets"], reverse=True),
        "hourly": [{"hour": h, "count": hourly.get(h, 0)} for h in range(6, 22)],
        "recent": recent,
    })


# --- Admin management --------------------------------------------------------
def _crud(request, model, serializer_cls, pk=None, order="sort"):
    if pk is not None:
        obj = model.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=404)
        if request.method == "DELETE":
            try:
                obj.delete()
            except Exception:
                return Response(
                    {"detail": "In use by existing tickets — deactivate it instead."},
                    status=400)
            return Response(status=204)
        ser = serializer_cls(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
    if request.method == "POST":
        ser = serializer_cls(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=201)
    return Response(serializer_cls(model.objects.order_by(order), many=True).data)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def admin_packages(request):
    return _crud(request, Package, PackageAdminSerializer)


@api_view(["PATCH", "DELETE"])
@permission_classes([AdminOnly])
def admin_package(request, pk):
    return _crud(request, Package, PackageAdminSerializer, pk=pk)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def admin_times(request):
    return _crud(request, TimeOption, TimeOptionAdminSerializer)


@api_view(["PATCH", "DELETE"])
@permission_classes([AdminOnly])
def admin_time(request, pk):
    return _crud(request, TimeOption, TimeOptionAdminSerializer, pk=pk)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def admin_zones(request):
    return _crud(request, Zone, ZoneSerializer)


@api_view(["PATCH", "DELETE"])
@permission_classes([AdminOnly])
def admin_zone(request, pk):
    return _crud(request, Zone, ZoneSerializer, pk=pk)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def admin_bands(request):
    """POST {"codes": "MFB-001, MFB-002"} bulk-registers wristbands."""
    if request.method == "POST" and request.data.get("codes"):
        made = []
        for code in str(request.data["codes"]).replace("\n", ",").split(","):
            code = code.strip().upper()
            if code and not Wristband.objects.filter(code__iexact=code).exists():
                made.append(Wristband.objects.create(code=code))
        return Response(WristbandSerializer(made, many=True).data, status=201)
    return _crud(request, Wristband, WristbandSerializer, order="code")


@api_view(["PATCH", "DELETE"])
@permission_classes([AdminOnly])
def admin_band(request, pk):
    return _crud(request, Wristband, WristbandSerializer, pk=pk, order="code")


@api_view(["GET", "PATCH"])
@permission_classes([AdminOnly])
def admin_config(request):
    c = GateConfig.get()
    if request.method == "PATCH":
        ser = ConfigAdminSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
    return Response(ConfigAdminSerializer(c).data)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def admin_staff(request):
    if request.method == "POST":
        ser = StaffSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(StaffSerializer(user).data, status=201)
    users = User.objects.filter(is_superuser=False).order_by("username")
    return Response(StaffSerializer(users, many=True).data)


@api_view(["PATCH"])
@permission_classes([AdminOnly])
def admin_staff_one(request, pk):
    user = User.objects.filter(pk=pk, is_superuser=False).first()
    if not user:
        return Response({"detail": "Not found."}, status=404)
    ser = StaffSerializer(user, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(StaffSerializer(user).data)
