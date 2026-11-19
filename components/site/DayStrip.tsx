/** The trading day on an account, drawn from the real rules: 9:15 open, 3:15 entry cutoff, 3:30 close. */
export default function DayStrip({ minHold, cutoff }: { minHold: number; cutoff: string }) {
  return (
    <div className="day glass" data-reveal>
      <div className="day-track" aria-hidden>
        <i className="open" />
        <i className="exit" />
        <span className="pin p1"><b /></span>
        <span className="pin p2"><b /></span>
        <span className="pin p3"><b /></span>
        <span className="runner" />
      </div>
      <ol className="day-labels">
        <li className="l1"><b>9:15 AM</b><span>Market opens. Orders are accepted. Use a stop loss on every trade: the first trade without one is a warning, the second closes the account.</span></li>
        <li className="l2"><b>{minHold} seconds</b><span>Each position stays open at least this long. Your stop loss still works at any time.</span></li>
        <li className="l3"><b>{cutoff}</b><span>Last time to open a new position. After this you can only close.</span></li>
        <li className="l4"><b>3:30 PM</b><span>Market closes. Daily loss resets for the next session.</span></li>
      </ol>
    </div>
  );
}
