import { useState } from "react";

const assignReviewers = (names) => {
  const reviewersPerPerson = 5;
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const MAX_ATTEMPTS = 100;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const pool = shuffle(
      names.flatMap((name) => Array(reviewersPerPerson).fill(name)),
    );
    const assignments = Object.fromEntries(names.map((n) => [n, []]));
    let failed = false;
    for (const reviewer of pool) {
      const candidates = names.filter(
        (name) =>
          name !== reviewer &&
          assignments[name].length < reviewersPerPerson &&
          !assignments[name].includes(reviewer),
      );
      if (candidates.length === 0) {
        failed = true;
        break;
      }
      candidates.sort((a, b) => assignments[a].length - assignments[b].length);
      assignments[candidates[0]].push(reviewer);
    }
    if (!failed) return assignments;
  }
  return null;
};

export default function App() {
  const [groups, setGroups] = useState(null);
  const [assignments, setAssignments] = useState(null);

  const parseFile = (text) => {
    const result = { yes: [], maybe: [] };
    let current = null;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "end") continue;
      if (trimmed === "yes") {
        current = "yes";
        continue;
      }
      if (trimmed === "maybe") {
        current = "maybe";
        continue;
      }
      if (trimmed === "no") {
        current = null;
        continue;
      }
      if (current) result[current].push(trimmed);
    }
    return result;
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseFile(ev.target.result);
      setGroups(parsed);
      setAssignments(assignReviewers(parsed.yes));
    };
    reader.readAsText(file);
  };

  const Section = ({ title, names, color }) => (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{ color, borderBottom: `2px solid ${color}`, paddingBottom: 6 }}
      >
        {title} ({names.length})
      </h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {names.map((name) => (
          <li key={name} style={{ padding: "6px 0", fontSize: 16 }}>
            <strong>{name}</strong>
            {assignments?.[name] && (
              <span style={{ color: "#555", marginLeft: 12, fontSize: 14 }}>
                reviews: {assignments[name].join(", ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: 700,
        margin: "40px auto",
        fontFamily: "sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ marginBottom: 24 }}>RSVP List</h1>
      <input
        type="file"
        accept=".txt"
        onChange={handleFile}
        style={{ marginBottom: 32 }}
      />
      {groups && (
        <>
          <Section title="Yes" names={groups.yes} color="#16a34a" />
          <Section title="Maybe" names={groups.maybe} color="#d97706" />
        </>
      )}
    </div>
  );
}
