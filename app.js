/* ============================================================
   Ledger — บัญชีรับจ่าย
   Dashboard · บัญชีรับจ่าย · เงินยืม + ดอกเบี้ยรายวัน/รายสัปดาห์
   ============================================================ */

const KEYS = { tx: "ledger_transactions", loans: "ledger_loans", opening: "ledger_opening_balance" };

const CATEGORIES = {
  income: ["เงินเดือน", "โบนัส", "Freelance", "ลงทุน", "ดอกเบี้ย", "คอมมิสชั่น", "อื่นๆ"],
  expense: ["อาหาร", "ค่าน้ำ", "ค่าไฟ", "ค่าเช่า", "ค่าโทรศัพท์", "ค่าอินเทอร์เน็ต", "การเดินทาง", "ช็อปปิ้ง", "บันเทิง", "เติมเกม", "สุขภาพ", "การศึกษา", "สินเชื่อบ้าน", "สินเชื่อรถ", "สินเชื่อส่วนบุคคล", "บัตรเครดิต", "อื่นๆ"],
};

const S = { tx: [], loans: [], openBal: 0, curType: "income", editTx: null, editLoan: null, charts: {} };
let _debugCollect = false, _debugLid = "", _debugDate = "";

// ── Helpers ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const uid = () => crypto.randomUUID();

function fmtMoney(n) { return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }); }
function esc(s) { const el = document.createElement("span"); el.textContent = s; return el.innerHTML; }
function daysBetween(a, b) { const d1 = new Date(a); d1.setHours(0,0,0,0); const d2 = new Date(b); d2.setHours(0,0,0,0); return Math.floor((d2 - d1) / 864e5); }
function localDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateRange(start, end) { const out = [], c = new Date(start), e = new Date(end); c.setHours(12,0,0,0); e.setHours(12,0,0,0); while (c <= e) { out.push(localDateStr(c)); c.setDate(c.getDate()+1); } return out; }
function weekStarts(start, end) { const out = [], c = new Date(start), e = new Date(end); c.setHours(12,0,0,0); e.setHours(12,0,0,0); while (c <= e) { out.push(localDateStr(c)); c.setDate(c.getDate()+7); } return out; }
function todayStr() { const d = new Date(); return localDateStr(d); }
function nextDay(dateStr) { const d = new Date(dateStr); d.setHours(12,0,0,0); d.setDate(d.getDate()+1); return localDateStr(d); }
function setText(sel, txt) { const el = $(sel); if (el) el.textContent = txt; }

// ── Toast ──
function toast(msg, type = "success") {
  const c = $("#toastContainer"); if (!c) return;
  const el = document.createElement("div"); el.className = `toast ${type}`; el.textContent = msg; c.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2800);
}

// ── Storage ──
function load() {
  try { S.tx = JSON.parse(localStorage.getItem(KEYS.tx)) || []; } catch { S.tx = []; }
  try { S.loans = JSON.parse(localStorage.getItem(KEYS.loans)) || []; S.loans.forEach(l => { if (l.interestType === "fixed" && !l.interestDailyRecords) l.interestDailyRecords = []; if (l.interestType === "fixedWeekly" && !l.interestWeeklyRecords) l.interestWeeklyRecords = []; if (!l.commissionDailyRecords) l.commissionDailyRecords = []; if (!l.commissionWeeklyRecords) l.commissionWeeklyRecords = []; if (!l.investorTransfers) l.investorTransfers = []; if (l.investor === undefined) l.investor = ""; }); } catch { S.loans = []; }
  try { S.openBal = parseFloat(localStorage.getItem(KEYS.opening)) || 0; } catch { S.openBal = 0; }
}
function save() {
  localStorage.setItem(KEYS.tx, JSON.stringify(S.tx));
  localStorage.setItem(KEYS.loans, JSON.stringify(S.loans));
  localStorage.setItem(KEYS.opening, String(S.openBal));
}

// ── Navigation (tabs) ──
function setupNav() {
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".page").forEach(p => p.classList.remove("active"));
      const page = $(`#page-${btn.dataset.tab}`);
      if (page) page.classList.add("active");
      if (btn.dataset.tab === "dashboard") updateCharts();
      if (btn.dataset.tab === "agent") renderAgent();
    });
  });
}

// ── Opening Balance ──
function setupOpenBal() {
  const inp = $("#openingBalance"), btn = $("#saveOpeningBtn");
  if (!inp || !btn) return;
  if (S.openBal) inp.value = S.openBal;
  btn.addEventListener("click", () => {
    S.openBal = parseFloat(inp.value) || 0;
    save(); renderLedger(); updateCharts();
    toast("บันทึกยอดยกมาแล้ว");
  });
}

// ── Charts ──
const CC = { green: "rgba(34,197,94,.8)", red: "rgba(239,68,68,.8)", palette: ["rgba(59,130,246,.8)","rgba(245,158,11,.8)","rgba(139,92,246,.8)","rgba(236,72,153,.8)","rgba(34,197,94,.8)","rgba(14,165,233,.8)","rgba(251,146,60,.8)","rgba(168,85,247,.8)"] };
const CO = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#94a3b8", font: { family: "Inter" } } } } };
function grd() { return { x: { ticks: { color: "#64748b", maxTicksLimit: 8 }, grid: { color: "rgba(148,163,184,.08)" } }, y: { ticks: { color: "#64748b" }, grid: { color: "rgba(148,163,184,.08)" } } }; }

function initCharts() {
  const c1 = $("#chartDonut");
  if (c1) S.charts.donut = new Chart(c1.getContext("2d"), { type: "doughnut", data: { labels: ["รายรับ","รายจ่าย"], datasets: [{ data: [0.01,0.01], backgroundColor: [CC.green,CC.red], borderWidth: 0, borderRadius: 4 }] }, options: { ...CO, cutout: "65%", plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } } } });
  const c2 = $("#chartMonthly");
  if (c2) S.charts.monthly = new Chart(c2.getContext("2d"), { type: "bar", data: { labels: [], datasets: [{ label: "รายรับ", data: [], backgroundColor: CC.green, borderRadius: 6 },{ label: "รายจ่าย", data: [], backgroundColor: CC.red, borderRadius: 6 }] }, options: { ...CO, plugins: { legend: { position: "top", labels: { color: "#94a3b8" } } }, scales: grd() } });
  const c3 = $("#chartCategory");
  if (c3) S.charts.cat = new Chart(c3.getContext("2d"), { type: "bar", data: { labels: [], datasets: [{ label: "รายจ่าย", data: [], backgroundColor: CC.palette, borderRadius: 6 }] }, options: { ...CO, indexAxis: "y", plugins: { legend: { display: false } }, scales: grd() } });
  const c3b = $("#chartIncCat");
  if (c3b) S.charts.incCat = new Chart(c3b.getContext("2d"), { type: "bar", data: { labels: [], datasets: [{ label: "รายรับ", data: [], backgroundColor: CC.palette, borderRadius: 6 }] }, options: { ...CO, indexAxis: "y", plugins: { legend: { display: false } }, scales: grd() } });
  const c4 = $("#chartForecast");
  if (c4) S.charts.forecast = new Chart(c4.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "ยอดสะสม (บาท)", data: [], borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,.10)", fill: true, tension: .35, pointRadius: 2 }] }, options: { ...CO, plugins: { legend: { display: false } }, scales: grd() } });
}

