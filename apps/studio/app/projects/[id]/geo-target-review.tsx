"use client";

import { useMemo, useState } from "react";
import type { SiteProject } from "@nls/shared";

type GeoTargetReviewProps = {
  project: SiteProject;
};

export function GeoTargetReview({ project }: GeoTargetReviewProps) {
  const [stateFilter, setStateFilter] = useState("all");
  const [query, setQuery] = useState("");

  const stateOptions = useMemo(
    () => Array.from(new Set(project.geoTargets.map((target) => target.state))).sort(),
    [project.geoTargets]
  );

  const filteredTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return project.geoTargets.filter((target) => {
      const matchesState = stateFilter === "all" || target.state === stateFilter;
      const matchesQuery =
        !normalizedQuery ||
        target.city.toLowerCase().includes(normalizedQuery) ||
        target.zip.includes(normalizedQuery) ||
        target.county.toLowerCase().includes(normalizedQuery);

      return matchesState && matchesQuery;
    });
  }, [project.geoTargets, query, stateFilter]);

  const totalStates = stateOptions.length;
  const avgPriority = average(
    filteredTargets.map((target) => target.priorityScore)
  );
  const avgConfidence = average(
    filteredTargets.map((target) => target.dataConfidenceScore)
  );

  return (
    <div className="stack">
      <article className="card">
        <div className="pill-row">
          <span className="pill">Geo targets: {project.geoTargets.length.toLocaleString()}</span>
          <span className="pill">States: {totalStates}</span>
          <span className="pill">Avg priority: {avgPriority}</span>
          <span className="pill">Avg confidence: {avgConfidence}</span>
        </div>
      </article>

      <article className="card fields">
        <div className="split-fields">
          <div className="field">
            <label htmlFor="state-filter">State filter</label>
            <select
              id="state-filter"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
            >
              <option value="all">All states</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="geo-search">Search city, ZIP, or county</label>
            <input
              id="geo-search"
              placeholder="Search Austin, 90210, Orange"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <p className="muted">
          Showing {filteredTargets.length.toLocaleString()} of {project.geoTargets.length.toLocaleString()} targets.
        </p>
      </article>

      <article className="card">
        <h2>Geo target review</h2>
        {filteredTargets.length === 0 ? (
          <p className="muted">No geo targets match the current filters.</p>
        ) : (
          <div className="table-shell">
            <table className="geo-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>State</th>
                  <th>ZIP</th>
                  <th>Payout</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.slice(0, 250).map((target) => (
                  <tr key={`${target.zip}-${target.payoutType}-${target.city}`}>
                    <td>
                      <strong>{target.city}</strong>
                      <div className="table-subtext">{target.county || "County pending"}</div>
                    </td>
                    <td>{target.state}</td>
                    <td>{target.zip}</td>
                    <td>{formatPayout(target.payoutAmount)}</td>
                    <td>{target.payoutType || "Mixed"}</td>
                    <td>{target.priorityScore}</td>
                    <td>{target.dataConfidenceScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredTargets.length > 250 ? (
          <p className="muted">Showing the first 250 matching rows to keep the review page fast.</p>
        ) : null}
      </article>
    </div>
  );
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatPayout(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}
