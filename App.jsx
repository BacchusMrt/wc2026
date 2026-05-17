import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase.js";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const PARTICIPANTS = [
  'בן צור "האנגלי"',
  'תומר "הינשוף"',
  'עידו "הפיקסר ממו"',
  'יוסי "אל בגדדי"',
  'קובי "הקרפיון הרומני"',
  'אורי "אבו אל בנאת"',
  'צביקה "הנמר הסיבירי"',
  'שחר "חבר מכוכב אחר"',
  "גיל \"it's tempting\"",
];

const BONUS_RULES = { winner: 10, topScorer: 12, topAssist: 15 };
const GROUP_STAGE_MATCHES = [
  { id: 1, home: "🇺🇸 USA",       away: "🇷🇸 Serbia",      group: "A", date: "2026-06-12" },
  { id: 2, home: "🇲🇽 Mexico",    away: "🇨🇦 Canada",      group: "A", date: "2026-06-13" },
  { id: 3, home: "🇲🇦 Morocco",   away: "🇩🇪 Germany",     group: "B", date: "2026-06-14" },
  { id: 4, home: "🇯🇵 Japan",     away: "🇧🇷 Brazil",      group: "C", date: "2026-06-15" },
  { id: 5, home: "🇫🇷 France",    away: "🇦🇷 Argentina",   group: "D", date: "2026-06-16" },
  { id: 6, home: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England",  away: "🇳🇱 Netherlands", group: "E", date: "2026-06-17" },
  { id: 7, home: "🇵🇹 Portugal",  away: "🇪🇸 Spain",       group: "F", date: "2026-06-18" },
  { id: 8, home: "🇮🇹 Italy",     away: "🇦🇺 Australia",   group: "G", date: "2026-06-19" },
];

const DOC_REF = () => doc(db, "wc2026", "shared");

function initState() {
  const guesses = {}, results = {}, locked = {}, pretournament = {}, odds = {};
  PARTICIPANTS.forEach(p => { guesses[p] = {}; pretournament[p] = { winner: "", topScorer: "", topAssist: "" }; });
  GROUP_STAGE_MATCHES.forEach(m => { results[m.id] = { home: "", away: "", set: false }; locked[m.id] = false; odds[m.id] = { home: "", draw: "", away: "", exact: "" }; });
  return { guesses, results, locked, pretournament, odds, bonusActuals: { winner: "", topScorer: "", topAssist: "", set: false }, ptLocked: false };
}
function mergeState(saved) {
  const s = initState();
  if (!saved) return s;
  return { guesses: { ...s.guesses, ...saved.guesses }, results: { ...s.results, ...saved.results }, locked: { ...s.locked, ...saved.locked }, pretournament: { ...s.pretournament, ...saved.pretournament }, odds: { ...s.odds, ...saved.odds }, bonusActuals: saved.bonusActuals || s.bonusActuals, ptLocked: saved.ptLocked || false };
}

function calcMatchPoints(guess, result, odds) {
  if (!result?.set || !guess || guess.home === "" || guess.away === "") return { pts: null, type: null };
  const gh = parseInt(guess.home), ga = parseInt(guess.away), rh = parseInt(result.home), ra = parseInt(result.away);
  if (isNaN(gh) || isNaN(ga)) return { pts: null, type: null };
  const gOut = gh > ga ? "H" : gh < ga ? "A" : "D", rOut = rh > ra ? "H" : rh < ra ? "A" : "D";
  if (gh === rh && ga === ra) { const o = parseFloat(odds?.exact); return { pts: isNaN(o) ? 0 : Math.round(o * 10) / 10, type: "exact" }; }
  if (gOut === rOut) { const key = rOut === "H" ? "home" : rOut === "A" ? "away" : "draw"; const o = parseFloat(odds?.[key]); return { pts: isNaN(o) ? 0 : Math.round(o * 10) / 10, type: "result" }; }
  return { pts: 0, type: "miss" };
}
function calcBonusPoints(pt, actuals) {
  if (!actuals?.set) return { winner: null, topScorer: null, topAssist: null, total: 0 };
  const norm = s => (s || "").trim().toLowerCase();
  const winner = actuals.winner ? (norm(pt?.winner) === norm(actuals.winner) ? BONUS_RULES.winner : 0) : null;
  const topScorer = actuals.topScorer ? (norm(pt?.topScorer) === norm(actuals.topScorer) ? BONUS_RULES.topScorer : 0) : null;
  const topAssist = actuals.topAssist ? (norm(pt?.topAssist) === norm(actuals.topAssist) ? BONUS_RULES.topAssist : 0) : null;
  return { winner, topScorer, topAssist, total: (winner ?? 0) + (topScorer ?? 0) + (topAssist ?? 0) };
}
function buildLeaderboard(guesses, results, odds, pretournament, bonusActuals) {
  return PARTICIPANTS.map(p => {
    let matchTotal = 0, exact = 0, correct = 0;
    GROUP_STAGE_MATCHES.forEach(m => { const { pts, type } = calcMatchPoints(guesses[p]?.[m.id], results[m.id], odds[m.id]); if (pts === null) return; matchTotal += pts; if (type === "exact") exact++; else if (type === "result") correct++; });
    matchTotal = Math.round(matchTotal * 10) / 10;
    const bonus = calcBonusPoints(pretournament?.[p], bonusActuals);
    return { name: p, matchTotal, bonusTotal: bonus.total, total: Math.round((matchTotal + bonus.total) * 10) / 10, exact, correct };
  }).sort((a, b) => b.total - a.total);
}

const scoreInputStyle = { width: 44, textAlign: "center", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--fg)", fontSize: 15, fontFamily: "inherit", padding: "5px 2px", outline: "none" };
const pill = (c) => { const map = { blue: ["#3498db33","#3498db"], purple: ["#9b59b633","#9b59b6"], green: ["#27ae6033","#27ae60"], gold: ["#f39c1233","#f39c12"] }; return { fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "2px 8px", background: map[c][0], color: map[c][1], border: `1px solid ${map[c][0]}` }; };

function ScoreInput({ value, onChange, disabled }) {
  return (<div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="number" min="0" max="20" value={value?.home ?? ""} placeholder="0" onChange={e => onChange({ ...value, home: e.target.value })} disabled={disabled} style={scoreInputStyle} /><span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 18 }}>–</span><input type="number" min="0" max="20" value={value?.away ?? ""} placeholder="0" onChange={e => onChange({ ...value, away: e.target.value })} disabled={disabled} style={scoreInputStyle} /></div>);
}
function TextInput({ value, onChange, placeholder, disabled }) {
  return (<input type="text" value={value || ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...scoreInputStyle, width: 155, textAlign: "left", padding: "5px 10px" }} />);
}
function OddsDisplay({ o }) {
  if (!o || (!o.home && !o.draw && !o.away && !o.exact)) return (<span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>No odds set yet</span>);
  return (<div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{o.home && <span style={pill("blue")}>🏠 {o.home}</span>}{o.draw && <span style={pill("purple")}>🤝 {o.draw}</span>}{o.away && <span style={pill("green")}>✈️ {o.away}</span>}{o.exact && <span style={pill("gold")}>⭐ {o.exact}</span>}</div>);
}