function updateCharts() {
  const { inc: txInc, exp: txExp } = S.tx.reduce((a, t) => { t.type === "income" ? a.inc += t.amount : a.exp += t.amount; return a; }, { inc: 0, exp: 0 });
  const perf = loanPerf();
  const totalInc = txInc + (perf.agentIncRcv || 0);
  const bal = S.openBal + totalInc - txExp;

  setText("#dashIncome", fmtMoney(totalInc));
  setText("#dashExpense", fmtMoney(txExp));
  const balEl = $("#dashBalance");
  if (balEl) { balEl.textContent = fmtMoney(bal); balEl.style.color = bal >= 0 ? "var(--blue)" : "var(--red)"; }

  let loaned = 0;
  S.loans.forEach(l => { const c = calcInt(l); if (c.remain > 0) loaned += c.totalDue; });
  setText("#dashLoaned", fmtMoney(loaned));

  if (S.charts.donut) { S.charts.donut.data.datasets[0].data = [totalInc || 0.01, txExp || 0.01]; S.charts.donut.update(); }

  // Monthly -- only count agent's actual income per loan
  const byMo = {};
  S.tx.forEach(t => { const k = t.date.slice(0,7); if (!byMo[k]) byMo[k] = { i: 0, e: 0 }; t.type === "income" ? byMo[k].i += t.amount : byMo[k].e += t.amount; });
  S.loans.forEach(l => {
    const hasInv = (l.investor || "").trim() !== "";
    if (hasInv) {
      const com = Number(l.commission) || 0;
      if (com > 0 && l.interestType === "fixed" && l.interestDailyRecords) {
        l.interestDailyRecords.filter(r => r.received).forEach(r => {
          const k = (r.date || "").slice(0,7);
          if (k) { if (!byMo[k]) byMo[k] = { i: 0, e: 0 }; byMo[k].i += com; }
        });
      }
      if (com > 0 && l.interestType === "fixedWeekly" && l.interestWeeklyRecords) {
        l.interestWeeklyRecords.filter(r => r.received).forEach(r => {
          const k = (r.weekStart || "").slice(0,7);
          if (k) { if (!byMo[k]) byMo[k] = { i: 0, e: 0 }; byMo[k].i += com; }
        });
      }
    } else {
      if (l.interestType === "fixed" && l.interestFixed && l.interestDailyRecords) {
        l.interestDailyRecords.filter(r => r.received).forEach(r => {
          const k = (r.date || "").slice(0,7);
          if (k) { if (!byMo[k]) byMo[k] = { i: 0, e: 0 }; byMo[k].i += l.interestFixed; }
        });
      }
      if (l.interestType === "fixedWeekly" && l.interestFixedWeekly && l.interestWeeklyRecords) {
        l.interestWeeklyRecords.filter(r => r.received).forEach(r => {
          const k = (r.weekStart || "").slice(0,7);
          if (k) { if (!byMo[k]) byMo[k] = { i: 0, e: 0 }; byMo[k].i += l.interestFixedWeekly; }
        });
      }
    }
  });
  const mos = Object.keys(byMo).sort().slice(-6);
  if (S.charts.monthly) {
    S.charts.monthly.data.labels = mos.map(m => { const [y,mo] = m.split("-"); return `${mo}/${y}`; });
    S.charts.monthly.data.datasets[0].data = mos.map(m => byMo[m]?.i || 0);
    S.charts.monthly.data.datasets[1].data = mos.map(m => byMo[m]?.e || 0);
    S.charts.monthly.update();
  }

  // Expense Category
  const byCat = {};
  S.tx.filter(t => t.type === "expense").forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const cats = Object.entries(byCat).sort((a,b) => b[1]-a[1]).slice(0, 8);
  if (S.charts.cat) {
    S.charts.cat.data.labels = cats.map(c => c[0]);
    S.charts.cat.data.datasets[0].data = cats.map(c => c[1]);
    S.charts.cat.data.datasets[0].backgroundColor = CC.palette.slice(0, cats.length);
    S.charts.cat.update();
  }

  // Income Category -- only agent's income
  const byIncCat = {};
  S.tx.filter(t => t.type === "income").forEach(t => { byIncCat[t.category] = (byIncCat[t.category] || 0) + t.amount; });
  const ownIntRcv = S.loans.reduce((s, l) => { if (!(l.investor || "").trim()) { const c = calcInt(l); return s + (c.intRcv || 0); } return s; }, 0);
  const invComRcv = S.loans.reduce((s, l) => { if ((l.investor || "").trim()) { const c = calcInt(l); return s + (c.comRcv || 0); } return s; }, 0);
  if (ownIntRcv > 0) byIncCat["ดอกเบี้ยเงินยืม"] = (byIncCat["ดอกเบี้ยเงินยืม"] || 0) + ownIntRcv;
  if (invComRcv > 0) byIncCat["คอมมิสชั่น"] = (byIncCat["คอมมิสชั่น"] || 0) + invComRcv;
  const incCats = Object.entries(byIncCat).sort((a,b) => b[1]-a[1]).slice(0, 8);
  if (S.charts.incCat) {
    S.charts.incCat.data.labels = incCats.map(c => c[0]);
    S.charts.incCat.data.datasets[0].data = incCats.map(c => c[1]);
    S.charts.incCat.data.datasets[0].backgroundColor = CC.palette.slice(0, incCats.length);
    S.charts.incCat.update();
  }

  // Performance -- show total interest collected and agent's actual income
  setText("#dashIntReceived", fmtMoney(perf.received));
  setText("#dashIntPending", fmtMoney(perf.pending));
  setText("#dashComReceived", fmtMoney(perf.comReceived));
  setText("#dashComPending", fmtMoney(perf.comPending));
  const agentTotal = perf.agentIncRcv + perf.agentIncPnd;
  setText("#dashCollectRate", agentTotal > 0 ? (perf.agentIncRcv / agentTotal * 100).toFixed(1) + "%" : "0%");
  setText("#dashFc7", fmtMoney(perf.fc7));
  setText("#dashFc30", fmtMoney(perf.fc30));

  if (S.charts.forecast) {
    const lbls = [], data = [];
    let cum = perf.agentIncRcv + perf.agentIncPnd;
    const daily = perf.fc7 / 7;
    for (let i = 0; i <= 14; i++) { const d = new Date(); d.setDate(d.getDate()+i); lbls.push(d.toLocaleDateString("th-TH",{day:"numeric",month:"short"})); data.push(i === 0 ? cum : (cum += daily, cum)); }
    S.charts.forecast.data.labels = lbls;
    S.charts.forecast.data.datasets[0].data = data;
    S.charts.forecast.update();
  }
}

// ── Transaction Form ──
function setupTxForm() {
  $$(".seg").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".seg").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      S.curType = btn.dataset.type;
      fillCatOpts();
    });
  });
  fillCatOpts();
  const form = $("#txForm");
  if (form) form.addEventListener("submit", handleTxSubmit);
  const cancel = $("#cancelTxBtn");
  if (cancel) cancel.addEventListener("click", cancelTxEdit);
  const d = $("#txDate"); if (d) d.value = todayStr();
}

function fillCatOpts() {
  const sel = $("#txCategory"); if (!sel) return;
  const cur = sel.value, opts = CATEGORIES[S.curType] || [];
  sel.innerHTML = '<option value="">เลือก</option>' + opts.map(c => `<option value="${c}">${c}</option>`).join("");
  if (opts.includes(cur)) sel.value = cur;
}

function handleTxSubmit(e) {
  e.preventDefault();
  const amt = parseFloat($("#txAmount").value);
  const cat = ($("#txCategory").value || "").trim();
  const desc = ($("#txDesc").value || "").trim() || cat || "(ไม่มีรายละเอียด)";
  const date = $("#txDate").value;
  if (!amt || amt <= 0) return toast("กรุณากรอกจำนวนเงิน", "error");
  if (!cat) return toast("กรุณาเลือกหมวดหมู่", "error");

  const tx = { id: S.editTx || uid(), type: S.curType, amount: amt, category: cat, description: desc, date, createdAt: S.editTx ? (S.tx.find(t => t.id === S.editTx)?.createdAt || Date.now()) : Date.now() };

  if (S.editTx) { const idx = S.tx.findIndex(t => t.id === S.editTx); if (idx >= 0) S.tx[idx] = tx; cancelTxEdit(); toast("แก้ไขรายการแล้ว"); }
  else { S.tx.unshift(tx); toast("บันทึกรายการแล้ว"); }

  save(); renderLedger(); updateCharts();
  $("#txForm").reset(); $("#txDate").value = todayStr(); fillCatOpts();
}

function cancelTxEdit() {
  S.editTx = null;
  const btn = $("#cancelTxBtn"); if (btn) btn.style.display = "none";
  const title = $("#formTitle"); if (title) title.textContent = "เพิ่มรายการ";
  $("#txForm").reset(); $("#txDate").value = todayStr();
  $$(".seg").forEach(b => b.classList.remove("active"));
  const ib = $(".seg[data-type='income']"); if (ib) ib.classList.add("active");
  S.curType = "income"; fillCatOpts();
}

function editTx(id) {
  const t = S.tx.find(x => x.id === id); if (!t) return;
  S.editTx = id; S.curType = t.type;
  $$(".seg").forEach(b => b.classList.toggle("active", b.dataset.type === t.type));
  fillCatOpts();
  $("#txAmount").value = t.amount; $("#txCategory").value = t.category; $("#txDesc").value = t.description; $("#txDate").value = t.date;
  $("#cancelTxBtn").style.display = "inline-flex"; $("#formTitle").textContent = "แก้ไขรายการ";
  const card = $(".page.active .form-grid"); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  $("#txAmount").focus();
}

function deleteTx(id) {
  if (!confirm("ลบรายการนี้?")) return;
  S.tx = S.tx.filter(t => t.id !== id);
  save(); renderLedger(); updateCharts(); toast("ลบรายการแล้ว");
}

// ── Ledger Render ──
function setupFilters() {
  const ft = $("#filterType"), fc = $("#filterCat");
  if (ft) ft.addEventListener("change", renderLedger);
  if (fc) fc.addEventListener("change", renderLedger);
}

function getFiltered() {
  let list = [...S.tx];
  const tf = ($("#filterType") || {}).value; if (tf && tf !== "all") list = list.filter(t => t.type === tf);
  const cf = ($("#filterCat") || {}).value; if (cf) list = list.filter(t => t.category === cf);
  return list;
}

function updateFilterCats() {
  const sel = $("#filterCat"); if (!sel) return;
  const tf = ($("#filterType") || {}).value;
  const opts = tf === "income" ? CATEGORIES.income : tf === "expense" ? CATEGORIES.expense : [...CATEGORIES.income, ...CATEGORIES.expense];
  const uniq = [...new Set(opts)].sort(), cur = sel.value;
  sel.innerHTML = '<option value="">ทุกหมวด</option>' + uniq.map(c => `<option value="${c}">${c}</option>`).join("");
  if (uniq.includes(cur)) sel.value = cur;
}

