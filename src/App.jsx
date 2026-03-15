import { useState } from "react";

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const assignYesReviewers = (names) => {
  const reviewersPerPerson = 5;
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

const assignMaybeReviewers = (yesNames, maybeNames, assignments) => {
  const result = {
    ...Object.fromEntries(
      Object.entries(assignments).map(([k, v]) => [k, [...v]]),
    ),
  };
  const maybePerPerson = 2;
  const totalSlots = yesNames.length * maybePerPerson;
  const baseCount = Math.floor(totalSlots / maybeNames.length);
  const extra = totalSlots % maybeNames.length;
  const shuffledMaybe = shuffle([...maybeNames]);
  const pool = shuffle(
    shuffledMaybe.flatMap((name, i) =>
      Array(baseCount + (i < extra ? 1 : 0)).fill(name),
    ),
  );
  let failed = false;
  for (const maybe of pool) {
    const candidates = yesNames.filter(
      (name) =>
        result[name].filter((r) => maybeNames.includes(r)).length <
          maybePerPerson && !result[name].includes(maybe),
    );
    if (candidates.length === 0) {
      failed = true;
      break;
    }
    candidates.sort(
      (a, b) =>
        result[a].filter((r) => maybeNames.includes(r)).length -
        result[b].filter((r) => maybeNames.includes(r)).length,
    );
    result[candidates[0]].push(maybe);
  }
  return failed ? null : result;
};

// Assign 7 reviewers to each maybe person:
// - First fill with other maybe names (no self, no dupes)
// - Then fill remaining slots with yes names, distributed evenly
const assignMaybePersonReviewers = (yesNames, maybeNames, targetTotal = 7) => {
  const maybeAssignments = Object.fromEntries(maybeNames.map((n) => [n, []]));

  // Step 1 — assign other maybe names to each maybe person
  // Each maybe person gets up to (maybeNames.length - 1) other maybe reviewers
  const otherMaybePerPerson = Math.min(maybeNames.length - 1, targetTotal);

  if (otherMaybePerPerson > 0) {
    const MAX_ATTEMPTS = 100;
    let placed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const pool = shuffle(
        maybeNames.flatMap((name) => Array(otherMaybePerPerson).fill(name)),
      );
      const temp = Object.fromEntries(maybeNames.map((n) => [n, []]));
      let failed = false;
      for (const reviewer of pool) {
        const candidates = maybeNames.filter(
          (name) =>
            name !== reviewer &&
            temp[name].length < otherMaybePerPerson &&
            !temp[name].includes(reviewer),
        );
        if (candidates.length === 0) {
          failed = true;
          break;
        }
        candidates.sort((a, b) => temp[a].length - temp[b].length);
        temp[candidates[0]].push(reviewer);
      }
      if (!failed) {
        Object.assign(maybeAssignments, temp);
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }

  // Step 2 — fill remaining slots with yes names, evenly distributed
  for (const maybePerson of maybeNames) {
    const remaining = targetTotal - maybeAssignments[maybePerson].length;
    if (remaining <= 0) continue;

    // Pick `remaining` yes names not already assigned, distributed evenly
    // Track how many times each yes name has been assigned to a maybe person
    const yesUsageCounts = Object.fromEntries(yesNames.map((n) => [n, 0]));
    for (const mp of maybeNames) {
      for (const r of maybeAssignments[mp]) {
        if (yesNames.includes(r)) yesUsageCounts[r]++;
      }
    }

    const available = shuffle(
      yesNames.filter((y) => !maybeAssignments[maybePerson].includes(y)),
    );
    // Sort by usage count so least-used yes names get picked first
    available.sort((a, b) => yesUsageCounts[a] - yesUsageCounts[b]);

    maybeAssignments[maybePerson].push(...available.slice(0, remaining));
  }

  return maybeAssignments;
};

const buildAssignments = (yesNames, maybeNames) => {
  const MAX_ATTEMPTS = 100;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const yesAssignments = assignYesReviewers(yesNames);
    if (!yesAssignments) continue;

    const withMaybe =
      maybeNames.length === 0
        ? yesAssignments
        : assignMaybeReviewers(yesNames, maybeNames, yesAssignments);
    if (!withMaybe) continue;

    const maybePersonAssignments =
      maybeNames.length === 0
        ? {}
        : assignMaybePersonReviewers(yesNames, maybeNames, 7);
    if (maybeNames.length > 0 && !maybePersonAssignments) continue;

    return { ...withMaybe, ...maybePersonAssignments };
  }
  return null;
};

const Section = ({
  title,
  names,
  color,
  assignments,
  maybeNames,
  yesNames,
}) => (
  <div style={{ marginBottom: 24 }}>
    <h2 style={{ color, borderBottom: `2px solid ${color}`, paddingBottom: 6 }}>
      {title} ({names.length})
    </h2>
    <ul style={{ listStyle: "none", padding: 0 }}>
      {names.map((name) => (
        <li key={name} style={{ padding: "6px 0", fontSize: 16 }}>
          <strong>{name}</strong>
          {assignments?.[name] && (
            <span style={{ color: "#555", marginLeft: 12, fontSize: 14 }}>
              reviews:{" "}
              {assignments[name].map((r, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span
                    style={{
                      color: maybeNames?.includes(r)
                        ? "#d97706"
                        : yesNames?.includes(r)
                          ? "#16a34a"
                          : "inherit",
                    }}
                  >
                    {r}
                  </span>
                </span>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  </div>
);

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
      setAssignments(buildAssignments(parsed.yes, parsed.maybe));
    };
    reader.readAsText(file);
    e.target.value = ""; // reset so the same file can be reloaded too
  };

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
          <Section
            title="Yes"
            names={groups.yes}
            color="#16a34a"
            assignments={assignments}
            maybeNames={groups.maybe}
            yesNames={groups.yes}
          />
          <Section
            title="Maybe"
            names={groups.maybe}
            color="#d97706"
            assignments={assignments}
            maybeNames={groups.maybe}
            yesNames={groups.yes}
          />
        </>
      )}
    </div>
  );
}
