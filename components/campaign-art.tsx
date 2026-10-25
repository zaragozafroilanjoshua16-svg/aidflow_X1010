export function CampaignArt({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`campaign-art ${compact ? "compact" : ""}`}
      role="img"
      aria-label="Illustration of a coastal community with homes, hills and water"
    >
      <div className="art-grid" />
      <div className="art-sun" />
      <div className="art-hill back" />
      <div className="art-hill front" />
      <div className="art-water" />
      <div className="art-home one">
        <div className="roof" />
        <div className="door" />
        <div className="window" />
      </div>
      <div className="art-home two">
        <div className="roof" />
        <div className="door" />
        <div className="window" />
      </div>
      <div className="art-tree">
        <span />
        <i />
      </div>
      <span className="art-location">
        11.2° N · 125.0° E<br />
        EASTERN VISAYAS
      </span>
      <span className="art-label">FICTIONAL COMMUNITY</span>
      <div className="art-grain" />
    </div>
  );
}