function renderLedger() {
  updateFilterCats();
  const filtered = getFiltered();
  const { inc: txInc, exp: txExp } = S.tx.reduce((a, t) => { t.type === "income" ? a.inc += t.amount : a.exp += t.amount; return a; }, { inc: 0, exp: 0 });
  const perf = loanPerf();
  const totalInc = txInc + (perf.agentIncRcv || 0);
  const bal = S.openBal + totalInc - txExp;

  setText("#ledgerIncome", fmtMoney(totalInc));
  setText("#ledgerExpense", fmtMoney(txExp));
  const balEl = $("#ledgerBalance");
  if (balEl) { balEl.textContent = fmtMoney(bal); balEl.style.color = bal >= 0 ? "var(--blue)" : "var(--red)"; }

  const list = $("#txList"); if (!list) return;
  const sorted = [...filtered].sort((a,b) => new Date(a.date) - new Date(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  let running = S.openBal;

  const openRow = `<div class="tx-row is-opening"><div class="tx-dot">≡</div><div class="tx-info"><div class="tx-desc">ยอดยกมา</div><div class="tx-meta">ยอดคงเหลือจากช่วงก่อนหน้า</div></div><span class="tx-cat">—</span><span class="tx-amount">${fmtMoney(S.openBal)}</span><span class="tx-balance">${fmtMoney(running)}</span><span class="tx-actions"></span></div>`;

  if (sorted.length === 0) { list.innerHTML = openRow + '<div class="empty-state"><p>ยังไม่มีรายการ</p></div>'; return; }

  const withBal = sorted.map(t => {
    running += t.type === "income" ? t.amount : -t.amount;
    return { ...t, _bal: running };
  });
  const rows = [...withBal].reverse().map(t => {
    return `<div class="tx-row is-${t.type}" data-id="${t.id}"><div class="tx-dot">${t.type === "income" ? "↑" : "↓"}</div><div class="tx-info"><div class="tx-desc">${esc(t.description)}</div><div class="tx-meta">${fmtDate(t.date)}</div></div><span class="tx-cat">${esc(t.category)}</span><span class="tx-amount">${t.type === "income" ? "+" : "-"}${fmtMoney(t.amount)}</span><span class="tx-balance">${fmtMoney(t._bal)}</span><span class="tx-actions"><button class="btn btn-icon edit-tx" title="แก้ไข">✎</button><button class="btn btn-icon del-tx" title="ลบ">✕</button></span></div>`;
  }).join("");

  list.innerHTML = rows + openRow;
  list.querySelectorAll(".edit-tx").forEach(b => b.addEventListener("click", () => editTx(b.closest(".tx-row").dataset.id)));
  list.querySelectorAll(".del-tx").forEach(b => b.addEventListener("click", () => deleteTx(b.closest(".tx-row").dataset.id)));
}

// ── Loan Interest Calc ──
function calcCom(loan) {
  const perCom = Number(loan.commission) || 0;
  if (perCom <= 0) return { comRcv: 0, comUnp: 0, comTotal: 0, perCom: 0, comDaysR: 0, comWeeksR: 0 };
  if (loan.interestType === "fixed") {
    const intRecs = loan.interestDailyRecords || [];
    const startDay = nextDay(loan.date);
    const today = todayStr();
    const allDays = startDay <= today ? dateRange(startDay, today) : [];
    const rcvSet = new Set(intRecs.filter(r => r.received).map(r => r.date));
    const comDaysR = allDays.filter(d => rcvSet.has(d)).length;
    const comRcv = comDaysR * perCom;
    const comTotal = allDays.length * perCom;
    return { comRcv, comUnp: Math.max(0, comTotal - comRcv), comTotal, perCom, comDaysR, comWeeksR: 0 };
  }
  if (loan.interestType === "fixedWeekly") {
    const intRecs = loan.interestWeeklyRecords || [];
    const startDay = nextDay(loan.date);
    const endW = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return localDateStr(d); })();
    const weeks = startDay <= endW ? weekStarts(startDay, endW) : [];
    const rcvSet = new Set(intRecs.filter(r => r.received).map(r => r.weekStart));
    const comWeeksR = weeks.filter(w => rcvSet.has(w)).length;
    const comRcv = comWeeksR * perCom;
    const comTotal = weeks.length * perCom;
    return { comRcv, comUnp: Math.max(0, comTotal - comRcv), comTotal, perCom, comDaysR: 0, comWeeksR };
  }
  return { comRcv: 0, comUnp: 0, comTotal: 0, perCom: 0, comDaysR: 0, comWeeksR: 0 };
}

function calcInvestorRate(loan) {
  if (!(loan.investor || "").trim()) return 0;
  const interest = loan.interestType === "fixedWeekly" ? (Number(loan.interestFixedWeekly) || 0) : (Number(loan.interestFixed) || 0);
  const com = Number(loan.commission) || 0;
  return Math.max(0, interest - com);
}

function calcInt(loan) {
  const principal = loan.amount;
  const paid = (loan.payments || []).reduce((s, p) => s + p.amount, 0);
  const remain = Math.max(0, principal - paid);
  const base = { principal, paid, remain };

  if (remain <= 0) {
    if (loan.interestType === "fixed") {
      const perDay = Number(loan.interestFixed) || 0;
      const daysR = (loan.interestDailyRecords || []).filter(r => r.received).length;
      const intRcv = daysR * perDay;
      const cm = calcCom(loan);
      return { ...base, interest: 0, totalDue: 0, intRcv, daysT: 0, daysR, perDay, intTotal: intRcv, weeksT: 0, weeksR: 0, perWeek: 0, ...cm };
    }
    if (loan.interestType === "fixedWeekly") {
      const perWeek = Number(loan.interestFixedWeekly) || 0;
      const weeksR = (loan.interestWeeklyRecords || []).filter(r => r.received).length;
      const intRcv = weeksR * perWeek;
      const cm = calcCom(loan);
      return { ...base, interest: 0, totalDue: 0, intRcv, daysT: 0, daysR: 0, perDay: 0, intTotal: intRcv, weeksT: 0, weeksR, perWeek, ...cm };
    }
    return { ...base, interest: 0, totalDue: 0, intRcv: 0, daysT: 0, daysR: 0, perDay: 0, intTotal: 0, weeksT: 0, weeksR: 0, perWeek: 0, comRcv: 0, comUnp: 0, comTotal: 0, perCom: 0, comDaysR: 0, comWeeksR: 0 };
  }

  if (loan.interestType === "fixed") {
    const perDay = Number(loan.interestFixed) || 0;
    const recs = loan.interestDailyRecords || [];
    const rcvSet = new Set(recs.filter(r => r.received).map(r => r.date));
    const today = todayStr();
    const startDay = nextDay(loan.date);
    const allDays = startDay <= today ? dateRange(startDay, today) : [];
    const daysT = allDays.length;
    const daysR = allDays.filter(d => rcvSet.has(d)).length;
    const intRcv = daysR * perDay;
    const intUnp = Math.max(0, (daysT - daysR) * perDay);
    const intTotal = daysT * perDay;
    const cm = calcCom(loan);
    return { ...base, interest: intUnp, totalDue: remain + intUnp, intRcv, daysT, daysR, perDay, intTotal, weeksT: 0, weeksR: 0, perWeek: 0, ...cm };
  }

  if (loan.interestType === "fixedWeekly") {
    const perWeek = Number(loan.interestFixedWeekly) || 0;
    const recs = loan.interestWeeklyRecords || [];
    const rcvSet = new Set(recs.filter(r => r.received).map(r => r.weekStart));
    const startDay = nextDay(loan.date);
    const endW = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return localDateStr(d); })();
    const weeks = startDay <= endW ? weekStarts(startDay, endW) : [];
    const weeksT = weeks.length;
    const weeksR = [...rcvSet].filter(w => weeks.includes(w)).length;
    const intRcv = weeksR * perWeek;
    const intUnp = Math.max(0, (weeksT - weeksR) * perWeek);
    const intTotal = weeksT * perWeek;
    const cm = calcCom(loan);
    return { ...base, interest: intUnp, totalDue: remain + intUnp, intRcv, daysT: weeksT * 7, daysR: 0, perDay: 0, intTotal, weeksT, weeksR, perWeek, ...cm };
  }

  const ld = new Date(loan.date), now = new Date();
  const rate = Number(loan.interestRate) || 0;
  const periods = loan.interestType === "weekly" ? Math.floor((now - ld) / (7 * 864e5)) : Math.floor((now - ld) / 864e5);
  const interest = remain * (rate / 100) * Math.max(0, periods);
  return { ...base, interest, totalDue: remain + interest, periods, intRcv: 0, daysT: periods, daysR: 0, perDay: 0, intTotal: interest, weeksT: 0, weeksR: 0, perWeek: 0, comRcv: 0, comUnp: 0, comTotal: 0, perCom: 0, comDaysR: 0, comWeeksR: 0 };
}

