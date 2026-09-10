import { useState, useEffect, useMemo, useRef } from "react";

const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "CNY", symbol: "¥" },
  { code: "SGD", symbol: "S$" },
  { code: "CHF", symbol: "Fr" },
  { code: "AED", symbol: "د.إ" },
  { code: "ZAR", symbol: "R" },
  { code: "BRL", symbol: "R$" },
  { code: "MXN", symbol: "$" },
  { code: "KRW", symbol: "₩" },
  { code: "RUB", symbol: "₽" },
  { code: "NZD", symbol: "NZ$" },
  { code: "HKD", symbol: "HK$" },
  { code: "SEK", symbol: "kr" },
  { code: "THB", symbol: "฿" },
];
const currencyMap = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

const TOPIC_PALETTE = [
  "#C1594A", "#CBA135", "#6E8FAE", "#A972C4", "#6FA98B",
  "#D98F5F", "#8C9A8C", "#5FA8A0", "#B4785E", "#7C8FC4",
];

function topicColor(topic) {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = (hash * 31 + topic.charCodeAt(i)) >>> 0;
  return TOPIC_PALETTE[hash % TOPIC_PALETTE.length];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n, code) {
  const symbol = currencyMap[code]?.symbol || code + " ";
  const sign = n < 0 ? "-" : "";
  return sign + symbol + Math.abs(n).toFixed(2);
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const STORAGE_KEY = "ledger-data";
const DEFAULT_FOLDER = { id: "general", name: "General", createdAt: Date.now() };

export default function ExpenseTracker() {
  const [folders, setFolders] = useState([DEFAULT_FOLDER]);
  const [activeFolderId, setActiveFolderId] = useState(DEFAULT_FOLDER.id);
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [selectedCurrency, setSelectedCurrency] = useState(null);

  const firstFieldRef = useRef(null);
  const newFolderRef = useRef(null);

  // load
  useEffect(() => {
    (async () => {
      try {
        if (window.storage && window.storage.get) {
          const res = await window.storage.get(STORAGE_KEY, false);
          if (res && res.value) {
            const data = JSON.parse(res.value);
            if (data.folders && data.folders.length) setFolders(data.folders);
            if (data.transactions) setTransactions(data.transactions);
            if (data.folders && data.folders.length) setActiveFolderId(data.folders[0].id);
          }
        } else {
          setStorageOk(false);
        }
      } catch (e) {
        // no saved data yet
      }
      setLoaded(true);
    })();
  }, []);

  // save
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        if (window.storage && window.storage.set) {
          await window.storage.set(STORAGE_KEY, JSON.stringify({ folders, transactions }), false);
        }
      } catch (e) {
        setStorageOk(false);
      }
    })();
  }, [folders, transactions, loaded]);

  useEffect(() => {
    if (formOpen && firstFieldRef.current) firstFieldRef.current.focus();
  }, [formOpen]);

  useEffect(() => {
    if (newFolderOpen && newFolderRef.current) newFolderRef.current.focus();
  }, [newFolderOpen]);

  const activeFolder = folders.find((f) => f.id === activeFolderId) || folders[0];

  const folderTx = useMemo(
    () => transactions.filter((t) => t.folderId === activeFolder?.id),
    [transactions, activeFolder]
  );

  const folderTopics = useMemo(
    () => [...new Set(folderTx.map((t) => t.topic))].sort(),
    [folderTx]
  );

  // currencies used in this folder, ranked by frequency
  const currenciesUsed = useMemo(() => {
    const counts = {};
    folderTx.forEach((t) => (counts[t.currency] = (counts[t.currency] || 0) + 1));
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [folderTx]);

  useEffect(() => {
    if (currenciesUsed.length && !currenciesUsed.includes(selectedCurrency)) {
      setSelectedCurrency(currenciesUsed[0]);
    } else if (!currenciesUsed.length) {
      setSelectedCurrency(currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolderId, currenciesUsed.join(",")]);

  const shownCurrency = selectedCurrency || currency;

  const balancesByCurrency = useMemo(() => {
    const map = {};
    folderTx.forEach((t) => {
      if (!map[t.currency]) map[t.currency] = { income: 0, expense: 0 };
      map[t.currency][t.type] += t.amount;
    });
    return map;
  }, [folderTx]);

  const shownBalance = useMemo(() => {
    const b = balancesByCurrency[shownCurrency] || { income: 0, expense: 0 };
    return b.income - b.expense;
  }, [balancesByCurrency, shownCurrency]);

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthTx = useMemo(
    () => folderTx.filter((t) => t.date.startsWith(thisMonthKey) && t.currency === shownCurrency),
    [folderTx, thisMonthKey, shownCurrency]
  );
  const monthIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const topicTotals = useMemo(() => {
    const totals = {};
    monthTx.forEach((t) => {
      if (t.type !== "expense") return;
      totals[t.topic] = (totals[t.topic] || 0) + t.amount;
    });
    const max = Math.max(1, ...Object.values(totals));
    return Object.entries(totals)
      .map(([topic, amt]) => ({ topic, amount: amt, pct: amt / max }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx]);

  const grouped = useMemo(() => {
    const sorted = [...folderTx].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    const groups = [];
    let lastDate = null;
    sorted.forEach((t) => {
      if (t.date !== lastDate) {
        groups.push({ date: t.date, items: [] });
        lastDate = t.date;
      }
      groups[groups.length - 1].items.push(t);
    });
    return groups;
  }, [folderTx]);

  function resetForm() {
    setAmount("");
    setTopic("");
    setNote("");
    setDate(todayStr());
    setType("expense");
  }

  function handleSubmit(e) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0 || !topic.trim()) return;
    const entry = {
      id: uid(),
      folderId: activeFolder.id,
      type,
      amount: Math.round(num * 100) / 100,
      currency,
      topic: topic.trim(),
      note: note.trim(),
      date,
      createdAt: Date.now(),
    };
    setTransactions((prev) => [...prev, entry]);
    setSelectedCurrency(currency);
    resetForm();
    setFormOpen(false);
  }

  function removeEntry(id) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  function createFolder(e) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const f = { id: uid(), name, createdAt: Date.now() };
    setFolders((prev) => [...prev, f]);
    setActiveFolderId(f.id);
    setNewFolderName("");
    setNewFolderOpen(false);
  }

  function deleteFolder(id) {
    if (folders.length <= 1) return;
    const folder = folders.find((f) => f.id === id);
    const count = transactions.filter((t) => t.folderId === id).length;
    const msg = count
      ? `Delete "${folder.name}" and its ${count} entr${count === 1 ? "y" : "ies"}?`
      : `Delete "${folder.name}"?`;
    if (!window.confirm(msg)) return;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setTransactions((prev) => prev.filter((t) => t.folderId !== id));
    if (activeFolderId === id) {
      const remaining = folders.filter((f) => f.id !== id);
      setActiveFolderId(remaining[0]?.id);
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input, select, button { font-family: 'Inter', sans-serif; }
        input:focus, select:focus, button:focus-visible {
          outline: 2px solid #CBA135;
          outline-offset: 2px;
        }
        .ledger-row { transition: background 0.15s ease; }
        .ledger-row:hover { background: rgba(203,161,53,0.06); }
        .ledger-row:hover .del-btn { opacity: 1; }
        .del-btn { opacity: 0; transition: opacity 0.15s ease; }
        .chip { transition: transform 0.12s ease, border-color 0.12s ease; }
        .chip:hover { transform: translateY(-1px); }
        .folder-pill:hover .folder-del { opacity: 1; }
        .folder-del { opacity: 0; transition: opacity 0.15s ease; }
        @media (max-width: 760px) {
          .ledger-shell { grid-template-columns: 1fr !important; }
          .summary-col { position: static !important; }
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #33463c; border-radius: 4px; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.brand}>
          <div style={styles.brandMark} />
          <span style={styles.brandText}>Ledger</span>
        </div>

        <div style={styles.folderBar}>
          {folders.map((f) => (
            <div
              key={f.id}
              className="folder-pill"
              style={{ ...styles.folderPill, ...(f.id === activeFolderId ? styles.folderPillActive : {}) }}
            >
              <button style={styles.folderBtn} onClick={() => setActiveFolderId(f.id)}>
                {f.name}
              </button>
              {folders.length > 1 && (
                <button
                  className="folder-del"
                  style={styles.folderDel}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(f.id);
                  }}
                  aria-label={`Delete ${f.name}`}
                >
                  &times;
                </button>
              )}
            </div>
          ))}

          {newFolderOpen ? (
            <form onSubmit={createFolder} style={styles.newFolderForm}>
              <input
                ref={newFolderRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => !newFolderName && setNewFolderOpen(false)}
                placeholder="Folder name"
                style={styles.newFolderInput}
              />
            </form>
          ) : (
            <button style={styles.newFolderBtn} onClick={() => setNewFolderOpen(true)}>
              + New folder
            </button>
          )}
        </div>

        <div style={styles.shell} className="ledger-shell">
          {/* Summary column */}
          <div style={styles.summaryCol} className="summary-col">
            <div style={styles.balanceBlock}>
              <div style={styles.balanceLabelRow}>
                <span style={styles.balanceLabel}>Balance</span>
                {currenciesUsed.length > 1 && (
                  <div style={styles.currencySwitch}>
                    {currenciesUsed.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedCurrency(c)}
                        style={{
                          ...styles.currencySwitchBtn,
                          ...(c === shownCurrency ? styles.currencySwitchBtnActive : {}),
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ ...styles.balanceNum, color: shownBalance < 0 ? "#C1594A" : "#ECE7D8" }}>
                {fmt(shownBalance, shownCurrency)}
              </div>
              <div style={styles.balanceSplit}>
                <span style={{ color: "#6FA98B" }}>{fmt(monthIncome, shownCurrency)} in</span>
                <span style={{ color: "#9FAE9F" }}> &middot; </span>
                <span style={{ color: "#C1594A" }}>{fmt(monthExpense, shownCurrency)} out</span>
                <span style={styles.balanceMonth}> this {monthLabel(todayStr())}</span>
              </div>
            </div>

            {topicTotals.length > 0 && (
              <div style={styles.breakdown}>
                <div style={styles.sectionLabel}>Where it went</div>
                {topicTotals.map((t) => (
                  <div key={t.topic} style={styles.breakdownRow}>
                    <span style={styles.breakdownName} title={t.topic}>
                      {t.topic}
                    </span>
                    <div style={styles.breakdownTrack}>
                      <div style={{ ...styles.breakdownFill, width: `${t.pct * 100}%`, background: topicColor(t.topic) }} />
                    </div>
                    <span style={styles.breakdownAmt}>{fmt(t.amount, shownCurrency)}</span>
                  </div>
                ))}
              </div>
            )}

            {!storageOk && (
              <div style={styles.warning}>Storage isn't available right now — entries will only last this session.</div>
            )}

            <button style={styles.addBtn} onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? "Close" : "Add entry"}
            </button>

            {formOpen && (
              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.typeToggle}>
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    style={{ ...styles.typeBtn, ...(type === "expense" ? styles.typeBtnActiveExpense : {}) }}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    style={{ ...styles.typeBtn, ...(type === "income" ? styles.typeBtnActiveIncome : {}) }}
                  >
                    Income
                  </button>
                </div>

                <div style={styles.amountRow}>
                  <label style={{ ...styles.fieldLabel, flex: 1 }}>
                    Amount
                    <input
                      ref={firstFieldRef}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={styles.input}
                      required
                    />
                  </label>
                  <label style={{ ...styles.fieldLabel, width: 92 }}>
                    Currency
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={styles.input}>
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={styles.fieldLabel}>
                  Topic
                  <input
                    list="topic-suggestions"
                    type="text"
                    placeholder={type === "income" ? "e.g. Salary" : "e.g. Groceries, Rent, Coffee"}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={styles.input}
                    required
                  />
                  <datalist id="topic-suggestions">
                    {folderTopics.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>

                <label style={styles.fieldLabel}>
                  Note (optional)
                  <input
                    type="text"
                    placeholder="Any extra detail"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.fieldLabel}>
                  Date
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} required />
                </label>

                <button type="submit" style={styles.saveBtn}>
                  Save entry
                </button>
              </form>
            )}
          </div>

          {/* Transactions column */}
          <div style={styles.txCol}>
            <div style={styles.txHeader}>
              <div style={styles.sectionLabel}>Transactions in {activeFolder?.name}</div>
            </div>

            {grouped.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyTitle}>Nothing recorded yet</div>
                <div style={styles.emptyText}>Add your first entry and it'll show up here, grouped by day.</div>
              </div>
            ) : (
              <div style={styles.groups}>
                {grouped.map((g) => (
                  <div key={g.date}>
                    <div style={styles.dayLabel}>{dayLabel(g.date)}</div>
                    {g.items.map((t) => (
                      <div key={t.id} className="ledger-row" style={styles.row}>
                        <span
                          style={{
                            ...styles.dot,
                            background: t.type === "income" ? "#6FA98B" : topicColor(t.topic),
                          }}
                        />
                        <span style={styles.rowDesc}>
                          {t.topic}
                          {t.note && <span style={styles.rowNote}> &middot; {t.note}</span>}
                        </span>
                        <span style={styles.rowCat}>{t.currency}</span>
                        <span
                          style={{
                            ...styles.rowAmt,
                            color: t.type === "income" ? "#6FA98B" : "#ECE7D8",
                          }}
                        >
                          {t.type === "income" ? "+" : "-"}
                          {fmt(t.amount, t.currency)}
                        </span>
                        <button className="del-btn" onClick={() => removeEntry(t.id)} style={styles.delBtn} aria-label="Delete entry">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#14201C",
    color: "#ECE7D8",
    fontFamily: "'Inter', sans-serif",
    padding: "32px 20px",
  },
  container: { maxWidth: 980, margin: "0 auto" },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  brandMark: { width: 10, height: 10, borderRadius: 2, background: "#CBA135" },
  brandText: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 22, letterSpacing: 0.2 },
  folderBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 22,
    borderBottom: "1px solid #2C3D34",
    paddingBottom: 16,
  },
  folderPill: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    borderRadius: 20,
    border: "1px solid #2C3D34",
    background: "transparent",
  },
  folderPillActive: { borderColor: "#CBA135", background: "rgba(203,161,53,0.08)" },
  folderBtn: {
    background: "none",
    border: "none",
    color: "#ECE7D8",
    padding: "7px 6px 7px 14px",
    fontSize: 13.5,
    cursor: "pointer",
  },
  folderDel: {
    background: "none",
    border: "none",
    color: "#9FAE9F",
    fontSize: 15,
    cursor: "pointer",
    padding: "6px 12px 6px 2px",
  },
  newFolderBtn: {
    background: "none",
    border: "1px dashed #3A4D42",
    borderRadius: 20,
    color: "#9FAE9F",
    padding: "7px 14px",
    fontSize: 13.5,
    cursor: "pointer",
  },
  newFolderForm: { display: "inline-flex" },
  newFolderInput: {
    background: "#1D2B25",
    border: "1px solid #CBA135",
    borderRadius: 20,
    color: "#ECE7D8",
    padding: "6px 14px",
    fontSize: 13.5,
    width: 140,
  },
  shell: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: 28,
    alignItems: "start",
  },
  summaryCol: {
    position: "sticky",
    top: 20,
    background: "#1D2B25",
    border: "1px solid #2C3D34",
    borderRadius: 6,
    padding: "22px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  balanceBlock: {},
  balanceLabelRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  balanceLabel: { fontSize: 13, color: "#9FAE9F" },
  currencySwitch: { display: "flex", gap: 4 },
  currencySwitchBtn: {
    fontSize: 11,
    padding: "2px 7px",
    borderRadius: 10,
    border: "1px solid #2C3D34",
    background: "transparent",
    color: "#9FAE9F",
    cursor: "pointer",
  },
  currencySwitchBtnActive: { borderColor: "#CBA135", color: "#CBA135" },
  balanceNum: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 500,
    fontSize: 36,
    lineHeight: 1.1,
    fontVariantNumeric: "tabular-nums",
  },
  balanceSplit: { marginTop: 8, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" },
  balanceMonth: { color: "#6E7C72" },
  sectionLabel: { fontSize: 13, color: "#9FAE9F", marginBottom: 10 },
  breakdown: { borderTop: "1px solid #2C3D34", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  breakdownRow: { display: "grid", gridTemplateColumns: "72px 1fr 62px", alignItems: "center", gap: 8, fontSize: 12.5 },
  breakdownName: { color: "#C7CEC5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  breakdownTrack: { height: 5, background: "#25342C", borderRadius: 3, overflow: "hidden" },
  breakdownFill: { height: "100%", borderRadius: 3 },
  breakdownAmt: {
    textAlign: "right",
    fontFamily: "'IBM Plex Mono', monospace",
    color: "#C7CEC5",
    fontVariantNumeric: "tabular-nums",
  },
  warning: { fontSize: 12, color: "#D98F5F", background: "#2A2318", padding: "8px 10px", borderRadius: 4, lineHeight: 1.4 },
  addBtn: {
    background: "#CBA135",
    color: "#14201C",
    border: "none",
    borderRadius: 4,
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  form: { display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #2C3D34", paddingTop: 16 },
  typeToggle: { display: "flex", gap: 6 },
  typeBtn: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 4,
    border: "1px solid #2C3D34",
    background: "transparent",
    color: "#9FAE9F",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  typeBtnActiveExpense: { borderColor: "#C1594A", color: "#C1594A", background: "rgba(193,89,74,0.1)" },
  typeBtnActiveIncome: { borderColor: "#6FA98B", color: "#6FA98B", background: "rgba(111,169,139,0.1)" },
  amountRow: { display: "flex", gap: 8 },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "#9FAE9F" },
  input: {
    background: "#14201C",
    border: "1px solid #2C3D34",
    borderRadius: 4,
    padding: "9px 10px",
    color: "#ECE7D8",
    fontSize: 14,
    width: "100%",
  },
  saveBtn: {
    marginTop: 4,
    background: "transparent",
    border: "1px solid #CBA135",
    color: "#CBA135",
    borderRadius: 4,
    padding: "10px 0",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  txCol: { minHeight: 400 },
  txHeader: { marginBottom: 6 },
  empty: {
    border: "1px dashed #2C3D34",
    borderRadius: 6,
    padding: "40px 20px",
    textAlign: "center",
    marginTop: 12,
  },
  emptyTitle: { fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 6 },
  emptyText: { fontSize: 13.5, color: "#9FAE9F" },
  groups: { display: "flex", flexDirection: "column", gap: 18 },
  dayLabel: {
    fontSize: 12,
    color: "#6E7C72",
    fontFamily: "'IBM Plex Mono', monospace",
    borderBottom: "1px solid #2C3D34",
    paddingBottom: 6,
    marginBottom: 4,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "10px 1fr auto auto 24px",
    alignItems: "center",
    gap: 12,
    padding: "9px 4px",
    borderBottom: "1px solid #202E27",
  },
  dot: { width: 7, height: 7, borderRadius: "50%" },
  rowDesc: { fontSize: 14.5, color: "#ECE7D8" },
  rowNote: { color: "#9FAE9F", fontSize: 13 },
  rowCat: { fontSize: 12.5, color: "#9FAE9F", fontFamily: "'IBM Plex Mono', monospace" },
  rowAmt: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14.5,
    fontVariantNumeric: "tabular-nums",
    minWidth: 90,
    textAlign: "right",
  },
  delBtn: {
    background: "none",
    border: "none",
    color: "#9FAE9F",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },
};
