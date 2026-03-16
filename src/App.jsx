import { useState, useRef } from "react";

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const assignMaybePersonReviewers = (yesNames, maybeNames, targetTotal = 7) => {
  if (maybeNames.length === 0) return {};
  const MAX_ATTEMPTS = 200;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const temp = Object.fromEntries(maybeNames.map((n) => [n, []]));

    for (const person of maybeNames) {
      for (const other of maybeNames) {
        if (other !== person) temp[person].push(other);
      }
    }

    const remaining = targetTotal - (maybeNames.length - 1);
    if (remaining <= 0) return temp;

    const usageCounts = Object.fromEntries(yesNames.map((n) => [n, 0]));
    let failed = false;

    for (let slot = 0; slot < remaining; slot++) {
      for (const person of shuffle([...maybeNames])) {
        const available = yesNames
          .filter((n) => !temp[person].includes(n))
          .sort((a, b) => usageCounts[a] - usageCounts[b]);
        if (available.length === 0) {
          failed = true;
          break;
        }
        temp[person].push(available[0]);
        usageCounts[available[0]]++;
      }
      if (failed) break;
    }

    if (!failed) return temp;
  }
  return null;
};

const computeSpread = (yesNames, combined) => {
  const ff3 = yesNames.reduce((acc, name) => {
    for (const r of (combined[name] ?? []).slice(0, 3)) {
      if (yesNames.includes(r)) acc[r] = (acc[r] ?? 0) + 1;
    }
    return acc;
  }, {});
  const ff3Vals = yesNames.map((n) => ff3[n] ?? 0);
  const ff3Spread = Math.max(...ff3Vals) - Math.min(...ff3Vals);

  const ff5 = yesNames.reduce((acc, name) => {
    for (const r of (combined[name] ?? []).slice(0, 5)) {
      if (yesNames.includes(r)) acc[r] = (acc[r] ?? 0) + 1;
    }
    return acc;
  }, {});
  const ff5Vals = yesNames.map((n) => ff5[n] ?? 0);
  const ff5Spread = Math.max(...ff5Vals) - Math.min(...ff5Vals);

  const all = yesNames.reduce((acc, name) => {
    for (const r of combined[name] ?? []) {
      if (yesNames.includes(r)) acc[r] = (acc[r] ?? 0) + 1;
    }
    return acc;
  }, {});
  const allVals = yesNames.map((n) => all[n] ?? 0);
  const allSpread = Math.max(...allVals) - Math.min(...allVals);

  return ff3Spread * 100 + ff5Spread * 10 + allSpread;
};