function loanPerf() {
  let received = 0, pending = 0, fc7 = 0, fc30 = 0, comReceived = 0, comPending = 0;
  let agentIncRcv = 0, agentIncPnd = 0;
  S.loans.forEach(l => {
    const c = calcInt(l);
    if (c.remain <= 0) return;
    const hasInv = (l.investor || "").trim() !== "";
    received += c.intRcv || 0;
    pending += c.interest || 0;
    comReceived += c.comRcv || 0;
    comPending += c.comUnp || 0;
    if (hasInv) {
      agentIncRcv += c.comRcv || 0;
      agentIncPnd += c.comUnp || 0;
      const com = Number(l.commission) || 0;
      if (l.interestType === "fixed" && com) { fc7 += com * 7; fc30 += com * 30; }
      else if (l.interestType === "fixedWeekly" && com) { fc7 += com; fc30 += com * (30/7); }
    } else {
      agentIncRcv += c.intRcv || 0;
      agentIncPnd += c.interest || 0;
      if (l.interestType === "fixed" && l.interestFixed) { fc7 += l.interestFixed * 7; fc30 += l.interestFixed * 30; }
      else if (l.interestType === "fixedWeekly" && l.interestFixedWeekly) { fc7 += l.interestFixedWeekly; fc30 += l.interestFixedWeekly * (30/7); }
      else if (c.interest && c.periods) {
        const perDay = l.interestType === "weekly" ? (c.remain * (l.interestRate || 0) / 100) / 7 : c.remain * (l.interestRate || 0) / 100;
        fc7 += perDay * 7; fc30 += perDay * 30;
      }
    }
  });
  const total = received + pending;
  return { received, pending, fc7, fc30, rate: total > 0 ? (received / total) * 100 : 0, comReceived, comPending, agentIncRcv, agentIncPnd };
}

function groupByBorrower() {
  const g = {};
  S.loans.forEach(l => {
    const name = (l.borrowerName || "").trim() || "(ไม่ระบุ)";
    if (!g[name]) g[name] = { name, loans: [], principal: 0, paid: 0, remain: 0, interest: 0, intTotal: 0, comTotal: 0, totalDue: 0, days: 0, maxDays: 0 };
    const c = calcInt(l);
    g[name].loans.push(l);
    g[name].principal += l.amount;
    g[name].paid += (l.payments || []).reduce((s, p) => s + p.amount, 0);
    g[name].remain += c.remain;
    g[name].interest += c.interest || 0;
    g[name].intTotal += c.intTotal || 0;
    g[name].comTotal += c.comTotal || 0;
    g[name].totalDue += c.totalDue || 0;
    const d = c.daysT || c.periods || daysBetween(l.date, todayStr());
    g[name].days += d;
    g[name].maxDays = Math.max(g[name].maxDays, d);
  });
  return Object.values(g).sort((a, b) => b.totalDue - a.totalDue);
}

// ── Loan Form ──
function getBorrowerNames() {
  return [...new Set(S.loans.map(l => (l.borrowerName || "").trim()).filter(Boolean))].sort();
}

function fillBorrowerList() {
  const inp = $("#lnBorrower"), dd = $("#borrowerDropdown");
  if (!inp || !dd || inp._acReady) return;
  inp._acReady = true;

  function showDD() {
    const names = getBorrowerNames();
    const q = (inp.value || "").trim().toLowerCase();
    const filtered = q ? names.filter(n => n.toLowerCase().includes(q)) : names;
    if (filtered.length === 0) { dd.style.display = "none"; return; }
    dd.innerHTML = filtered.map(n => `<div class="ac-item">${esc(n)}</div>`).join("");
    dd.style.display = "block";
    dd.querySelectorAll(".ac-item").forEach(item => {
      item.addEventListener("mousedown", (e) => { e.preventDefault(); inp.value = item.textContent; dd.style.display = "none"; });
    });
  }

  inp.addEventListener("focus", showDD);
  inp.addEventListener("input", showDD);
  inp.addEventListener("blur", () => { setTimeout(() => { dd.style.display = "none"; }, 150); });
}

function getInvestorNames() {
  return [...new Set(S.loans.map(l => (l.investor || "").trim()).filter(Boolean))].sort();
}

function fillInvestorList() {
  const inp = $("#lnInvestor"), dd = $("#investorDropdown");
  if (!inp || !dd || inp._acReady) return;
  inp._acReady = true;

  function showDD() {
    const names = getInvestorNames();
    const q = (inp.value || "").trim().toLowerCase();
    const filtered = q ? names.filter(n => n.toLowerCase().includes(q)) : names;
    if (filtered.length === 0) { dd.style.display = "none"; return; }
    dd.innerHTML = filtered.map(n => `<div class="ac-item">${esc(n)}</div>`).join("");
    dd.style.display = "block";
    dd.querySelectorAll(".ac-item").forEach(item => {
      item.addEventListener("mousedown", (e) => { e.preventDefault(); inp.value = item.textContent; dd.style.display = "none"; });
    });
  }

  inp.addEventListener("focus", showDD);
  inp.addEventListener("input", showDD);
  inp.addEventListener("blur", () => { setTimeout(() => { dd.style.display = "none"; }, 150); });
}

function updateInvCalcDisplay() {
  const sel = $("#lnIntType");
  const v = sel ? sel.value : "daily";
  const interest = v === "fixedWeekly" ? (parseFloat($("#lnFixedWeekly").value) || 0) : (parseFloat($("#lnFixed").value) || 0);
  const com = parseFloat($("#lnCommission").value) || 0;
  const hasInvestor = ($("#lnInvestor").value || "").trim() !== "";
  const isFixed = (v === "fixed" || v === "fixedWeekly");
  const gic = $("#grpInvCalc");
  if (gic) gic.style.display = (hasInvestor && isFixed) ? "flex" : "none";
  const periodEl = $("#invCalcPeriod");
  if (periodEl) periodEl.textContent = v === "fixedWeekly" ? "สัปดาห์" : "วัน";
  const display = $("#invCalcDisplay");
  if (display) display.textContent = fmtMoney(Math.max(0, interest - com)) + " บาท";
}

function setupLoanForm() {
  const form = $("#loanForm"); if (!form) return;
  form.addEventListener("submit", handleLoanSubmit);
  const cancel = $("#cancelLnBtn"); if (cancel) cancel.addEventListener("click", cancelLoanEdit);
  fillBorrowerList();
  fillInvestorList();
  const sel = $("#lnIntType");
  if (sel) sel.addEventListener("change", () => {
    const v = sel.value;
    const gr = $("#grpRate"), gf = $("#grpFixed"), gfw = $("#grpFixedWeekly"), gc = $("#grpCommission");
    if (gr) gr.style.display = (v === "daily" || v === "weekly") ? "flex" : "none";
    if (gf) gf.style.display = v === "fixed" ? "flex" : "none";
    if (gfw) gfw.style.display = v === "fixedWeekly" ? "flex" : "none";
    if (gc) gc.style.display = (v === "fixed" || v === "fixedWeekly") ? "flex" : "none";
    const pl = $("#comPeriodLabel"); if (pl) pl.textContent = v === "fixedWeekly" ? "สัปดาห์" : "วัน";
    updateInvCalcDisplay();
  });
  ["lnFixed", "lnFixedWeekly", "lnCommission"].forEach(id => {
    const el = $(`#${id}`); if (el) el.addEventListener("input", updateInvCalcDisplay);
  });
  const invInp = $("#lnInvestor");
  if (invInp) { invInp.addEventListener("input", updateInvCalcDisplay); invInp.addEventListener("blur", () => setTimeout(updateInvCalcDisplay, 200)); }
  const d = $("#lnDate"); if (d) d.value = todayStr();
}

function handleLoanSubmit(e) {
  e.preventDefault();
  const borrower = ($("#lnBorrower").value || "").trim();
  const amount = parseFloat($("#lnAmount").value);
  const date = $("#lnDate").value;
  const intType = ($("#lnIntType") || {}).value || "daily";
  const rate = parseFloat($("#lnRate").value) || 0;
  const fixed = parseFloat($("#lnFixed").value) || 0;
  const fixedWeekly = parseFloat($("#lnFixedWeekly").value) || 0;
  const commission = parseFloat($("#lnCommission").value) || 0;
  const note = ($("#lnNote").value || "").trim();
  if (!borrower || !amount || amount <= 0) return toast("กรุณากรอกชื่อและจำนวนเงิน", "error");

  const investor = ($("#lnInvestor").value || "").trim();

  const existing = S.editLoan ? S.loans.find(l => l.id === S.editLoan) : null;
  const loan = { id: S.editLoan || uid(), borrowerName: borrower, amount, date, interestType: intType, interestRate: rate, interestFixed: fixed, interestFixedWeekly: fixedWeekly, commission, investor, interestDailyRecords: existing?.interestDailyRecords || [], interestWeeklyRecords: existing?.interestWeeklyRecords || [], commissionDailyRecords: existing?.commissionDailyRecords || [], commissionWeeklyRecords: existing?.commissionWeeklyRecords || [], investorTransfers: existing?.investorTransfers || [], note, payments: existing?.payments || [], createdAt: existing?.createdAt || Date.now() };

  if (S.editLoan) { const idx = S.loans.findIndex(l => l.id === S.editLoan); if (idx >= 0) S.loans[idx] = loan; cancelLoanEdit(); toast("แก้ไขเงินยืมแล้ว"); }
  else { S.loans.push(loan); toast("บันทึกเงินยืมแล้ว"); }

  save(); renderLoans(); renderAgent(); updateCharts(); fillBorrowerList(); fillInvestorList();
  $("#loanForm").reset(); $("#lnDate").value = todayStr();
}

