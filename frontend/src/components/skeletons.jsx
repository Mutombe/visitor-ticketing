// Content-shaped loading skeletons (no spinners).
function Sk({ w = "100%", h = 14, r = 8, style }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, flex: "none", ...style }} />;
}

/* Scoped: just the package rows inside an otherwise-static card. */
export function PackageRowsSkeleton({ count = 4 }) {
  return (
    <div className="dist-grid cascade">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dist" style={{ pointerEvents: "none" }}>
          <Sk w={58} h={58} r={15} />
          <div className="grow stack" style={{ "--gap": "8px" }}>
            <Sk w="60%" h={14} /><Sk w="85%" h={10} />
          </div>
          <Sk w={44} h={20} />
        </div>
      ))}
    </div>
  );
}

/* Scoped: hour chips while time options load. */
export function ChipsSkeleton({ count = 4 }) {
  return (
    <div className="row wrap cascade" style={{ gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => <Sk key={i} w={92} h={38} r={999} />)}
    </div>
  );
}

/* Scoped: stat tiles while live numbers load. */
export function StatTilesSkeleton({ count = 4 }) {
  return (
    <div className="stats cascade">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat stack" style={{ "--gap": "8px" }}>
          <Sk w="65%" h={26} /><Sk w="45%" h={10} />
        </div>
      ))}
    </div>
  );
}

/* Gate sale screen: package rows + time chips on the left, summary on the right */
export function GateSkeleton() {
  return (
    <div className="container section stack fade-in" style={{ "--gap": "22px" }}>
      <div className="stack" style={{ "--gap": "8px" }}>
        <Sk w={110} h={12} /><Sk w={220} h={34} />
      </div>
      <div className="grid-cols">
        <div className="stack" style={{ "--gap": "18px" }}>
          <div className="card card-p stack" style={{ "--gap": "14px" }}>
            <Sk w={130} h={18} />
            <div className="dist-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="dist" style={{ pointerEvents: "none" }}>
                  <Sk w={58} h={58} r={15} />
                  <div className="grow stack" style={{ "--gap": "8px" }}>
                    <Sk w="60%" h={14} /><Sk w="85%" h={10} />
                  </div>
                  <Sk w={44} h={20} />
                </div>
              ))}
            </div>
          </div>
          <div className="card card-p stack" style={{ "--gap": "14px" }}>
            <Sk w={150} h={18} />
            <div className="row wrap" style={{ gap: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => <Sk key={i} w={92} h={38} r={999} />)}
            </div>
            <div className="grid-2">
              <div className="tt-row"><div className="grow stack" style={{ "--gap": "6px" }}><Sk w="50%" h={14} /><Sk w="35%" h={10} /></div><Sk w={100} h={36} r={999} /></div>
              <div className="tt-row"><div className="grow stack" style={{ "--gap": "6px" }}><Sk w="50%" h={14} /><Sk w="35%" h={10} /></div><Sk w={100} h={36} r={999} /></div>
            </div>
          </div>
        </div>
        <div className="card card-p stack" style={{ "--gap": "14px" }}>
          <Sk w={120} h={18} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stack" style={{ "--gap": "6px" }}><Sk w="30%" h={10} /><Sk w="60%" h={14} /></div>
          ))}
          <div className="hair" />
          <div className="spread"><Sk w={60} h={14} /><Sk w={90} h={28} /></div>
          <Sk h={58} r={999} />
        </div>
      </div>
    </div>
  );
}

/* Ticket page: bib card + action buttons */
export function TicketSkeleton() {
  return (
    <div className="container section fade-in" style={{ maxWidth: 520 }}>
      <div className="skel" style={{ height: 420, borderRadius: "var(--radius-lg)" }} />
      <div className="stack" style={{ marginTop: 16, "--gap": "10px" }}>
        <Sk h={58} r={999} />
        <div className="grid-2" style={{ gap: 10 }}><Sk h={50} r={999} /><Sk h={50} r={999} /></div>
        <div className="grid-2" style={{ gap: 10 }}><Sk h={50} r={999} /><Sk h={50} r={999} /></div>
      </div>
    </div>
  );
}

/* Table rows (history + report recents) */
export function TableSkeleton({ rows = 8 }) {
  return (
    <div className="stack" style={{ "--gap": "14px", padding: "6px 0" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="row" style={{ gap: 14 }}>
          <Sk w={86} h={14} /><Sk w="26%" h={14} /><Sk w={54} h={14} />
          <Sk w={90} h={22} r={999} style={{ marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}

/* Reports: stat tiles + mix cards */
export function ReportsSkeleton() {
  return (
    <div className="stack fade-in" style={{ "--gap": "20px" }}>
      <div className="stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat stack" style={{ "--gap": "8px" }}>
            <Sk w="65%" h={26} /><Sk w="45%" h={10} />
          </div>
        ))}
      </div>
      <div className="grid-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card card-p stack" style={{ "--gap": "12px" }}>
            <Sk w={140} h={18} />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="stack" style={{ "--gap": "6px" }}>
                <div className="spread"><Sk w="40%" h={12} /><Sk w={60} h={12} /></div>
                <Sk h={7} r={999} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="card card-p stack" style={{ "--gap": "12px" }}>
        <Sk w={150} h={18} /><TableSkeleton rows={5} />
      </div>
    </div>
  );
}
