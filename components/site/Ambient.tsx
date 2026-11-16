/** The glow that sits behind the glass. Three slow blobs, fixed to the viewport. */
export default function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <i /><i /><i />
      <span className="grain" />
    </div>
  );
}