function editLoan(id) {
  const l = S.loans.find(x => x.id === id); if (!l) return;
  S.editLoan = id;

  $("#lnBorrower").value = l.borrowerName;
  $("#lnAmount").value = l.amount;
  $("#lnDate").value = l.date;
  $("#lnNote").value = l.note || "";

  // Interest type
  const sel = $("#lnIntType"); if (sel) sel.value = l.interestType || "daily";
  const gr = $("#grpRate"), gf = $("#grpFixed"), gfw = $("#grpFixedWeekly"), gc = $("#grpCommission");
  const v = l.interestType || "daily";
  if (gr) gr.style.display = (v === "daily" || v === "weekly") ? "flex" : "none";
  if (gf) gf.style.display = v === "fixed" ? "flex" : "none";
  if (gfw) gfw.style.display = v === "fixedWeekly" ? "flex" : "none";
  if (gc) gc.style.display = (v === "fixed" || v === "fixedWeekly") ? "flex" : "none";
  const pl = $("#comPeriodLabel"); if (pl) pl.textContent = v === "fixedWeekly" ? "สัปดาห์" : "วัน";

  if (v === "daily" || v === "weekly") { $("#lnRate").value = l.interestRate || ""; }
  if (v === "fixed") { $("#lnFixed").value = l.interestFixed || ""; }
  if (v === "fixedWeekly") { $("#lnFixedWeekly").value = l.interestFixedWeekly || ""; }
  $("#lnCommission").value = l.commission || "";
  $("#lnInvestor").value = l.investor || "";
  updateInvCalcDisplay();

  $("#cancelLnBtn").style.display = "inline-flex";
  $("#loanFormTitle").textContent = "แก้ไขเงินยืม";

  // Scroll to form
  const card = $(".page.active .form-grid"); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  $("#lnBorrower").focus();
}

function cancelLoanEdit() {
  S.editLoan = null;
  const btn = $("#cancelLnBtn"); if (btn) btn.style.display = "none";
  const title = $("#loanFormTitle"); if (title) title.textContent = "เพิ่มเงินยืม";
  $("#loanForm").reset(); $("#lnDate").value = todayStr();
  const gr = $("#grpRate"), gf = $("#grpFixed"), gfw = $("#grpFixedWeekly"), gc = $("#grpCommission"), gic = $("#grpInvCalc");
  if (gr) gr.style.display = "flex";
  if (gf) gf.style.display = "none";
  if (gfw) gfw.style.display = "none";
  if (gc) gc.style.display = "none";
  if (gic) gic.style.display = "none";
}

function addPayment(loanId, amtStr) {
  const amount = parseFloat(amtStr);
  if (!amount || amount <= 0) return toast("กรุณากรอกจำนวน", "error");
  const loan = S.loans.find(l => l.id === loanId); if (!loan) return;
  const paid = (loan.payments || []).reduce((s, p) => s + p.amount, 0);
  const pay = Math.min(amount, loan.amount - paid);
  loan.payments = loan.payments || [];
  loan.payments.push({ amount: pay, date: todayStr() });
  save(); renderLoans(); renderAgent(); updateCharts();
  toast(`รับชำระ ${fmtMoney(pay)} บาท`);
}

function deleteLoan(id) {
  if (!confirm("ลบรายการเงินยืมนี้?")) return;
  S.loans = S.loans.filter(l => l.id !== id);
  save(); renderLoans(); renderAgent(); updateCharts(); fillBorrowerList(); toast("ลบรายการแล้ว");
}

function toggleDayInt(loanId, dateStr) {
  const loan = S.loans.find(l => l.id === loanId);
  if (!loan || loan.interestType !== "fixed") return;
  loan.interestDailyRecords = loan.interestDailyRecords || [];
  const rec = loan.interestDailyRecords.find(r => r.date === dateStr);
  if (rec) rec.received = !rec.received;
  else loan.interestDailyRecords.push({ date: dateStr, received: true });
  save(); renderLoans(); renderAgent(); updateCharts();
}

function toggleWeekInt(loanId, weekStart) {
  const loan = S.loans.find(l => l.id === loanId);
  if (!loan || loan.interestType !== "fixedWeekly") return;
  loan.interestWeeklyRecords = loan.interestWeeklyRecords || [];
  const rec = loan.interestWeeklyRecords.find(r => r.weekStart === weekStart);
  if (rec) rec.received = !rec.received;
  else loan.interestWeeklyRecords.push({ weekStart, received: true });
  save(); renderLoans(); renderAgent(); updateCharts();
}

function collectDayInt(loanId, dateStr) {
  const loan = S.loans.find(l => l.id === loanId);
  if (!loan || loan.interestType !== "fixed") { toast("ไม่พบรายการ","error"); return; }
  loan.interestDailyRecords = loan.interestDailyRecords || [];
  const rec = loan.interestDailyRecords.find(r => r.date === dateStr);
  if (rec) { if (rec.received) { toast("เก็บแล้ว","info"); return; } rec.received = true; }
  else loan.interestDailyRecords.push({ date: dateStr, received: true });
  const com = Number(loan.commission) || 0;
  const rate = calcInvestorRate(loan);
  _debugCollect = true; _debugLid = loanId; _debugDate = dateStr;
  save();
  try { renderLoans(); } catch(e) { console.error("renderLoans:", e); }
  try { renderAgent(); } catch(e) { console.error("renderAgent:", e); }
  try { updateCharts(); } catch(e) { console.error("updateCharts:", e); }
  toast(`เก็บดอกแล้ว — คอม ${fmtMoney(com)} · โอน ${fmtMoney(rate)}`);
}

function collectWeekInt(loanId, weekStart) {
  const loan = S.loans.find(l => l.id === loanId);
  if (!loan || loan.interestType !== "fixedWeekly") { toast("ไม่พบรายการ","error"); return; }
  loan.interestWeeklyRecords = loan.interestWeeklyRecords || [];
  const rec = loan.interestWeeklyRecords.find(r => r.weekStart === weekStart);
  if (rec) { if (rec.received) { toast("เก็บแล้ว","info"); return; } rec.received = true; }
  else loan.interestWeeklyRecords.push({ weekStart, received: true });
  const com = Number(loan.commission) || 0;
  const rate = calcInvestorRate(loan);
  _debugCollect = true;
  save();
  try { renderLoans(); } catch(e) { console.error("renderLoans:", e); }
  try { renderAgent(); } catch(e) { console.error("renderAgent:", e); }
  try { updateCharts(); } catch(e) { console.error("updateCharts:", e); }
  toast(`เก็บดอกแล้ว — คอม ${fmtMoney(com)} · โอน ${fmtMoney(rate)}`);
}