const runOneBuild = (yesNames, maybeNames) => {
  const allNames = [...yesNames, ...maybeNames];
  const assignments = Object.fromEntries(yesNames.map((n) => [n, []]));
  const n = yesNames.length;

  const usedPairs = new Set();
  for (let round = 0; round < 3; round++) {
    const shuffledOrder = shuffle([...yesNames]);
    const offsets = shuffle([...Array(n - 1).keys()].map((i) => i + 1));
    let placed = false;
    for (const offset of offsets) {
      let valid = true;
      const roundAssignments = [];
      for (let i = 0; i < n; i++) {
        const person = shuffledOrder[i];
        const reviewer = shuffledOrder[(i + offset) % n];
        const pairKey = `${reviewer}→${person}`;
        if (
          reviewer === person ||
          assignments[person].includes(reviewer) ||
          usedPairs.has(pairKey)
        ) {
          valid = false;
          break;
        }
        roundAssignments.push({ person, reviewer, pairKey });
      }
      if (valid) {
        for (const { person, reviewer, pairKey } of roundAssignments) {
          assignments[person].push(reviewer);
          usedPairs.add(pairKey);
        }
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }

  const maybePasses = Math.min(maybeNames.length, 2);
  for (let slot = 0; slot < maybePasses; slot++) {
    const usageCounts = Object.fromEntries(maybeNames.map((n) => [n, 0]));
    for (const name of yesNames) {
      for (const r of assignments[name]) {
        if (maybeNames.includes(r)) usageCounts[r]++;
      }
    }
    for (const person of shuffle([...yesNames])) {
      const available = maybeNames
        .filter((n) => !assignments[person].includes(n))
        .sort((a, b) => usageCounts[a] - usageCounts[b]);
      if (available.length === 0) return null;
      assignments[person].push(available[0]);
      usageCounts[available[0]]++;
    }
  }

  const remainingSlots = 7 - (3 + maybePasses);
  for (let slot = 0; slot < remainingSlots; slot++) {
    const usageCounts = Object.fromEntries(allNames.map((n) => [n, 0]));
    for (const name of yesNames) {
      for (const r of assignments[name]) usageCounts[r]++;
    }
    for (const person of shuffle([...yesNames])) {
      const available = allNames
        .filter((n) => n !== person && !assignments[person].includes(n))
        .sort((a, b) => usageCounts[a] - usageCounts[b]);
      if (available.length === 0) return null;
      assignments[person].push(available[0]);
      usageCounts[available[0]]++;
    }
  }

  const maybeAssignments = assignMaybePersonReviewers(yesNames, maybeNames, 7);
  if (maybeNames.length > 0 && !maybeAssignments) return null;

  return { ...assignments, ...maybeAssignments };
};

const buildAssignments = (yesNames, maybeNames) => {
  for (let attempt = 0; attempt < 500; attempt++) {
    const combined = runOneBuild(yesNames, maybeNames);
    if (!combined) continue;
    if (computeSpread(yesNames, combined) === 0) return combined;
  }
  let best = null;
  let bestSpread = Infinity;
  for (let attempt = 0; attempt < 200; attempt++) {
    const combined = runOneBuild(yesNames, maybeNames);
    if (!combined) continue;
    const spread = computeSpread(yesNames, combined);
    if (spread < bestSpread) {
      bestSpread = spread;
      best = combined;
    }
    if (bestSpread === 0) break;
  }
  return best;
};

const computeYesAppearanceCounts = (yesNames, assignments) => {
  const counts = Object.fromEntries(yesNames.map((n) => [n, 0]));
  for (const name of yesNames) {
    for (const r of assignments?.[name] ?? []) {
      if (yesNames.includes(r)) counts[r]++;
    }
  }
  return counts;
};

const computeYesFirstFiveCounts = (yesNames, assignments) => {
  const counts = Object.fromEntries(yesNames.map((n) => [n, 0]));
  for (const name of yesNames) {
    for (const r of (assignments?.[name] ?? []).slice(0, 5)) {
      if (yesNames.includes(r)) counts[r]++;
    }
  }
  return counts;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${DAYS[date.getDay()]} (${month}/${day}/${year})`;
};

const parseRsvpText = (text) => {
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

const parseEmailsText = (text) => {
  const map = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const name = trimmed.slice(0, colonIdx).trim();
    const email = trimmed.slice(colonIdx + 1).trim();
    if (name && email) map[name] = email;
  }
  return map;
};

const applyTemplate = (template, reviewer, peers, formattedDate, link) => {
  let result = template.replace(/REVIEWER/g, reviewer);
  peers.forEach((peer, i) => {
    result = result.replace(
      new RegExp(`PEER${i + 1}`, "g"),
      peer.toUpperCase(),
    );
  });
  if (formattedDate) result = result.replace(/DATE/g, formattedDate);
  if (link) result = result.replace(/LINK/g, link);
  return result;
};

const getEmailSubject = (formattedDate) =>
  formattedDate
    ? `Peer Reviews Due ${formattedDate}`
    : "Peer Review Assignment";

const downloadArchive = (
  groups,
  assignments,
  emailTemplate,
  formattedDate,
  link,
) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [];
  lines.push("Peer Review Groups Archive");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  if (formattedDate) lines.push(`Due Date: ${formattedDate}`);
  if (link) lines.push(`Link: ${link}`);
  lines.push("");
  lines.push("=".repeat(50));

  for (const { title, names } of [
    { title: "YES", names: groups.yes },
    { title: "MAYBE", names: groups.maybe },
  ]) {
    if (!names.length) continue;
    lines.push("");
    lines.push(`--- ${title} ---`);
    for (const name of names) {
      const peers = assignments?.[name] ?? [];
      lines.push(`${name}: ${peers.join(", ")}`);
    }
  }

  if (emailTemplate?.trim()) {
    lines.push("");
    lines.push("=".repeat(50));
    lines.push("COMPOSED EMAILS");
    lines.push("=".repeat(50));
    const allNames = [...(groups.yes ?? []), ...(groups.maybe ?? [])];
    for (const name of allNames) {
      const peers = assignments?.[name] ?? [];
      const composed = applyTemplate(
        emailTemplate,
        name,
        peers,
        formattedDate,
        link,
      );
      lines.push("");
      lines.push("");
      lines.push(`--- ${name} ---`);
      lines.push("");
      lines.push(composed);
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `peer-review-${timestamp}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const openMailto = (email, subject, body) => {
  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url);
};

const EXAMPLE_TEMPLATE = `Hi REVIEWER,

Please review the projects of PEER1, PEER2, PEER3, PEER4, and PEER5 by DATE.

If one of these students has not posted their code or videos by midnight on the day before this review is due, please review PEER6's project.

If a second student in the initial group has not posted their code or videos, please review PEER7's project.

If work is not posted for these alternative students, please review other student projects of your choosing until you reach a minimum of five peer reviews.

You're welcome to do more reviews, but only five are required. See this Moodle page for the link to the review form and for more details.

LINK

Warm regards,
Tina`;

const ExampleTemplateModal = ({ onClose }) => (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h2 className="font-bold text-base text-gray-800">
          Example Email Template
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none cursor-pointer bg-transparent border-none"
        >
          ×
        </button>
      </div>
      <div className="overflow-y-auto p-5 flex-1">
        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
          {EXAMPLE_TEMPLATE}
        </pre>
      </div>
      <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

const PasteOrFile = ({
  label,
  value,
  onChange,
  onFile,
  placeholder,
  hint,
  onShowExample,
}) => {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => onFile(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-semibold text-sm text-gray-700">{label}</label>
        {onShowExample && (
          <button
            onClick={onShowExample}
            className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer bg-transparent border-none font-medium transition-colors"
          >
            see example
          </button>
        )}
      </div>
      <textarea
        className="w-full min-h-28 p-2.5 text-xs font-mono border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setFileName(null);
        }}
        placeholder={placeholder}
        spellCheck={false}
      />
      <span className="text-xs text-gray-500">or upload file:</span>
      <div className="mt-1.5 flex items-center gap-2.5">
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
        >
          Choose File
        </button>
        <span className="text-xs text-gray-500 truncate max-w-36">
          {fileName ?? "No file chosen"}
        </span>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
};

const Section = ({
  title,
  names,
  color,
  assignments,
  maybeNames,
  yesNames,
  highlighted,
  onHighlight,
}) => (
  <div className="mb-6">
    <h2
      className="text-lg font-bold pb-1.5 mb-3 border-b-2"
      style={{ color, borderColor: color }}
    >
      {title} ({names.length})
    </h2>
    <ul className="list-none p-0">
      {names.map((name) => {
        const peers = assignments?.[name] ?? [];
        return (
          <li key={name} className="py-1.5 text-base">
            <button
              onClick={() => onHighlight(highlighted === name ? null : name)}
              className={`font-bold cursor-pointer border-none bg-transparent p-0 transition-colors ${
                highlighted === name
                  ? "text-blue-600 underline"
                  : "text-gray-900 hover:text-blue-500"
              }`}
            >
              {name}
            </button>
            {peers.length > 0 && (
              <span className="text-gray-500 ml-3 text-sm">
                reviews:{" "}
                {peers.map((r, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <span
                      style={{
                        color:
                          highlighted === r
                            ? "#2563eb"
                            : maybeNames?.includes(r)
                              ? "#d97706"
                              : yesNames?.includes(r)
                                ? "#16a34a"
                                : "inherit",
                        fontWeight: highlighted === r ? "700" : "400",
                        backgroundColor:
                          highlighted === r ? "#dbeafe" : "transparent",
                        borderRadius: highlighted === r ? "3px" : "0",
                        padding: highlighted === r ? "0 2px" : "0",
                      }}
                    >
                      {r}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

const StatRow = ({ label, countMap, sorted, groups, avg, min, max }) => (
  <div className="mb-5">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      <span className="text-xs text-gray-400">
        min {min} · avg {avg} · max {max}
      </span>
    </div>
    <div className="flex flex-wrap gap-2">
      {sorted.map((name) => {
        const count = countMap[name] ?? 0;
        const isYes = groups.yes?.includes(name);
        const isMaybe = groups.maybe?.includes(name);
        const deviation = count - parseFloat(avg);
        const bg =
          deviation > 1 ? "#fee2e2" : deviation < -1 ? "#dbeafe" : "#f0fdf4";
        const border =
          deviation > 1 ? "#fca5a5" : deviation < -1 ? "#93c5fd" : "#86efac";
        return (
          <div
            key={name}
            style={{ background: bg, borderColor: border }}
            className="border rounded-lg px-3 py-1.5 text-sm flex items-center gap-2"
          >
            <span
              style={{
                color: isMaybe ? "#d97706" : isYes ? "#16a34a" : "#374151",
              }}
              className="font-semibold"
            >
              {name}
            </span>
            <span className="font-bold text-gray-700">{count}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const StatsPanel = ({ groups, assignments }) => {
  if (!groups || !assignments) return null;
  const yesNames = groups.yes ?? [];
  if (yesNames.length === 0) return null;

  const allCounts = computeYesAppearanceCounts(yesNames, assignments);
  const ff5Counts = computeYesFirstFiveCounts(yesNames, assignments);
  const sorted = [...yesNames].sort(
    (a, b) => (allCounts[b] ?? 0) - (allCounts[a] ?? 0),
  );

  const stats = (countMap) => {
    const vals = sorted.map((n) => countMap[n] ?? 0);
    if (!vals.length) return { min: 0, max: 0, avg: "0" };
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
    };
  };

  const allStats = stats(allCounts);
  const ff5Stats = stats(ff5Counts);

  return (
    <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
        <h2 className="font-bold text-sm text-gray-700">
          Distribution Stats — yes names only, on yes people's lists
        </h2>
      </div>
      <div className="p-4">
        <StatRow
          label="All 7 slots"
          countMap={allCounts}
          sorted={sorted}
          groups={groups}
          avg={allStats.avg}
          min={allStats.min}
          max={allStats.max}
        />
        <StatRow
          label="First 5 slots only"
          countMap={ff5Counts}
          sorted={sorted}
          groups={groups}
          avg={ff5Stats.avg}
          min={ff5Stats.min}
          max={ff5Stats.max}
        />
        <p className="text-xs text-gray-400 mt-1">
          Green = near average · Red = above average · Blue = below average
        </p>
      </div>
    </div>
  );
};

const EmailPreview = ({
  name,
  template,
  assignments,
  formattedDate,
  link,
  emailMap,
}) => {
  const [expanded, setExpanded] = useState(false);
  const peers = assignments?.[name] ?? [];
  const filled = applyTemplate(template, name, peers, formattedDate, link);
  const email = emailMap?.[name];
  const subject = getEmailSubject(formattedDate);

  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left font-semibold text-sm cursor-pointer bg-transparent border-none hover:text-blue-600 transition-colors"
        >
          {expanded ? "▾" : "▸"} {name}
          {email && (
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {email}
            </span>
          )}
        </button>
        {email ? (
          <button
            onClick={() => openMailto(email, subject, filled)}
            className="ml-4 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            ✉ Open in Mail
          </button>
        ) : (
          <span className="ml-4 text-xs text-gray-300 italic">
            no email on file
          </span>
        )}
      </div>
      {expanded && (
        <pre className="m-0 p-4 whitespace-pre-wrap wrap-break-word text-xs bg-white border-t border-gray-100 text-left">
          {filled}
        </pre>
      )}
    </div>
  );
};

export default function App() {
  const [rsvpText, setRsvpText] = useState("");
  const [emailText, setEmailText] = useState("");
  const [linkText, setLinkText] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [groups, setGroups] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [highlighted, setHighlighted] = useState(null);

  const handleGenerate = () => {
    const parsed = parseRsvpText(rsvpText);
    const result = buildAssignments(parsed.yes, parsed.maybe);
    setGroups(parsed);
    setAssignments(result);
    downloadArchive(
      parsed,
      result,
      emailText.trim() || null,
      formatDate(selectedDate),
      linkText.trim(),
    );
  };

  const allNames = groups
    ? [...(groups.yes ?? []), ...(groups.maybe ?? [])]
    : [];
  const formattedDate = formatDate(selectedDate);
  const link = linkText.trim();
  const emailMap = parseEmailsText(emailsText);

  const canGenerate =
    rsvpText.trim().length > 0 &&
    emailText.trim().length > 0 &&
    selectedDate.length > 0 &&
    link.length > 0 &&
    emailsText.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-sans">
      {showExampleModal && (
        <ExampleTemplateModal onClose={() => setShowExampleModal(false)} />
      )}

      <h1 className="text-3xl font-bold mb-2">
        Create Review Groups & Generate Email Instructions
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Paste data into each field or upload a file. Use tokens{" "}
        <code className="bg-gray-100 px-1 rounded">REVIEWER</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">PEER1</code>–
        <code className="bg-gray-100 px-1 rounded">PEER7</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">DATE</code>, and{" "}
        <code className="bg-gray-100 px-1 rounded">LINK</code> in your email
        template. 'Yes' reviewers will complete a project, while 'maybe'
        reviewers may or may not complete a project. Don't include any students
        who cannot pass at this point, whether or not they complete a project.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <PasteOrFile
          label="Reviewers"
          value={rsvpText}
          onChange={setRsvpText}
          onFile={setRsvpText}
          placeholder={"yes\nAlice\nBob\nmaybe\nCarol\nend"}
          hint="yes/maybe/end, one name per line"
        />
        <PasteOrFile
          label="Reviewer Emails"
          value={emailsText}
          onChange={setEmailsText}
          onFile={setEmailsText}
          placeholder={"Alice:alice@school.edu\nBob:bob@school.edu"}
          hint="Format: Name:email, one per line"
        />
        <PasteOrFile
          label="Email Template"
          value={emailText}
          onChange={setEmailText}
          onFile={setEmailText}
          placeholder={
            "Hi REVIEWER,\n\nPlease review PEER1, PEER2...\nDue: DATE\nLink: LINK"
          }
          hint="Tokens: REVIEWER, PEER1–PEER7, DATE, LINK"
          onShowExample={() => setShowExampleModal(true)}
        />
        <PasteOrFile
          label="Instructions Link"
          value={linkText}
          onChange={setLinkText}
          onFile={(text) => setLinkText(text.trim())}
          placeholder="https://..."
          hint="Enter 'none' if no LINK token in email template"
        />
      </div>

      <div className="flex gap-6 items-end mb-10 flex-wrap">
        <div>
          <label className="block mb-1.5 font-semibold text-sm text-gray-700">
            Due Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {formattedDate && (
            <p className="mt-1 text-xs text-gray-500">→ {formattedDate}</p>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`px-7 py-2.5 text-sm font-bold text-white rounded-lg transition-colors ${
            canGenerate
              ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          Generate Review Emails
        </button>
      </div>

      {groups && (
        <div className="mb-6">
          <button
            onClick={() => setShowStats((v) => !v)}
            className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            {showStats ? "▾ Hide Stats" : "▸ Show Stats"}
          </button>
        </div>
      )}

      {groups && showStats && (
        <>
          <StatsPanel groups={groups} assignments={assignments} />
          <Section
            title="Yes"
            names={groups.yes}
            color="#16a34a"
            assignments={assignments}
            maybeNames={groups.maybe}
            yesNames={groups.yes}
            highlighted={highlighted}
            onHighlight={setHighlighted}
          />
          <Section
            title="Maybe"
            names={groups.maybe}
            color="#d97706"
            assignments={assignments}
            maybeNames={groups.maybe}
            yesNames={groups.yes}
            highlighted={highlighted}
            onHighlight={setHighlighted}
          />
        </>
      )}

      {groups && emailText.trim() && (
        <div className="mt-10">
          <div className="border-b-2 border-gray-800 pb-1.5 mb-4">
            <h2 className="text-xl font-bold">Email Previews</h2>
          </div>
          {allNames.map((name) => (
            <EmailPreview
              key={name}
              name={name}
              template={emailText}
              assignments={assignments}
              formattedDate={formattedDate}
              link={link}
              emailMap={emailMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
