import "./trading.css";

/** Loading placeholder shown while the server checks the session and loads accounts. */
export default function TradingSkeleton() {
  return (
    <div className="tr">
      <div className="tr-orbs" aria-hidden="true"><div className="tr-orb a" /><div className="tr-orb b" /></div>
      <div style={{ paddingInline: "max(16px, env(safe-area-inset-left, 0px))" }}>
        <div className="tr-main" role="status" aria-label="Loading your workspace">
          <div className="tr-top tr-glass" style={{ marginTop: 10 }}><div className="tr-skel" style={{ width: 180 }} /></div>
          <div className="tr-dstats">
            {[0, 1, 2, 3].map((i) => <div key={i} className="tr-glass tr-tile"><div className="tr-skel" style={{ width: "50%" }} /><div className="tr-skel" style={{ width: "80%", height: 22, marginTop: 12 }} /></div>)}
          </div>
          <div className="tr-glass" style={{ height: 280, marginTop: 16 }} />
        </div>
      </div>
    </div>
  );
}