// ── Loan Render ──
function renderLoans() {
  const list = $("#loanList"); if (!list) return;

  let owedOwn = 0, owedInv = 0, grandIntTotal = 0, grandComTotal = 0;
  S.loans.forEach(l => {
    const c = calcInt(l);
    if (c.remain > 0) {
      if ((l.investor || "").trim()) owedInv += c.totalDue;
      else owedOwn += c.totalDue;
    }
    grandIntTotal += c.intTotal || 0;
    grandComTotal += c.comTotal || 0;
  });

  setText("#loanOwedOwn", fmtMoney(owedOwn));
  setText("#loanOwedInv", fmtMoney(owedInv));
  setText("#loanTotalInt", fmtMoney(grandIntTotal + grandComTotal));
  setText("#loanCount", S.loans.length);

  const groups = groupByBorrower();

  // Summary table
  const tbody = $("#borrowerBody");
  if (tbody) {
    if (groups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">ยังไม่มีรายการ</td></tr>';
    } else {
      tbody.innerHTML = groups.map(g => `
        <tr class="${g.remain <= 0 ? "paid-row" : ""}">
          <td class="name-cell">${esc(g.name)}</td>
          <td>${g.loans.length}</td>
          <td>${g.maxDays}</td>
          <td>${fmtMoney(g.principal)}</td>
          <td>${fmtMoney(g.paid)}</td>
          <td>${fmtMoney(g.remain)}</td>
          <td class="int-cell">${fmtMoney(g.intTotal)}</td>
          <td class="com-cell">${fmtMoney(g.comTotal)}</td>
          <td class="total-cell">${fmtMoney(g.totalDue)}</td>
        </tr>`).join("");
    }
  }

  // Cards
  if (S.loans.length === 0) { list.innerHTML = '<div class="empty-state"><p>ยังไม่มีรายการเงินยืม</p></div>'; return; }

  const sortedLoans = [...S.loans].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
  list.innerHTML = sortedLoans.map(loan => {
    const c = calcInt(loan);
    const isPaid = c.remain <= 0;
    let rateStr = "ไม่มีดอกเบี้ย";
    if (loan.interestType === "fixed" && loan.interestFixed) rateStr = `ดอก ${fmtMoney(loan.interestFixed)}`;
    else if (loan.interestType === "fixedWeekly" && loan.interestFixedWeekly) rateStr = `ดอก ${fmtMoney(loan.interestFixedWeekly)}/สป.`;
    else if (loan.interestRate) rateStr = `${loan.interestRate}% ${loan.interestType === "weekly" ? "/สัปดาห์" : "/วัน"}`;
    if (loan.commission) {
      const comPer = loan.interestType === "fixedWeekly" ? "/สป." : "/วัน";
      rateStr += ` · คอม ${fmtMoney(loan.commission)}${comPer}`;
    }
    const today = todayStr();
    const invRate = calcInvestorRate(loan);
    const hasInv = (loan.investor || "").trim();
    const perLabel = loan.interestType === "fixedWeekly" ? "/สป." : "/วัน";

    // Investor badge
    let investorBadge = "";
    if (hasInv) {
      investorBadge = `<div class="loan-investor-tag"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>${esc(loan.investor)}${invRate > 0 ? ` · โอน ${fmtMoney(invRate)}${perLabel}` : ""}</div>`;
    }

    // Today's collection status for investor loans
    let todayAgentHtml = "";
    if (hasInv && !isPaid && invRate > 0) {
      let todayCollected = false;
      if (loan.interestType === "fixed") {
        todayCollected = (loan.interestDailyRecords || []).some(r => r.date === today && r.received);
      } else if (loan.interestType === "fixedWeekly") {
        const ws = nextDay(loan.date);
        const we = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return localDateStr(d); })();
        const wks = ws <= we ? weekStarts(ws, we) : [];
        const curW = wks.find(w => { const e = (() => { const d = new Date(w); d.setDate(d.getDate()+6); return localDateStr(d); })(); return w <= today && e >= today; });
        if (curW) todayCollected = (loan.interestWeeklyRecords || []).some(r => r.weekStart === curW && r.received);
      }
      const tCom = todayCollected ? (Number(loan.commission) || 0) : 0;
      const tTransfer = todayCollected ? invRate : 0;
      todayAgentHtml = `<div class="today-agent-summary${todayCollected ? " collected" : ""}">
        <div class="today-agent-item"><span>คอมฯ วันนี้</span><span class="today-val com">${fmtMoney(tCom)}</span></div>
        <div class="today-agent-item"><span>โอน ${esc(loan.investor)} วันนี้</span><span class="today-val transfer">${fmtMoney(tTransfer)}</span></div>
        <div class="today-agent-item"><span>สถานะ</span><span class="today-val ${todayCollected ? "com" : "pending"}">${todayCollected ? "✓ เก็บแล้ว" : "ยังไม่เก็บ"}</span></div>
      </div>`;
    }

    // Interest + Commission summary badge
    const hasInterest = (c.intRcv > 0 || c.interest > 0 || c.intTotal > 0);
    const hasCom = (c.comTotal > 0);
    const periodLabel = loan.interestType === "fixedWeekly" ? `(${c.weeksR}/${c.weeksT} สัปดาห์)` : (loan.interestType === "fixed" ? `(${c.daysR}/${c.daysT} วัน)` : "");
    const comPeriodLabel = loan.interestType === "fixedWeekly" ? `(${c.comWeeksR}/${c.weeksT} สป.)` : (loan.interestType === "fixed" ? `(${c.comDaysR}/${c.daysT} วัน)` : "");
    let intBadge = "";
    if (hasInterest || hasCom) {
      intBadge = `<div class="int-summary">`;
      if (hasInterest) {
        intBadge += `<div class="int-item"><span class="int-label">ดอกเบี้ย ${periodLabel}</span><span class="int-val rcv">${fmtMoney(c.intRcv)} / ${fmtMoney(c.intTotal)}</span></div>`;
      }
      if (hasCom) {
        intBadge += `<div class="int-item"><span class="int-label">คอมฯ ${comPeriodLabel}</span><span class="int-val com">${fmtMoney(c.comRcv)} / ${fmtMoney(c.comTotal)}</span></div>`;
      }
      intBadge += `<div class="int-item"><span class="int-label">ค้างเก็บ</span><span class="int-val pnd">${fmtMoney(c.interest || 0)}</span></div>`;
      intBadge += `</div>`;
    }

    let dailyHtml = "";
    if (!isPaid && loan.interestType === "fixed" && loan.interestFixed) {
      const recs = loan.interestDailyRecords || [];
      const rcvMap = {}; recs.forEach(r => { rcvMap[r.date] = r.received; });
      const startDay = nextDay(loan.date);
      const days = startDay <= today ? dateRange(startDay, today).slice(-14) : [];
      dailyHtml = `<div class="daily-section"><div class="daily-title">ดอกเบี้ยรายวัน (14 วันล่าสุด)</div><div class="daily-grid">${days.map(d => {
        const done = !!rcvMap[d];
        const overdue = !done && d < today;
        const label = new Date(d).toLocaleDateString("th-TH",{day:"numeric",month:"short"});
        return `<label class="day-box ${done ? "done" : ""} ${overdue ? "overdue" : ""}" data-lid="${loan.id}" data-d="${d}" data-ct="int"><input type="checkbox" ${done ? "checked" : ""}/><span class="dlabel">${label}</span><span class="damount">${fmtMoney(loan.interestFixed)}</span></label>`;
      }).join("")}</div></div>`;
    }

    // Weekly tracking (fixedWeekly บาท/สัปดาห์) — เริ่มเก็บวันถัดจากวันที่ให้ยืม
    let weeklyHtml = "";
    if (!isPaid && loan.interestType === "fixedWeekly" && loan.interestFixedWeekly) {
      const wRecs = loan.interestWeeklyRecords || [];
      const wMap = {}; wRecs.forEach(r => { wMap[r.weekStart] = r.received; });
      const wStart = nextDay(loan.date);
      const wEndDate = new Date(); wEndDate.setDate(wEndDate.getDate() + 6);
      const wEndStr = localDateStr(wEndDate);
      const weeks = wStart <= wEndStr ? weekStarts(wStart, wEndStr).slice(-10) : [];
      weeklyHtml = `<div class="daily-section"><div class="daily-title">ดอกเบี้ยรายสัปดาห์ (10 สัปดาห์ล่าสุด)</div><div class="daily-grid">${weeks.map((w, i) => {
        const done = !!wMap[w];
        const wEnd = (() => { const d = new Date(w); d.setDate(d.getDate() + 6); return localDateStr(d); })();
        const overdue = !done && wEnd < today;
        const wDate = new Date(w);
        const label = wDate.toLocaleDateString("th-TH",{day:"numeric",month:"short"});
        return `<label class="day-box ${done ? "done" : ""} ${overdue ? "overdue" : ""}" data-lid="${loan.id}" data-w="${w}" data-ct="int"><input type="checkbox" ${done ? "checked" : ""}/><span class="dlabel">สป.${label}</span><span class="damount">${fmtMoney(loan.interestFixedWeekly)}</span></label>`;
      }).join("")}</div></div>`;
    }

    return `
      <div class="loan-card ${isPaid ? "is-paid" : ""}${hasInv ? " has-investor" : ""}" data-id="${loan.id}">
        <div class="loan-top">
          <span class="loan-name">${esc(loan.borrowerName)}</span>
          <span class="loan-due">${isPaid ? "✓ ชำระแล้ว" : fmtMoney(c.totalDue) + " บาท"}</span>
        </div>
        ${investorBadge}
        <div class="loan-meta-line">เงินต้น ${fmtMoney(loan.amount)} · ${fmtDate(loan.date)} · ${rateStr}${loan.note ? " · " + esc(loan.note) : ""}</div>
        ${intBadge}
        ${todayAgentHtml}
        ${dailyHtml}
        ${weeklyHtml}
        ${!isPaid ? `<div class="pay-row"><input type="number" placeholder="จำนวนชำระเงินต้น" min="0" step="0.01" class="pay-inp" data-lid="${loan.id}"/><button class="btn btn-sm btn-green pay-btn" data-lid="${loan.id}">ชำระ</button></div>` : ""}
        <div class="loan-bottom"><button class="btn btn-icon edit-loan" data-lid="${loan.id}" title="แก้ไข">✎</button><button class="btn btn-icon del-loan" data-lid="${loan.id}" title="ลบ">✕</button></div>
      </div>`;
  }).join("");

  list.querySelectorAll(".pay-btn").forEach(b => { b.addEventListener("click", () => { const inp = list.querySelector(`.pay-inp[data-lid="${b.dataset.lid}"]`); if (inp) addPayment(b.dataset.lid, inp.value); }); });
  list.querySelectorAll(".edit-loan").forEach(b => b.addEventListener("click", () => editLoan(b.dataset.lid)));
  list.querySelectorAll(".del-loan").forEach(b => b.addEventListener("click", () => deleteLoan(b.dataset.lid)));
  list.querySelectorAll(".day-box").forEach(lbl => {
    const cb = lbl.querySelector('input[type="checkbox"]');
    if (cb) cb.addEventListener("change", () => {
      if (lbl.dataset.w) toggleWeekInt(lbl.dataset.lid, lbl.dataset.w);
      else toggleDayInt(lbl.dataset.lid, lbl.dataset.d);
    });
  });
}

// ── Agent Tab ──
function getInvestorLoans() {
  return S.loans.filter(l => (l.investor || "").trim() && calcInt(l).remain > 0);
}

function isTransferred(loan, dateOrWeek) {
  return (loan.investorTransfers || []).some(t => t.date === dateOrWeek && t.confirmed);
}