export default function App() {
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("guesses");
  const [activeP, setActiveP] = useState(PARTICIPANTS[0]);
  const [trophyClicks, setTrophyClicks] = useState(0);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [toast, setToast] = useState(null);
  const [adminResults, setAdminResults] = useState({});
  const [adminOdds, setAdminOdds] = useState({});
  const [adminBonus, setAdminBonus] = useState({ winner: "", topScorer: "", topAssist: "", set: false });
  const saveTimeout = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(DOC_REF(), snap => {
      const data = mergeState(snap.exists() ? snap.data() : null);
      setAppData(data); setAdminResults(data.results); setAdminOdds(data.odds); setAdminBonus(data.bonusActuals); setLoading(false);
    }, () => { setAppData(initState()); setLoading(false); });
    return () => unsub();
  }, []);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const updateData = useCallback(async (nd) => {
    setAppData(nd);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => { try { await setDoc(DOC_REF(), nd); } catch (e) { console.error(e); } }, 300);
  }, []);

  const handleGuessChange = (p, matchId, val) => { if (!appData || appData.locked[matchId]) return; updateData({ ...appData, guesses: { ...appData.guesses, [p]: { ...appData.guesses[p], [matchId]: val } } }); };
  const handlePTChange = (p, field, val) => { if (!appData || appData.ptLocked) return; updateData({ ...appData, pretournament: { ...appData.pretournament, [p]: { ...appData.pretournament[p], [field]: val } } }); };
  const handleTrophyClick = () => { const n = trophyClicks + 1; setTrophyClicks(n); if (n >= 3) { setAdminUnlocked(true); setView("admin"); setTrophyClicks(0); showToast("Admin unlocked 🔓"); } };
  const handleLockToggle = (matchId) => { const nd = { ...appData, locked: { ...appData.locked, [matchId]: !appData.locked[matchId] } }; updateData(nd); showToast(nd.locked[matchId] ? "Match locked 🔒" : "Unlocked 🔓"); };
  const handleSaveMatch = (matchId) => { const r = adminResults[matchId]; if (!r || r.home === "" || r.away === "") { showToast("Enter both scores", "error"); return; } updateData({ ...appData, results: { ...appData.results, [matchId]: { ...r, set: true } }, odds: { ...appData.odds, [matchId]: adminOdds[matchId] } }); showToast("Result saved ✓"); };
  const handleSaveOdds = (matchId) => { updateData({ ...appData, odds: { ...appData.odds, [matchId]: adminOdds[matchId] } }); showToast("Odds saved ✓"); };
  const handleSetBonus = () => { if (!adminBonus.winner && !adminBonus.topScorer && !adminBonus.topAssist) { showToast("Fill at least one field", "error"); return; } updateData({ ...appData, bonusActuals: { ...adminBonus, set: true } }); showToast("Saved ✓"); };
  const handleTogglePTLock = () => { const nd = { ...appData, ptLocked: !appData.ptLocked }; updateData(nd); showToast(nd.ptLocked ? "Pre-tournament locked 🔒" : "Unlocked 🔓"); };

  if (loading) return (<div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", alignItems: "center", justifyContent: "center" }}><style>{css}</style><span style={{ fontSize: 40, animation: "spin 1s linear infinite" }}>⚽</span></div>);

  const board = buildLeaderboard(appData.guesses, appData.results, appData.odds, appData.pretournament, appData.bonusActuals);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Barlow Condensed','Barlow',sans-serif", color: "var(--fg)" }}>
      <style>{css}</style>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", color: "#fff", fontWeight: 700, padding: "10px 22px", borderRadius: 20, fontSize: 14, zIndex: 999, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", animation: "fadeIn 0.2s ease", background: toast.type === "error" ? "#c0392b" : "var(--accent)" }}>{toast.msg}</div>}
      <header style={{ background: "var(--header)", borderBottom: "2px solid var(--accent)", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 30, cursor: "pointer", userSelect: "none" }} onClick={handleTrophyClick}>🏆</span>
          <div><div style={{ fontSize: 10, letterSpacing: 4, color: "var(--accent)", textTransform: "uppercase", fontWeight: 700 }}>FIFA World Cup 2026</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--fg)" }}>Score Predictor</div></div>
        </div>
        <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "pretournament", label: "🌟 Pre-Tournament" }, { id: "guesses", label: "🎯 Guesses" }, { id: "leaderboard", label: "📊 Standings" }].map(v => (<button key={v.id} onClick={() => setView(v.id)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, background: view === v.id ? "var(--accent)" : "var(--card)", color: view === v.id ? "#fff" : "var(--muted)", transition: "all 0.15s" }}>{v.label}</button>))}
          {adminUnlocked && <button onClick={() => setView("admin")} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, background: view === "admin" ? "var(--accent)" : "var(--card)", color: view === "admin" ? "#fff" : "var(--muted)" }}>🔧 Admin</button>}
        </nav>
      </header>
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 80px" }}>

        {view === "pretournament" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "var(--fg)", marginBottom: 14, textTransform: "uppercase" }}>Pre-Tournament Predictions</div>
            <div style={{ background: "var(--card)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", border: "1px solid var(--border)", alignItems: "center" }}>
              {[["🏆", BONUS_RULES.winner, "Winner"], ["⚽", BONUS_RULES.topScorer, "Top Scorer"], ["🎯", BONUS_RULES.topAssist, "Top Assist"]].map(([ic, pts, lbl]) => (<div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>{ic} {pts} pts</span>{lbl}</div>))}
            </div>
            {appData.ptLocked && <div style={{ background: "#c0392b22", border: "1px solid #c0392b55", borderRadius: 8, padding: "8px 14px", color: "#e74c3c", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🔒 Pre-tournament guesses are locked</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
              {PARTICIPANTS.map(p => {
                const pt = appData.pretournament?.[p] || {};
                const bonus = calcBonusPoints(pt, appData.bonusActuals);
                return (
                  <div key={p} style={{ background: "var(--card)", borderRadius: 14, padding: "15px 17px", border: "1.5px solid var(--border)", opacity: appData.ptLocked ? 0.82 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, direction: "rtl" }}>{p}</div>
                      {appData.bonusActuals?.set && <div style={{ fontWeight: 800, color: "var(--accent)", fontSize: 17 }}>+{bonus.total} pts</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[{ field: "winner", label: "🏆 Winner", bpts: bonus.winner, max: BONUS_RULES.winner }, { field: "topScorer", label: "⚽ Top Scorer", bpts: bonus.topScorer, max: BONUS_RULES.topScorer }, { field: "topAssist", label: "🎯 Top Assist", bpts: bonus.topAssist, max: BONUS_RULES.topAssist }].map(({ field, label, bpts }) => (
                        <div key={field} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 90 }}>{label}</span>
                          <TextInput value={pt[field]} onChange={v => handlePTChange(p, field, v)} placeholder="Type name..." disabled={appData.ptLocked} />
                          {bpts !== null && <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 6, padding: "3px 9px", background: bpts > 0 ? "var(--accent)" : "var(--card2)", color: bpts > 0 ? "#fff" : "var(--muted)" }}>{bpts > 0 ? `✓ ${bpts}` : "✗ 0"} pts</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "guesses" && (
          <div>
            <div style={{ background: "var(--card)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", border: "1px solid var(--border)", alignItems: "center", fontSize: 12 }}>
              <span style={pill("gold")}>⭐ Exact score odds</span>
              <span style={{ color: "var(--muted)" }}>·</span>
              <span style={pill("blue")}>🏠 Home</span> <span style={pill("purple")}>🤝 Draw</span> <span style={pill("green")}>✈️ Away</span>
              <span style={{ color: "var(--muted)" }}>for correct result</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {PARTICIPANTS.map(p => (<button key={p} onClick={() => setActiveP(p)} style={{ padding: "7px 15px", borderRadius: 20, border: "2px solid " + (activeP === p ? "var(--accent)" : "var(--border)"), cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, background: activeP === p ? "var(--accent)" : "transparent", color: activeP === p ? "#fff" : "var(--fg)", direction: "rtl", unicodeBidi: "plaintext" }}>{p}</button>))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GROUP_STAGE_MATCHES.map(m => {
                const guess = appData.guesses?.[activeP]?.[m.id] || { home: "", away: "" };
                const result = appData.results?.[m.id], locked = appData.locked?.[m.id], o = appData.odds?.[m.id];
                const { pts, type } = calcMatchPoints(guess, result, o);
                return (
                  <div key={m.id} style={{ background: "var(--card)", borderRadius: 14, padding: "15px 17px", border: "1.5px solid var(--border)", opacity: locked ? 0.82 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div><span style={{ background: "var(--accent)", color: "#fff", borderRadius: 4, fontSize: 10, fontWeight: 800, padding: "2px 7px", textTransform: "uppercase" }}>Group {m.group}</span><span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>{m.date}</span></div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {locked && <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--card2)", borderRadius: 4, padding: "2px 7px" }}>🔒</span>}
                        {pts !== null && <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 6, padding: "3px 9px", background: pts > 0 ? "var(--accent)" : "var(--card2)", color: pts > 0 ? "#fff" : "var(--muted)" }}>{type === "exact" ? "⭐" : type === "result" ? "✓" : "✗"} {pts} pts</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{m.home}</div>
                      <ScoreInput value={guess} onChange={v => handleGuessChange(activeP, m.id, v)} disabled={locked} />
                      <div style={{ fontSize: 14, fontWeight: 700, flex: 1, textAlign: "right" }}>{m.away}</div>
                    </div>
                    <OddsDisplay o={o} />
                    {result?.set && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>Real score: <strong style={{ color: "var(--accent)" }}>{result.home} – {result.away}</strong></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "leaderboard" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "var(--fg)", marginBottom: 14, textTransform: "uppercase" }}>Standings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {board.map((p, i) => (
                <div key={p.name} style={{ background: i === 0 ? "linear-gradient(135deg, var(--card), var(--card2))" : "var(--card)", borderRadius: 12, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1.5px solid " + (i === 0 ? "var(--accent)" : "var(--border)") }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 800, color: i < 3 ? "var(--accent)" : "var(--muted)", minWidth: 28, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</div>
                    <div><div style={{ fontWeight: 700, fontSize: 14, direction: "rtl" }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Matches: {p.matchTotal}{appData.bonusActuals?.set ? ` · Bonus: ${p.bonusTotal}` : ""}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>⭐</div><div style={{ fontWeight: 700, color: "#f39c12" }}>{p.exact}</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>✓</div><div style={{ fontWeight: 700, color: "#27ae60" }}>{p.correct}</div></div>
                    <div style={{ textAlign: "center", minWidth: 44 }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Total</div><div style={{ fontWeight: 800, fontSize: 22, color: "var(--fg)" }}>{p.total}</div></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "var(--fg)", marginBottom: 14, textTransform: "uppercase" }}>Match Breakdown</div>
            {GROUP_STAGE_MATCHES.map(m => {
              const result = appData.results?.[m.id], o = appData.odds?.[m.id];
              return (
                <div key={m.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{m.home} <span style={{ color: "var(--muted)" }}>vs</span> {m.away}{result?.set && <span style={{ marginLeft: 10, color: "var(--accent)", fontWeight: 800 }}>{result.home}–{result.away}</span>}</div>
                  {o && <div style={{ marginBottom: 8 }}><OddsDisplay o={o} /></div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {PARTICIPANTS.map(p => {
                      const g = appData.guesses?.[p]?.[m.id], { pts, type } = calcMatchPoints(g, result, o), has = g && g.home !== "" && g.away !== "";
                      return (<div key={p} style={{ background: type === "exact" ? "#f39c1233" : type === "result" ? "#27ae6033" : type === "miss" ? "#c0392b22" : "var(--card2)", borderRadius: 8, padding: "6px 10px", minWidth: 68, textAlign: "center", border: "1px solid var(--border)" }}><div style={{ fontSize: 10, color: "var(--muted)", direction: "rtl", marginBottom: 2 }}>{p.split('"')[0].trim()}</div><div style={{ fontWeight: 700 }}>{has ? `${g.home}–${g.away}` : "—"}</div>{pts !== null && <div style={{ fontSize: 10, marginTop: 2 }}>{pts > 0 ? `+${pts}` : "✗"}</div>}</div>);
                    })}
                  </div>
                </div>
              );
            })}
            {appData.bonusActuals?.set && (<>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "var(--fg)", marginBottom: 14, textTransform: "uppercase", marginTop: 20 }}>Bonus Breakdown</div>
              {[{ field: "winner", label: "🏆 Tournament Winner", max: BONUS_RULES.winner, actual: appData.bonusActuals.winner }, { field: "topScorer", label: "⚽ Top Scorer", max: BONUS_RULES.topScorer, actual: appData.bonusActuals.topScorer }, { field: "topAssist", label: "🎯 Top Assist", max: BONUS_RULES.topAssist, actual: appData.bonusActuals.topAssist }].map(({ field, label, max, actual }) => (
                <div key={field} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", border: "1.5px solid var(--border)", marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontWeight: 700 }}>{label}</span><span style={{ color: "var(--accent)", fontWeight: 700 }}>{actual || "?"} · {max} pts</span></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {PARTICIPANTS.map(p => { const guess = appData.pretournament?.[p]?.[field], norm = s => (s || "").trim().toLowerCase(), hit = actual && norm(guess) === norm(actual), pts = actual ? (hit ? max : 0) : null; return (<div key={p} style={{ background: hit ? "#f39c1233" : pts === 0 ? "#c0392b22" : "var(--card2)", borderRadius: 8, padding: "6px 10px", minWidth: 78, textAlign: "center", border: "1px solid var(--border)" }}><div style={{ fontSize: 10, color: "var(--muted)", direction: "rtl" }}>{p.split('"')[0].trim()}</div><div style={{ fontWeight: 700, fontSize: 12 }}>{guess || "—"}</div>{pts !== null && <div style={{ fontSize: 10 }}>{hit ? `✓ ${max}` : "✗ 0"} pts</div>}</div>); })}
                  </div>
                </div>
              ))}
            </>)}
          </div>
        )}

        {view === "admin" && adminUnlocked && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "var(--fg)", marginBottom: 14, textTransform: "uppercase" }}>Admin Panel</div>
            <div style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", border: "1.5px solid var(--border)", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>🌟 Pre-Tournament</span>
                <button onClick={handleTogglePTLock} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, background: appData.ptLocked ? "#c0392b" : "var(--card2)", color: appData.ptLocked ? "#fff" : "var(--fg)" }}>{appData.ptLocked ? "🔒 Locked" : "🔓 Lock Guesses"}</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Set actuals after the tournament:</div>
              {[{ field: "winner", label: "🏆 Winner", pts: BONUS_RULES.winner }, { field: "topScorer", label: "⚽ Top Scorer", pts: BONUS_RULES.topScorer }, { field: "topAssist", label: "🎯 Top Assist", pts: BONUS_RULES.topAssist }].map(({ field, label, pts }) => (
                <div key={field} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 105 }}>{label} ({pts} pts)</span>
                  <TextInput value={adminBonus[field]} onChange={v => setAdminBonus(prev => ({ ...prev, [field]: v }))} placeholder="Actual..." disabled={false} />
                  {adminBonus[field] && <span style={{ color: "var(--accent)", fontSize: 13 }}>✓</span>}
                </div>
              ))}
              <button onClick={handleSetBonus} style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, background: "var(--accent)", color: "#fff", marginTop: 8 }}>{adminBonus.set ? "Update Actuals" : "Save Actuals"}</button>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, fontWeight: 600 }}>Matches — set odds before, results after:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GROUP_STAGE_MATCHES.map(m => {
                const r = adminResults[m.id] || { home: "", away: "", set: false }, o = adminOdds[m.id] || { home: "", draw: "", away: "", exact: "" }, locked = appData.locked?.[m.id];
                return (
                  <div key={m.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", border: "1.5px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.home} vs {m.away}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.date}</span>
                        <button onClick={() => handleLockToggle(m.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, background: locked ? "#c0392b" : "var(--card2)", color: locked ? "#fff" : "var(--fg)" }}>{locked ? "🔒" : "🔓 Lock"}</button>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Odds</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {[{ key: "home", label: "🏠 Home" }, { key: "draw", label: "🤝 Draw" }, { key: "away", label: "✈️ Away" }, { key: "exact", label: "⭐ Exact" }].map(({ key, label }) => (
                          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>{label}</span>
                            <input type="number" min="1" step="0.01" value={o[key] || ""} onChange={e => setAdminOdds(prev => ({ ...prev, [m.id]: { ...o, [key]: e.target.value } }))} placeholder="1.0" style={{ ...scoreInputStyle, width: 58 }} />
                          </div>
                        ))}
                        <button onClick={() => handleSaveOdds(m.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, background: "var(--accent)", color: "#fff" }}>Save Odds</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Real Score</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ScoreInput value={r} onChange={v => setAdminResults(prev => ({ ...prev, [m.id]: { ...r, ...v } }))} disabled={false} />
                        <button onClick={() => handleSaveMatch(m.id)} style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, background: "var(--accent)", color: "#fff" }}>{r.set ? "Update" : "Save"}</button>
                        {r.set && <span style={{ color: "#27ae60", fontSize: 12 }}>✓ {r.home}–{r.away}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;700&display=swap');
  :root { --bg:#0d0f14; --header:#111420; --card:#181c28; --card2:#1f243a; --fg:#eef0f8; --muted:#6b7280; --accent:#e8a020; --border:#252a3e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
  input[type=number] { -moz-appearance:textfield; }
  input:focus { border-color:var(--accent) !important; outline:none; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes fadeIn { from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);} }
`;
