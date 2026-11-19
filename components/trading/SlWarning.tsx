"use client";
/** The one fair warning shown the first time a trade is placed without a stop loss. */
export default function SlWarning({ onClose }: { onClose: () => void }) {
  return (
    <div className="tr-modal" role="alertdialog" aria-modal="true" aria-labelledby="sl-t">
      <div className="tr-modal-card">
        <div className="tr-modal-ico" aria-hidden="true">!</div>
        <h2 id="sl-t">Your trade has no stop loss</h2>
        <p><b>This is your one fair warning.</b> The trade was placed. If you place another trade without a stop loss, your account will be closed.</p>
        <p lang="hi" className="tr-modal-hi">आपका ट्रेड बिना स्टॉप लॉस के लगा है। <b>यह आपकी एकमात्र चेतावनी है।</b> अगली बार बिना स्टॉप लॉस के ट्रेड करने पर आपका अकाउंट बंद कर दिया जाएगा।</p>
        <button className="tr-btn lg buy" onClick={onClose} autoFocus>I understand</button>
      </div>
    </div>
  );
}
