// Crazy theme backdrop: original static vector art (halftone dots, angled panels, a brush stroke and an abstract
// weight plate). Decorative only (aria-hidden, pointer-events none). Text never sits directly on it: every text
// block has a solid `.safe` panel in this theme, which is what the contrast test checks.
export function CrazyArt() {
  return (
    <div className="crazy-art" aria-hidden="true">
      <svg viewBox="0 0 390 780" preserveAspectRatio="xMidYMin slice" width="100%" height="100%" focusable="false">
        <defs>
          <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="4.5" cy="4.5" r="2.1" fill="currentColor" /></pattern>
          <pattern id="dotsS" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3" cy="3" r="1.2" fill="currentColor" /></pattern>
        </defs>
        {/* angled colour panels */}
        <polygon className="art-orange" points="0,150 120,90 70,200 0,260" />
        <polygon className="art-orange" points="250,0 330,0 290,70" />
        <polygon className="art-blue" points="390,330 390,420 300,470" />
        <polygon className="art-orange" points="0,470 90,430 0,560" />
        <polygon className="art-orange" points="300,640 390,610 390,700" />
        <polygon className="art-blue" points="0,640 60,690 0,720" />
        {/* weight plate, top right (abstract, drawn from circles) */}
        <g transform="translate(335 95)">
          <circle r="150" className="art-blue" />
          <circle r="118" className="art-plate-ring" />
          <circle r="84" className="art-blue" />
          <circle r="84" fill="url(#dotsS)" className="art-dots-light" />
          <circle r="42" className="art-plate-ring" />
          <circle r="16" className="art-blue" />
          <rect x="-250" y="-12" width="120" height="24" className="art-bar" />
        </g>
        {/* halftone fields */}
        <rect x="262" y="360" width="128" height="120" fill="url(#dots)" className="art-dots-orange" />
        <rect x="0" y="560" width="150" height="160" fill="url(#dots)" className="art-dots-blue" />
        {/* brush stroke under the pace */}
        <path className="art-orange" d="M215 735 l30 -9 60 4 70 -10 10 14 -8 14 -70 6 -60 -2 -30 8 -8 -12z" />
        <path className="art-orange" d="M20 330 l80 -14 90 6 -4 10 -86 4 -78 10z" />
      </svg>
    </div>
  );
}