function confirmTransfer(loanId, dateOrWeek) {
  const loan = S.loans.find(l => l.id === loanId);
  if (!loan) return;
  loan.investorTransfers = loan.investorTransfers || [];
  const existing = loan.investorTransfers.find(t => t.date === dateOrWeek);
  if (existing) { existing.confirmed = !existing.confirmed; }
  else { loan.investorTransfers.push({ date: dateOrWeek, confirmed: true }); }
  save(); renderAgent(); renderLoans();
}

function autoCollectAndTransfer(loanId, dateOrWeek, isWeekly) {
  const loan = S.loans.find(l => l.id === loanId);
  if (!loan) return;
  if (isWeekly) {
    loan.interestWeeklyRecords = loan.interestWeeklyRecords || [];
    const rec = loan.interestWeeklyRecords.find(r => r.weekStart === dateOrWeek);
    if (rec) rec.received = true;
    else loan.interestWeeklyRecords.push({ weekStart: dateOrWeek, received: true });
  } else {
    loan.interestDailyRecords = loan.interestDailyRecords || [];
    const rec = loan.interestDailyRecords.find(r => r.date === dateOrWeek);
    if (rec) rec.received = true;
    else loan.interestDailyRecords.push({ date: dateOrWeek, received: true });
  }
  loan.investorTransfers = loan.investorTransfers || [];
  const existing = loan.investorTransfers.find(t => t.date === dateOrWeek);
  if (existing) existing.confirmed = true;
  else loan.investorTransfers.push({ date: dateOrWeek, confirmed: true });
  const rate = calcInvestorRate(loan);
  save(); renderLoans(); renderAgent(); updateCharts();
  toast(`โอนแล้ว ${fmtMoney(rate)}`);
}

function renderAgent() {
 try {
  const todayList = $("#agentTodayList");
  const overdueList = $("#agentOverdueList");
  const invBody = $("#investorSummaryBody");
  if (!todayList && !overdueList) return;

  const today = todayStr();
  const invLoans = getInvestorLoans();

  const todaySection = [];
  const overdueSection = [];
  const investorTotals = {};

  invLoans.forEach(loan => {
    const inv = (loan.investor || "").trim();
    const rate = calcInvestorRate(loan);
    const com = Number(loan.commission) || 0;
    const intAmt = loan.interestType === "fixedWeekly" ? (Number(loan.interestFixedWeekly) || 0) : (Number(loan.interestFixed) || 0);
    if (!inv) return;

    if (!investorTotals[inv]) investorTotals[inv] = { count: 0, transferred: 0, pending: 0, overdue: 0, total: 0 };

    const processPeriod = (dateKey, isToday, isPast, isWeekly) => {
      const collected = isWeekly
        ? (loan.interestWeeklyRecords || []).some(r => r.weekStart === dateKey && r.received)
        : (loan.interestDailyRecords || []).some(r => r.date === dateKey && r.received);
      const transferred = collected && isTransferred(loan, dateKey);
      const item = { loan, investor: inv, date: dateKey, intAmt, com, rate, collected, transferred, isWeekly, isOverdue: isPast };

      investorTotals[inv].count++;
      investorTotals[inv].total += rate;

      if (isToday) {
        todaySection.push(item);
        if (transferred) investorTotals[inv].transferred += rate;
        else investorTotals[inv].pending += rate;
      } else if (isPast) {
        if (collected && !transferred) {
          todaySection.push(item);
          investorTotals[inv].pending += rate;
        } else if (collected && transferred) {
          investorTotals[inv].transferred += rate;
        } else {
          overdueSection.push(item);
          investorTotals[inv].overdue += rate;
        }
      }
    };

    if (loan.interestType === "fixed") {
      const startDay = nextDay(loan.date);
      const allDays = startDay <= today ? dateRange(startDay, today) : [];
      allDays.forEach(d => processPeriod(d, d === today, d < today, false));
    } else if (loan.interestType === "fixedWeekly") {
      const startDay = nextDay(loan.date);
      const endW = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return localDateStr(d); })();
      const weeks = startDay <= endW ? weekStarts(startDay, endW) : [];
      weeks.forEach(w => {
        const wEnd = (() => { const d = new Date(w); d.setDate(d.getDate() + 6); return localDateStr(d); })();
        processPeriod(w, w <= today && wEnd >= today, wEnd < today, true);
      });
    }
  });

  let intToday = 0, comToday = 0, transferToday = 0, totalOverdue = 0;
  todaySection.forEach(i => {
    if (i.isOverdue) {
      if (i.collected) { intToday += i.intAmt; comToday += i.com; transferToday += i.rate; }
    } else {
      intToday += i.intAmt; comToday += i.com; transferToday += i.rate;
    }
  });
  overdueSection.forEach(i => { totalOverdue += i.intAmt; });
  console.log("[renderAgent]", { todayCount: todaySection.length, overdueCount: overdueSection.length, intToday, comToday, transferToday, totalOverdue, todayItems: todaySection.map(i => ({ borrower: i.loan.borrowerName, date: i.date, collected: i.collected, isOverdue: i.isOverdue })) });
  if (_debugCollect) {
    _debugCollect = false;
    const dbgLoan = S.loans.find(l => l.id === _debugLid);
    const dbgInv = dbgLoan ? (dbgLoan.investor||"").trim() : "NO LOAN";
    const dbgType = dbgLoan ? dbgLoan.interestType : "?";
    const dbgRec = dbgLoan ? (dbgLoan.interestDailyRecords||[]).find(r => r.date === _debugDate) : null;
    const dbgInList = invLoans.some(l => l.id === _debugLid);
    alert(`[DEBUG]\ntodaySection: ${todaySection.length}\noverdueCollected: ${todaySection.filter(i=>i.isOverdue&&i.collected).length}\noverdueLeft: ${overdueSection.length}\n---\nloanId: ${_debugLid}\ndate: ${_debugDate}\ninvestor: ${dbgInv}\ntype: ${dbgType}\nrecord: ${JSON.stringify(dbgRec)}\ninInvLoans: ${dbgInList}\ntoday: ${today}`);
  }
  setText("#agentIntToday", fmtMoney(intToday));
  setText("#agentComToday", fmtMoney(comToday));
  setText("#agentTransferToday", fmtMoney(transferToday));
  setText("#agentOverdue", fmtMoney(totalOverdue));

  const todayBadge = $("#agentTodayBadge");
  if (todayBadge) todayBadge.textContent = transferToday > 0 ? `โอน ${fmtMoney(transferToday)}` : "";
  const overdueBadge = $("#agentOverdueBadge");
  if (overdueBadge) overdueBadge.textContent = totalOverdue > 0 ? `ค้าง ${fmtMoney(totalOverdue)}` : "";

  // Today's section grouped by investor
  const todayByInv = {};
  todaySection.forEach(i => {
    if (!todayByInv[i.investor]) todayByInv[i.investor] = [];
    todayByInv[i.investor].push(i);
  });

  if (todayList) {
    if (todaySection.length === 0) {
      todayList.innerHTML = '<div class="empty-state"><p>ไม่มีรายการวันนี้</p></div>';
    } else {
      const groupsHtml = Object.entries(todayByInv).map(([inv, items]) => {
        const countable = items.filter(i => i.isOverdue ? i.collected : true);
        const invComTotal = countable.reduce((s, i) => s + i.com, 0);
        const invTransTotal = countable.reduce((s, i) => s + i.rate, 0);
        const rows = items.map(i => {
          const dateLabel = i.isWeekly
            ? `สป. ${new Date(i.date).toLocaleDateString("th-TH",{day:"numeric",month:"short"})}`
            : new Date(i.date).toLocaleDateString("th-TH",{day:"numeric",month:"short"});
          const overdueTag = i.isOverdue ? `<span class="agent-overdue-tag">ค้างชำระ</span>` : "";
          const actionHtml = i.transferred
            ? `<span class="agent-status confirmed">✓ โอนแล้ว</span>`
            : `<button class="btn btn-sm btn-amber agent-transfer-btn" data-lid="${i.loan.id}" data-d="${i.date}" data-weekly="${!!i.isWeekly}">โอน</button>`;
          return `<div class="agent-row ${i.transferred ? "transferred" : "pending"}">
            <span class="agent-borrower">${esc(i.loan.borrowerName)}${overdueTag}</span>
            <span class="agent-date">${dateLabel}</span>
            <span class="agent-amount">ดอก ${fmtMoney(i.intAmt)}</span>
            <span class="agent-detail">คอม ${fmtMoney(i.com)} · โอน ${fmtMoney(i.rate)}</span>
            ${actionHtml}
          </div>`;
        }).join("");
        return `<div class="agent-group">
          <div class="agent-group-head"><span class="agent-inv-name">${esc(inv)}</span><span class="agent-inv-total">คอม ${fmtMoney(invComTotal)} · โอน ${fmtMoney(invTransTotal)}</span></div>
          ${rows}
        </div>`;
      }).join("");

      const todayItemCount = todaySection.length;
      const collectedOverdue = todaySection.filter(i => i.isOverdue && i.collected).length;
      const totalSummary = `<div class="agent-today-total">
        <div class="agent-total-row"><span>รายการทั้งหมด</span><strong>${todayItemCount} รายการ${collectedOverdue > 0 ? ` (ค้าง ${collectedOverdue})` : ""}</strong></div>
        <div class="agent-total-row"><span>ดอกเบี้ยที่เก็บได้</span><strong>${fmtMoney(intToday)}</strong></div>
        <div class="agent-total-row"><span>คอมฯ นายหน้า</span><strong class="com">${fmtMoney(comToday)}</strong></div>
        <div class="agent-total-row"><span>ต้องโอน Investor</span><strong class="transfer">${fmtMoney(transferToday)}</strong></div>
      </div>`;

      todayList.innerHTML = groupsHtml + totalSummary;
      todayList.querySelectorAll(".agent-transfer-btn").forEach(b => {
        b.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          b.disabled = true;
          autoCollectAndTransfer(b.dataset.lid, b.dataset.d, b.dataset.weekly === "true");
        });
      });
    }
  }

  // Overdue: only NOT collected items
  const overdueByInv = {};
  overdueSection.forEach(i => {
    if (!overdueByInv[i.investor]) overdueByInv[i.investor] = [];
    overdueByInv[i.investor].push(i);
  });

  if (overdueList) {
    if (overdueSection.length === 0) {
      overdueList.innerHTML = '<div class="empty-state"><p>ไม่มีรายการค้างเก็บ</p></div>';
    } else {
      overdueList.innerHTML = Object.entries(overdueByInv).map(([inv, items]) => {
        const byLoan = {};
        items.forEach(i => {
          if (!byLoan[i.loan.id]) byLoan[i.loan.id] = { loan: i.loan, periods: [], total: 0 };
          byLoan[i.loan.id].periods.push(i);
          byLoan[i.loan.id].total += i.intAmt;
        });
        const invTotal = items.reduce((s, i) => s + i.intAmt, 0);
        const loanRows = Object.values(byLoan).map(bl => {
          const periodDetails = bl.periods.map(p => {
            const dateLabel = p.isWeekly
              ? `สป. ${new Date(p.date).toLocaleDateString("th-TH",{day:"numeric",month:"short"})}`
              : new Date(p.date).toLocaleDateString("th-TH",{day:"numeric",month:"short"});
            return `<div class="agent-row overdue-row">
              <span class="agent-date">${dateLabel}</span>
              <span class="agent-amount">ดอก ${fmtMoney(p.intAmt)}</span>
              <span class="agent-detail">คอม ${fmtMoney(p.com)} · โอน ${fmtMoney(p.rate)}</span>
              <button class="btn btn-sm btn-amber agent-collect-btn" data-lid="${p.loan.id}" data-d="${p.date}" data-weekly="${!!p.isWeekly}">เก็บดอก</button>
            </div>`;
          }).join("");
          return `<div class="agent-loan-block">
            <div class="agent-loan-info">ผู้ยืม: <strong>${esc(bl.loan.borrowerName)}</strong> · ค้าง ${bl.periods.length} งวด · รวม ${fmtMoney(bl.total)}</div>
            ${periodDetails}
          </div>`;
        }).join("");
        return `<div class="agent-group overdue-group">
          <div class="agent-group-head"><span class="agent-inv-name">${esc(inv)}</span><span class="agent-inv-total overdue-total">ค้างเก็บ ${fmtMoney(invTotal)}</span></div>
          ${loanRows}
        </div>`;
      }).join("");
      overdueList.querySelectorAll(".agent-collect-btn").forEach(b => {
        b.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          b.disabled = true;
          if (b.dataset.weekly === "true") collectWeekInt(b.dataset.lid, b.dataset.d);
          else collectDayInt(b.dataset.lid, b.dataset.d);
        });
      });
    }
  }

  // Investor summary table
  if (invBody) {
    const entries = Object.entries(investorTotals).sort((a,b) => b[1].total - a[1].total);
    if (entries.length === 0) {
      invBody.innerHTML = '<tr><td colspan="5" class="empty-cell">ไม่มีรายการ Investor</td></tr>';
    } else {
      invBody.innerHTML = entries.map(([name, v]) => `
        <tr>
          <td class="name-cell">${esc(name)}</td>
          <td>${v.count}</td>
          <td class="int-cell">${fmtMoney(v.transferred)}</td>
          <td style="color:var(--red);font-family:var(--mono);font-weight:600">${fmtMoney(v.overdue)}</td>
          <td class="total-cell">${fmtMoney(v.total)}</td>
        </tr>`).join("");
    }
  }
 } catch(err) { console.error("renderAgent error:", err); toast("Agent error: " + err.message, "error"); }
}

