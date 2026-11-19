/** Small inline spinner that inherits the button's text colour. */
export function Spin({ size = 14 }: { size?: number }) {
  return <span className="spin" style={{ width: size, height: size }} aria-hidden />;
}

/** Full-screen "working" state with the logo and a ring. */
export function Splash({ text, inline }: { text: string; inline?: boolean }) {
  return (
    <div className={"splash" + (inline ? " inline" : "")} role="status" aria-live="polite">
      <div className="splash-ring"><i /><b /></div>
      <p>{text}</p>
    </div>
  );
}
