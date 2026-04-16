import { getWorkbookSummary } from "../lib/workbook-import";

export async function ImportSummary() {
  const summary = await getWorkbookSummary();


  return (
    <article className="card import-summary-card">
      <div className="section-header">
        <div>
          <p className="section-kicker">Geo source</p>
          <h2>Workbook import source</h2>
        </div>
        <span className="pill status-pill">{summary.niches.length} niches</span>
      </div>
      <p className="muted">{summary.statusMessage}</p>
      {summary.workbookPath ? (
        <>
          <p className="muted max-copy">
            Using workbook:
            <br />
            <strong>{summary.workbookPath}</strong>
          </p>
          <div className="stack compact-stack">
            {summary.niches.slice(0, 6).map((niche) => (
              <div className="import-row" key={niche.sheetName}>
                <div>
                  <strong>{niche.sheetName}</strong>
                  <p className="muted">
                    {niche.sampleCities.join(", ") || "City samples unavailable"}
                  </p>
                </div>
                <span className="pill">{niche.rowCount.toLocaleString()} rows</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </article>
  );
}