// ── Generate PWA icons from canvas ──
function generateIcons() {
  [192, 512].forEach(size => {
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const ctx = c.getContext("2d"); const s = size; const r = s * 0.15;
    ctx.fillStyle = "#111820";
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(s - r, 0); ctx.quadraticCurveTo(s, 0, s, r);
    ctx.lineTo(s, s - r); ctx.quadraticCurveTo(s, s, s - r, s); ctx.lineTo(r, s);
    ctx.quadraticCurveTo(0, s, 0, s - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath(); ctx.fill();
    const cx = s / 2, cy = s * 0.42, bw = s * 0.28, bh = s * 0.32;
    ctx.lineWidth = s * 0.025; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#3b82f6"; ctx.fillStyle = "rgba(59,130,246,0.1)";
    ctx.beginPath(); ctx.moveTo(cx, cy - bh / 2);
    ctx.quadraticCurveTo(cx - bw * 0.5, cy - bh / 2, cx - bw, cy - bh / 2 + bh * 0.15);
    ctx.lineTo(cx - bw, cy + bh / 2);
    ctx.quadraticCurveTo(cx - bw * 0.5, cy + bh / 2 - bh * 0.08, cx, cy + bh / 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#22c55e"; ctx.fillStyle = "rgba(34,197,94,0.1)";
    ctx.beginPath(); ctx.moveTo(cx, cy - bh / 2);
    ctx.quadraticCurveTo(cx + bw * 0.5, cy - bh / 2, cx + bw, cy - bh / 2 + bh * 0.15);
    ctx.lineTo(cx + bw, cy + bh / 2);
    ctx.quadraticCurveTo(cx + bw * 0.5, cy + bh / 2 - bh * 0.08, cx, cy + bh / 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath(); ctx.moveTo(cx, cy - bh / 2); ctx.lineTo(cx, cy + bh / 2); ctx.stroke();
    ctx.fillStyle = "#3b82f6"; ctx.font = `700 ${s * 0.09}px system-ui`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$", cx - bw * 0.5, cy + bh * 0.05);
    ctx.fillStyle = "#22c55e"; ctx.fillText("฿", cx + bw * 0.5, cy + bh * 0.05);
    ctx.fillStyle = "#f1f5f9"; ctx.font = `600 ${s * 0.1}px system-ui`;
    ctx.fillText("Ledger", cx, s * 0.78);
    const dataUrl = c.toDataURL("image/png");
    const link = document.querySelector(`link[rel="apple-touch-icon"]`);
    if (link && size === 192) link.href = dataUrl;
  });
}

// ── Export / Import ──
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: S.tx,
    loans: S.loans,
    openingBalance: S.openBal
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Export สำเร็จ");
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.transactions && !data.loans) throw new Error("invalid");
      const txCount = (data.transactions || []).length;
      const loanCount = (data.loans || []).length;
      if (!confirm(`นำเข้าข้อมูล:\n• รายการรับจ่าย ${txCount} รายการ\n• เงินยืม ${loanCount} รายการ\n• ยอดยกมา ${(data.openingBalance || 0).toLocaleString()} บาท\n\nข้อมูลเดิมจะถูกแทนที่ ต้องการดำเนินการ?`)) return;
      S.tx = data.transactions || [];
      S.loans = data.loans || [];
      S.openBal = Number(data.openingBalance) || 0;
      save();
      renderLedger(); renderLoans(); renderAgent(); updateCharts();
      const ob = $("#openBal"); if (ob) ob.value = S.openBal || "";
      toast("Import สำเร็จ");
    } catch (err) {
      toast("ไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ที่ Export จากระบบ", "error");
    }
  };
  reader.readAsText(file);
}

function forceUpdate() {
  if (!("serviceWorker" in navigator)) { location.reload(true); return; }
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.unregister().then(() => {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
          toast("ล้าง cache แล้ว กำลังโหลดใหม่...");
          setTimeout(() => location.reload(true), 500);
        });
      });
    } else {
      location.reload(true);
    }
  });
}

function setupDataActions() {
  const expBtn = $("#exportBtn");
  const impBtn = $("#importBtn");
  const impFile = $("#importFile");
  const updBtn = $("#updateBtn");
  if (expBtn) expBtn.addEventListener("click", exportData);
  if (impBtn) impBtn.addEventListener("click", () => impFile && impFile.click());
  if (impFile) impFile.addEventListener("change", (e) => { importData(e.target.files[0]); e.target.value = ""; });
  if (updBtn) updBtn.addEventListener("click", forceUpdate);
}

// ── Boot ──
function init() {
  load(); setupNav(); setupOpenBal(); setupTxForm(); setupLoanForm(); setupFilters(); setupDataActions(); initCharts(); renderLedger(); renderLoans(); renderAgent(); updateCharts();
  generateIcons();
}
init();
