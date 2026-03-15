import { useState, useRef } from "react";

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

const assignMaybePersonReviewers = (yesNames, maybeNames, targetTotal = 7) => {
  const maybeAssignments = Object.fromEntries(maybeNames.map((n) => [n, []]));
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
  for (const maybePerson of maybeNames) {
    const remaining = targetTotal - maybeAssignments[maybePerson].length;
    if (remaining <= 0) continue;
    const yesUsageCounts = Object.fromEntries(yesNames.map((n) => [n, 0]));
    for (const mp of maybeNames) {
      for (const r of maybeAssignments[mp]) {
        if (yesNames.includes(r)) yesUsageCounts[r]++;
      }
    }
    const available = shuffle(
      yesNames.filter((y) => !maybeAssignments[maybePerson].includes(y)),
    );
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

const applyTemplate = (template, reviewer, peers, formattedDate, link) => {
  let result = template.replace(/REVIEWER/gi, reviewer);
  peers.forEach((peer, i) => {
    result = result.replace(new RegExp(`PEER${i + 1}`, "gi"), peer);
  });
  if (formattedDate) result = result.replace(/DATE/gi, formattedDate);
  if (link) result = result.replace(/LINK/gi, link);
  return result;
};

const PasteOrFile = ({ label, value, onChange, onFile, placeholder, hint }) => {
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
      <label className="block mb-1.5 font-semibold text-sm text-gray-700">
        {label}
      </label>
      <textarea
        className="w-full min-h-28 p-2.5 text-xs font-mono border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setFileName(null); // clear file name if user edits manually
        }}
        placeholder={placeholder}
        spellCheck={false}
      />
      <div className="mt-1.5 flex items-center gap-2.5">
        <span className="text-xs text-gray-500">or upload file:</span>
        {/* Hidden real file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleFile}
        />
        {/* Styled button that triggers it */}
        <button
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
        >
          Choose File
        </button>
        {/* File name display */}
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
}) => (
  <div className="mb-6">
    <h2
      className="text-lg font-bold pb-1.5 mb-3 border-b-2"
      style={{ color, borderColor: color }}
    >
      {title} ({names.length})
    </h2>
    <ul className="list-none p-0">
      {names.map((name) => (
        <li key={name} className="py-1.5 text-base">
          <strong>{name}</strong>
          {assignments?.[name] && (
            <span className="text-gray-500 ml-3 text-sm">
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

const EmailPreview = ({ name, template, assignments, formattedDate, link }) => {
  const [expanded, setExpanded] = useState(false);
  const peers = assignments?.[name] ?? [];
  const filled = applyTemplate(template, name, peers, formattedDate, link);
  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-2.5 bg-gray-50 border-none cursor-pointer font-semibold text-sm hover:bg-gray-100 transition-colors"
      >
        {expanded ? "▾" : "▸"} {name}
      </button>
      {expanded && (
        <pre className="m-0 p-4 whitespace-pre-wrap break-words text-xs bg-white border-t border-gray-100 text-left">
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
  const [groups, setGroups] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");

  const handleGenerate = () => {
    const parsed = parseRsvpText(rsvpText);
    setGroups(parsed);
    setAssignments(buildAssignments(parsed.yes, parsed.maybe));
  };

  const allNames = groups
    ? [...(groups.yes ?? []), ...(groups.maybe ?? [])]
    : [];
  const formattedDate = formatDate(selectedDate);
  const link = linkText.trim();
  const canGenerate = rsvpText.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-sans">
      <h1 className="text-3xl font-bold mb-2">RSVP & Peer Review</h1>
      <p className="text-sm text-gray-500 mb-8">
        Paste data into each field or upload a file. Use tokens{" "}
        <code className="bg-gray-100 px-1 rounded">REVIEWER</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">PEER1</code>–
        <code className="bg-gray-100 px-1 rounded">PEER7</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">DATE</code>, and{" "}
        <code className="bg-gray-100 px-1 rounded">LINK</code> in your email
        template.
      </p>

      {/* Three paste/file inputs */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <PasteOrFile
          label="RSVP List"
          value={rsvpText}
          onChange={setRsvpText}
          onFile={setRsvpText}
          placeholder={"yes\nAlice\nBob\nmaybe\nCarol\nend"}
          hint="Format: yes / maybe sections, one name per line, end with 'end'"
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
        />
        <PasteOrFile
          label="Link"
          value={linkText}
          onChange={setLinkText}
          onFile={(text) => setLinkText(text.trim())}
          placeholder="https://..."
          hint="Paste a URL or upload link.txt"
        />
      </div>

      {/* Date + Generate */}
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
          Generate Assignments
        </button>
      </div>

      {/* RSVP sections */}
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

      {/* Email previews */}
      {groups && emailText.trim() && (
        <div className="mt-10">
          <h2 className="text-xl font-bold border-b-2 border-gray-800 pb-1.5 mb-4">
            Email Previews
          </h2>
          {allNames.map((name) => (
            <EmailPreview
              key={name}
              name={name}
              template={emailText}
              assignments={assignments}
              formattedDate={formattedDate}
              link={link}
            />
          ))}
        </div>
      )}
    </div>
  );
}
