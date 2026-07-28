// Icon + colour art for package cards. Matched by name keywords so packages
// added later in Settings automatically pick up fitting art.
import {
  Bank, Confetti, FilmSlate, Flag, GameController, MapTrifold, SunHorizon,
  Ticket, UsersThree,
} from "@phosphor-icons/react";

const ART = [
  { match: /movie|cinema|film/i, icon: FilmSlate,
    grad: "linear-gradient(150deg,#3A1E5C,#7A3BA8)", tint: "#F1E9F7", deep: "#7A3BA8" },
  { match: /party/i, icon: Confetti,
    grad: "linear-gradient(150deg,#B4560B,#E88D2A)", tint: "#FBEFDF", deep: "#C96E12" },
  { match: /museum/i, icon: Bank,
    grad: "linear-gradient(150deg,#5C3A1E,#B07A3C)", tint: "#F5EDE2", deep: "#8A5B2A" },
  { match: /flag|zdf/i, icon: Flag,
    grad: "linear-gradient(150deg,#0B5A2E,#1F9D57)", tint: "#E4F4EA", deep: "#177A43" },
  { match: /tour|trail|drive/i, icon: MapTrifold,
    grad: "linear-gradient(150deg,#0E3A52,#1E88B5)", tint: "#E6F1F6", deep: "#1E88B5" },
  { match: /outdoor/i, icon: SunHorizon,
    grad: "linear-gradient(150deg,#0F766E,#2DB5A5)", tint: "#E2F4F1", deep: "#159085" },
  { match: /indoor/i, icon: GameController,
    grad: "linear-gradient(150deg,#312E81,#4F46E5)", tint: "#ECEAFB", deep: "#4F46E5" },
  { match: /combo|access|group/i, icon: UsersThree,
    grad: "linear-gradient(150deg,#0057E6,#00B4D8)", tint: "#E3F4F9", deep: "#0077C8" },
];

const DEFAULT = {
  icon: Ticket,
  grad: "linear-gradient(150deg,#001850,#0068F8)", tint: "#E8F1FE", deep: "#0055DD",
};

export function packageArt(pkg) {
  const name = pkg?.name || "";
  return ART.find((a) => a.match.test(name)) || DEFAULT;
}

/* The card art: gradient icon badge + faint oversized watermark that bleeds
   off the card edge, with the package tint washing in from the left. */
export function PackageBadge({ pkg, size = 26 }) {
  const art = packageArt(pkg);
  const Icon = art.icon;
  return (
    <span className="dist-badge" style={{ background: art.grad, border: "none" }}>
      <Icon size={size} weight="fill" color="#fff" />
    </span>
  );
}

export function PackageMark({ pkg }) {
  const art = packageArt(pkg);
  const Icon = art.icon;
  return <Icon className="dist-mark" size={96} weight="fill" style={{ color: art.deep }} aria-hidden />;
}
