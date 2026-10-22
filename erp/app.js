import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEMO_ACCOUNTS, DEMO_CLASS_LIST, DEMO_PASSWORD, DEMO_STORAGE_KEY, createInitialDemoData
} from "./demo-data.js";

const config = window.SARASWATI_ERP_CONFIG || {};
const hasSupabaseConfig = typeof config.supabaseUrl === "string"
  && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl)
  && typeof config.supabaseAnonKey === "string"
  && config.supabaseAnonKey.length > 20
  && !config.supabaseAnonKey.includes("YOUR-");
const supabase = hasSupabaseConfig ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const DEMO_MODE = !supabase || new URLSearchParams(window.location.search).get("demo") === "1";

const loginLayout = document.querySelector("#login-layout");
const publicFooter = document.querySelector("#public-footer");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginStatus = document.querySelector("#login-status");
const demoNotice = document.querySelector("#demo-notice");
const setupNotice = document.querySelector("#setup-notice");
const demoAccountList = document.querySelector("#demo-account-list");
const demoAccountButtons = document.querySelector("#demo-account-buttons");
const portalRoot = document.querySelector("#portal-root");
const portalNav = document.querySelector("#portal-nav");
const portalView = document.querySelector("#portal-view");
const portalStatus = document.querySelector("#portal-status");

let currentUser = null;
let currentIsDemo = false;
let schoolData = null;
let activeView = "overview";

const roleMeta = {
  admin: { label: "Principal / Administrator", short: "Principal", icon: "♛" },
  finance: { label: "Finance Department", short: "Finance", icon: "₹" },
  teacher: { label: "Teacher", short: "Teacher", icon: "▤" },
  parent: { label: "Parent / Guardian", short: "Parent", icon: "⌂" },
  student: { label: "Student", short: "Student", icon: "✦" }
};

const navByRole = {
  admin: [
    ["overview", "Overview", "⌂"], ["students", "Students", "♧"], ["attendance", "Attendance", "✓"],
    ["marks", "Exams & marks", "▤"], ["datesheets", "Datesheets", "▦"], ["fees", "Fees & payments", "₹"],
    ["notices", "Notices", "▧"], ["accounts", "Demo accounts", "♙"]
  ],
  finance: [
    ["overview", "Overview", "⌂"], ["students", "Students", "♧"], ["fees", "Fees & payments", "₹"], ["notices", "Notices", "▧"]
  ],
  teacher: [
    ["overview", "Overview", "⌂"], ["students", "My class", "♧"], ["attendance", "Attendance", "✓"],
    ["marks", "Exams & marks", "▤"], ["datesheets", "Datesheets", "▦"], ["notices", "Notices", "▧"]
  ],
  parent: [
    ["overview", "Overview", "⌂"], ["attendance", "Attendance", "✓"], ["marks", "Marks & results", "▤"],
    ["datesheets", "Datesheets", "▦"], ["fees", "Fees", "₹"], ["notices", "Notices", "▧"]
  ],
  student: [
    ["overview", "Overview", "⌂"], ["attendance", "My attendance", "✓"], ["marks", "My marks", "▤"],
    ["datesheets", "Datesheets", "▦"], ["fees", "My fees", "₹"], ["notices", "Notices", "▧"]
  ]
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function todayISO() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function currency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function totalDue(invoice) {
  if (invoice.status === "Paid") return 0;
  return Math.max(0, Number(invoice.amount || 0) - Number(invoice.paidAmount || 0));
}

function studentById(id) {
  return (schoolData?.students || []).find(student => student.id === id);
}

function studentName(id) {
  return studentById(id)?.fullName || "Unknown student";
}

function visibleStudentIds() {
  if (!schoolData || !currentUser) return [];
  if (currentUser.role === "student") return [currentUser.studentId].filter(Boolean);
  if (currentUser.role === "parent") return currentUser.studentIds || [];
  return schoolData.students.map(student => student.id);
}

function visibleStudents() {
  const ids = new Set(visibleStudentIds());
  return (schoolData?.students || []).filter(student => ids.has(student.id));
}

function visibleMarks() {
  const ids = new Set(visibleStudentIds());
  const marks = (schoolData?.marks || []).filter(mark => ids.has(mark.studentId));
  if (currentUser?.role === "student" || currentUser?.role === "parent") {
    return marks.filter(mark => mark.status === "Published");
  }
  return marks;
}

function visibleInvoices() {
  const ids = new Set(visibleStudentIds());
  return (schoolData?.invoices || []).filter(invoice => ids.has(invoice.studentId));
}

function visibleAttendance() {
  const ids = new Set(visibleStudentIds());
  return (schoolData?.attendance || []).filter(row => ids.has(row.studentId));
}

function attendancePercent(studentId) {
  const rows = (schoolData?.attendance || []).filter(row => row.studentId === studentId);
  if (!rows.length) return 0;
  const attended = rows.filter(row => row.status === "Present" || row.status === "Late").length;
  return Math.round(attended / rows.length * 100);
}

function averageMarks(studentId) {
  const rows = (schoolData?.marks || []).filter(row => row.studentId === studentId && row.status === "Published" && Number(row.maxMarks) > 0);
  if (!rows.length) return null;
  return Math.round(rows.reduce((sum, row) => sum + Number(row.score) / Number(row.maxMarks) * 100, 0) / rows.length);
}

function studentOutstanding(studentId) {
  return (schoolData?.invoices || []).filter(invoice => invoice.studentId === studentId).reduce((sum, invoice) => sum + totalDue(invoice), 0);
}

function currentRole() {
  return currentUser ? roleMeta[currentUser.role] : null;
}

function showLoginMessage(message, isError = true) {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "var(--danger)" : "var(--green-2)";
}

function showPortalMessage(message, isError = false) {
  portalStatus.textContent = message;
  portalStatus.dataset.error = isError ? "true" : "false";
}

function loadDemoData() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.students) && Array.isArray(parsed.marks) && Array.isArray(parsed.invoices)) return parsed;
    }
  } catch (error) {
    console.warn("Demo data could not be read; loading fresh sample data.", error);
  }
  return createInitialDemoData();
}

function persistDemoData() {
  if (!currentIsDemo || !schoolData) return;
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(schoolData));
  } catch (error) {
    console.error("Demo data could not be saved.", error);
    showPortalMessage("Browser storage is full. Download any important demo attachment and reset oversized demo data.", true);
  }
}

function recordAudit(message) {
  if (!currentIsDemo || !schoolData) return;
  schoolData.audit ||= [];
  schoolData.audit.unshift({
    id: "LOG-" + Date.now(),
    message,
    actor: currentUser?.fullName || "Demo user",
    date: new Date().toISOString()
  });
  schoolData.audit = schoolData.audit.slice(0, 30);
}

function navTo(view) {
  const allowed = (navByRole[currentUser?.role] || []).map(item => item[0]);
  if (!allowed.includes(view)) {
    showPortalMessage("That section is not available for this account.", true);
    return;
  }
  activeView = view;
  renderChrome();
  renderView();
  showPortalMessage("");
}

function renderDemoAccounts() {
  demoAccountButtons.replaceChildren();
  for (const account of DEMO_ACCOUNTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "demo-account-button";
    button.dataset.demoEmail = account.email;
    const name = document.createElement("strong");
    name.textContent = account.fullName;
    const email = document.createElement("small");
    email.textContent = account.email;
    const role = document.createElement("span");
    role.textContent = roleMeta[account.role]?.short || account.role;
    button.append(name, email, role);
    demoAccountButtons.append(button);
  }
}

function renderChrome() {
  const role = currentRole();
  document.querySelector("#user-name").textContent = currentUser?.fullName || "School user";
  document.querySelector("#user-role").textContent = role?.label || "Account";
  document.querySelector("#user-avatar").textContent = (currentUser?.fullName || "S").trim().charAt(0).toUpperCase();
  document.querySelector("#mode-badge").textContent = currentIsDemo ? "DEMO SANDBOX" : "LIVE AUTH · MODULES IN BUILD";
  document.querySelector("#demo-banner").hidden = !currentIsDemo;
  document.querySelector("#reset-demo-button").hidden = !currentIsDemo || currentUser?.role !== "admin";

  if (!currentIsDemo) {
    document.querySelector("#demo-banner").hidden = false;
    document.querySelector("#demo-banner").innerHTML = "<span aria-hidden='true'>ⓘ</span><span><strong>Live authentication only</strong> — data modules are still being connected. No demo records are shown in this mode.</span>";
  } else {
    document.querySelector("#demo-banner").innerHTML = "<span aria-hidden='true'>ⓘ</span><span><strong>Demo sandbox</strong> — records are fictional and saved only in this browser. No messages, payments or real uploads are sent.</span>";
  }

  const nav = navByRole[currentUser?.role] || [];
  portalNav.replaceChildren();
  for (const [view, label, iconText] of nav) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.nav = view;
    button.className = view === activeView ? "is-active" : "";
    button.setAttribute("aria-current", view === activeView ? "page" : "false");
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = iconText;
    const text = document.createElement("span");
    text.textContent = label;
    button.append(icon, text);
    portalNav.append(button);
  }
  const currentNav = nav.find(item => item[0] === activeView);
  document.querySelector("#view-title").textContent = currentNav?.[1] || "Overview";
}

function beginDemoSession(account) {
  currentUser = { ...account };
  currentIsDemo = true;
  schoolData = loadDemoData();
  sessionStorage.setItem("saraswati-erp-demo-email", account.email);
  activeView = "overview";
  loginLayout.hidden = true;
  publicFooter.hidden = true;
  portalRoot.hidden = false;
  renderChrome();
  renderView();
  showPortalMessage("Signed in to the fictional demo workspace.", false);
}

function showLivePlaceholder(profile, user) {
  currentUser = { ...profile, email: user.email, fullName: profile.full_name || "School user" };
  currentIsDemo = false;
  schoolData = null;
  activeView = "overview";
  loginLayout.hidden = true;
  publicFooter.hidden = true;
  portalRoot.hidden = false;
  renderChrome();
  renderView();
  showPortalMessage("Authenticated. School modules still need a configured schema and live data workflows.", false);
}

async function loadApprovedProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    await supabase.auth.signOut();
    throw new Error("Your school profile could not be loaded. Contact the school office.");
  }
  if (!data.is_active) {
    await supabase.auth.signOut();
    throw new Error("This account is inactive. Contact the school office.");
  }
  if (!roleMeta[data.role]) {
    await supabase.auth.signOut();
    throw new Error("Your account is waiting for school approval. Contact the school office.");
  }
  return data;
}

async function beginLiveSession(user) {
  try {
    const profile = await loadApprovedProfile(user);
    showLivePlaceholder(profile, user);
  } catch (error) {
    portalRoot.hidden = true;
    loginLayout.hidden = false;
    publicFooter.hidden = false;
    showLoginMessage(error.message || "Unable to load your school profile.");
  }
}

function moduleTitle(view) {
  return (navByRole[currentUser?.role] || []).find(item => item[0] === view)?.[1] || "School workspace";
}

function pageHeading(title, description, action = "") {
  return `<div class="page-heading"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div>${action}</div>`;
}

function statCard(label, value, detail, icon) {
  return `<article class="stat-card"><div class="stat-label"><span>${esc(label)}</span><span class="stat-icon" aria-hidden="true">${esc(icon || "•")}</span></div><strong class="stat-value">${esc(value)}</strong><div class="stat-foot">${esc(detail)}</div></article>`;
}

function statusPill(status) {
  const key = String(status || "").toLowerCase().replace(/[^a-z]+/g, "-");
  return `<span class="status-pill ${esc(key)}">${esc(status || "—")}</span>`;
}

function panel(title, body, subtitle = "") {
  return `<section class="panel"><div class="panel-head"><div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div></div>${body}</section>`;
}

function table(headers, rows, emptyText = "No records to show.") {
  const head = headers.map(value => `<th scope="col">${esc(value)}</th>`).join("");
  if (!rows.length) return `<div class="empty-state"><strong>Nothing here yet</strong>${esc(emptyText)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function noticeMarkup(notice) {
  return `<article class="notice-row"><div class="notice-row-head"><h3>${esc(notice.title)}</h3><time datetime="${esc(notice.date)}">${esc(formatDate(notice.date))}</time></div><p>${esc(notice.body)}</p><p class="cell-sub">Audience: ${esc(notice.audience || "All")}</p></article>`;
}

function quickActions(items) {
  return `<div class="quick-actions">${items.map(([view, icon, label]) => `<button type="button" class="quick-action" data-nav="${esc(view)}"><span aria-hidden="true">${esc(icon)}</span><span>${esc(label)}</span></button>`).join("")}</div>`;
}

function renderOverview() {
  if (!schoolData) {
    return pageHeading("Welcome to your workspace", "Your account is authenticated. The school database modules will be activated after schema setup and security testing.")
      + `<div class="content-grid"><div>${panel("Module rollout", '<div class="panel-body"><div class="role-card"><h3>Student and class records</h3><p>Planned next: academic sessions, classes, guardian links and staff assignments.</p><span>Phase 2</span></div><div class="role-card"><h3>Attendance</h3><p>Secure class attendance with correction history and authorized parent/student views.</p><span>Phase 3</span></div><div class="role-card"><h3>Exams and datesheets</h3><p>Teacher entry, review and controlled publication of results and schedules.</p><span>Phase 4</span></div></div>')}</div><div>${panel("Security reminder", '<div class="panel-body"><p class="muted">Do not add real student or financial records until the corresponding database tables, row-level security rules, backup and account-permission tests are completed.</p></div>')}</div></div>`;
  }

  const role = currentUser.role;
  const name = esc(currentUser.fullName || "there");
  const allStudents = schoolData.students;
  const todaysRows = schoolData.attendance.filter(row => row.date === todayISO());
  const attendanceRate = todaysRows.length ? Math.round(todaysRows.filter(row => row.status === "Present" || row.status === "Late").length / todaysRows.length * 100) + "%" : "—";
  const publishedMarks = schoolData.marks.filter(mark => mark.status === "Published");
  const dueAmount = schoolData.invoices.reduce((sum, invoice) => sum + totalDue(invoice), 0);
  const notices = [...schoolData.notices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  let stats = [];
  let recentTitle = "Recent marks";
  let recentRows = [];
  let quick = [];

  if (role === "admin") {
    stats = [
      ["Demo students", allStudents.length, "Class X-A roster", "♧"],
      ["Today's attendance", attendanceRate, todaysRows.length + " demo entries", "✓"],
      ["Fees outstanding", currency(dueAmount), "Across demo invoices", "₹"],
      ["Published marks", publishedMarks.length, "Student-subject results", "▤"]
    ];
    recentRows = publishedMarks.slice(-5).reverse().map(mark => `<tr><td><strong>${esc(studentName(mark.studentId))}</strong><small>${esc(mark.examTitle)}</small></td><td>${esc(mark.subject)}</td><td>${esc(mark.score)}/${esc(mark.maxMarks)}</td><td>${statusPill(mark.status)}</td></tr>`);
    quick = [["students", "♧", "Student records"], ["attendance", "✓", "Mark attendance"], ["marks", "▤", "Enter marks"], ["fees", "₹", "Manage fees"], ["datesheets", "▦", "Upload datesheet"]];
  } else if (role === "finance") {
    const paid = schoolData.invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? (invoice.status === "Paid" ? invoice.amount : 0)), 0);
    stats = [
      ["Invoices", schoolData.invoices.length, "Demo fee ledger", "▤"],
      ["Collected", currency(paid), "Fictional paid amounts", "₹"],
      ["Outstanding", currency(dueAmount), "Unpaid balance", "!"],
      ["Students", allStudents.length, "Available for fee billing", "♧"]
    ];
    recentTitle = "Fee ledger";
    recentRows = schoolData.invoices.slice(-5).reverse().map(invoice => `<tr><td><strong>${esc(invoice.id)}</strong><small>${esc(studentName(invoice.studentId))}</small></td><td>${esc(invoice.description)}</td><td>${esc(currency(invoice.amount))}</td><td>${statusPill(invoice.status)}</td></tr>`);
    quick = [["fees", "₹", "Create invoice"], ["students", "♧", "Find student"], ["notices", "▧", "School notices"]];
  } else if (role === "teacher") {
    stats = [
      ["Class roster", allStudents.length, "Assigned demo class X-A", "♧"],
      ["Today's attendance", attendanceRate, todaysRows.length + " demo entries", "✓"],
      ["Marks recorded", schoolData.marks.length, "Published and draft", "▤"],
      ["Datesheets", schoolData.datesheets.length, "Sample schedules", "▦"]
    ];
    recentTitle = "Recent marks entered";
    recentRows = schoolData.marks.slice(-5).reverse().map(mark => `<tr><td><strong>${esc(studentName(mark.studentId))}</strong></td><td>${esc(mark.subject)}</td><td>${esc(mark.score)}/${esc(mark.maxMarks)}</td><td>${statusPill(mark.status)}</td></tr>`);
    quick = [["attendance", "✓", "Mark attendance"], ["marks", "▤", "Enter marks"], ["datesheets", "▦", "Upload datesheet"], ["students", "♧", "Open class list"]];
  } else {
    const childList = role === "student" ? [studentById(currentUser.studentId)].filter(Boolean) : visibleStudents();
    const ids = new Set(childList.map(student => student.id));
    const childMarks = schoolData.marks.filter(mark => ids.has(mark.studentId) && mark.status === "Published");
    const childAttendance = schoolData.attendance.filter(row => ids.has(row.studentId));
    const pct = childAttendance.length ? Math.round(childAttendance.filter(row => row.status === "Present" || row.status === "Late").length / childAttendance.length * 100) + "%" : "—";
    const due = schoolData.invoices.filter(invoice => ids.has(invoice.studentId)).reduce((sum, invoice) => sum + totalDue(invoice), 0);
    const average = childMarks.length ? Math.round(childMarks.reduce((sum, mark) => sum + Number(mark.score) / Number(mark.maxMarks) * 100, 0) / childMarks.length) + "%" : "—";
    stats = [
      [role === "parent" ? "Linked children" : "Attendance", role === "parent" ? childList.length : pct, role === "parent" ? "School-linked demo profiles" : "Based on demo attendance", "✓"],
      ["Average marks", average, "Published assessments only", "▤"],
      ["Fees outstanding", currency(due), "Fictional fee balance", "₹"],
      ["Upcoming exams", schoolData.datesheets[0]?.schedule?.length || 0, "Entries in demo datesheet", "▦"]
    ];
    recentTitle = role === "parent" ? "Recent results for your children" : "Recent results";
    recentRows = childMarks.slice(-6).reverse().map(mark => `<tr><td><strong>${role === "parent" ? esc(studentName(mark.studentId)) : esc(mark.subject)}</strong><small>${role === "parent" ? esc(mark.subject) : esc(mark.examTitle)}</small></td>${role === "parent" ? `<td>${esc(mark.examTitle)}</td>` : ""}<td>${esc(mark.score)}/${esc(mark.maxMarks)}</td><td>${statusPill(mark.status)}</td></tr>`);
    quick = [["attendance", "✓", "My attendance"], ["marks", "▤", "View marks"], ["datesheets", "▦", "Datesheets"], ["fees", "₹", "Fee details"]];
  }

  const noticesBody = `<div class="notice-list">${notices.map(noticeMarkup).join("")}</div>`;
  const recentTable = table(role === "parent" ? ["Student / subject", "Exam", "Score", "Status"] : role === "student" ? ["Subject", "Score", "Status"] : role === "finance" ? ["Invoice / student", "Description", "Amount", "Status"] : ["Student / exam", "Subject", "Score", "Status"], recentRows, "Sample records will appear here.");
  const sub = role === "admin" ? "School-wide summary from the fictional demo dataset."
    : role === "finance" ? "A safe preview of the fee desk."
    : role === "teacher" ? "Your sample class and teaching tools."
    : role === "parent" ? "A family view restricted to the children linked to this demo account."
    : "Your sample attendance, published marks and school notices.";
  return pageHeading("Welcome, " + name, sub)
    + `<div class="stats-grid">${stats.map(item => statCard(...item)).join("")}</div>`
    + `<div class="content-grid"><div>${panel(recentTitle, recentTable)}${panel("School notices", noticesBody)}</div><div>${panel("Quick actions", '<div class="panel-body">' + quickActions(quick) + '</div>')}${panel("Demo environment", '<div class="panel-body"><p class="muted">Academic year: ' + esc(schoolData.academicYear) + '. All records are fictional and only persist in this browser. The demo is not connected to school systems or payment services.</p></div>')}</div></div>`;
}

function renderStudents() {
  if (!schoolData) return renderLiveModuleNotice("Student records");
  const rows = visibleStudents().map(student => `<tr><td><strong>${esc(student.fullName)}</strong><small>${esc(student.id)}</small></td><td>${esc(student.className)}</td><td>${esc(student.rollNo)}</td><td>${esc(student.guardianName)}</td><td>${attendancePercent(student.id)}%</td></tr>`);
  return pageHeading(currentUser.role === "teacher" ? "My class roster" : "Student records", currentUser.role === "finance" ? "Use this fictional roster to select students for fee billing." : "Four fictional students are loaded for testing.") +
    panel("Class X-A · Demo roster", table(["Student", "Class", "Roll no.", "Parent / guardian", "Attendance"], rows));
}

function renderAttendance() {
  if (!schoolData) return renderLiveModuleNotice("Attendance");
  const today = todayISO();
  if (currentUser.role === "student" || currentUser.role === "parent") {
    const rows = visibleAttendance().sort((a, b) => b.date.localeCompare(a.date)).map(row => `<tr>${currentUser.role === "parent" ? `<td><strong>${esc(studentName(row.studentId))}</strong></td>` : ""}<td>${esc(formatDate(row.date))}</td><td>${statusPill(row.status)}</td><td>${esc(row.markedBy || "Demo Class Teacher")}</td></tr>`);
    return pageHeading("Attendance", "Attendance is read-only for student and parent accounts.") + panel("Attendance history", table(currentUser.role === "parent" ? ["Student", "Date", "Status", "Marked by"] : ["Date", "Status", "Marked by"], rows));
  }
  const selectedDate = today;
  const rows = schoolData.students.filter(student => student.className === "X-A").map(student => {
    const existing = schoolData.attendance.find(row => row.studentId === student.id && row.date === selectedDate);
    const selectedStatus = existing?.status || "Present";
    return `<tr><td><strong>${esc(student.fullName)}</strong><small>Roll no. ${esc(student.rollNo)}</small></td><td><select name="status_${esc(student.id)}" aria-label="Attendance status for ${esc(student.fullName)}"><option ${selectedStatus === "Present" ? "selected" : ""}>Present</option><option ${selectedStatus === "Absent" ? "selected" : ""}>Absent</option><option ${selectedStatus === "Late" ? "selected" : ""}>Late</option><option ${selectedStatus === "Excused" ? "selected" : ""}>Excused</option><option value="Not marked">Not marked</option></select></td></tr>`;
  });
  return pageHeading("Take attendance", "Choose a date and set each student's status. Saving overwrites that date's demo entries.")
    + `<section class="panel"><form id="attendance-form" class="module-form"><div class="form-grid"><div class="field"><label for="attendance-date">Attendance date</label><input id="attendance-date" name="date" type="date" value="${esc(selectedDate)}" required></div><div class="field"><label for="attendance-class">Class / section</label><select id="attendance-class" name="className"><option>X-A</option></select></div></div><div class="table-wrap" style="margin-top:1rem"><table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><button class="primary-button" type="submit">Save class attendance</button></form></section>`
    + panel("How it behaves in the demo", '<div class="panel-body"><p class="muted">This is a browser-only simulation. In the live ERP, attendance changes will be limited to assigned classes and recorded with an audit trail.</p></div>');
}

function renderMarks() {
  if (!schoolData) return renderLiveModuleNotice("Exams and marks");
  const isReader = currentUser.role === "student" || currentUser.role === "parent";
  let formMarkup = "";
  if (!isReader) {
    const options = schoolData.students.map(student => `<option value="${esc(student.id)}">${esc(student.fullName)} · ${esc(student.className)}</option>`).join("");
    formMarkup = `<section class="panel"><form id="marks-form" class="module-form"><h3>Enter student marks</h3><p>Save a fictional score and choose whether it is visible to student accounts immediately.</p><div class="form-grid"><div class="field field-full"><label for="mark-student">Student</label><select id="mark-student" name="studentId" required>${options}</select></div><div class="field"><label for="mark-exam">Exam / assessment</label><input id="mark-exam" name="examTitle" value="Term 2 Assessment (Demo)" maxlength="80" required></div><div class="field"><label for="mark-subject">Subject</label><select id="mark-subject" name="subject" required>${["English", "Mathematics", "Science", "Social Science", "Hindi"].map(subject => `<option>${subject}</option>`).join("")}</select></div><div class="field"><label for="mark-score">Marks scored</label><input id="mark-score" name="score" type="number" min="0" max="100" step="1" value="85" required></div><div class="field"><label for="mark-max">Maximum marks</label><input id="mark-max" name="maxMarks" type="number" min="1" max="1000" step="1" value="100" required></div><div class="field field-full"><label for="mark-status">Publication</label><select id="mark-status" name="status"><option>Published</option><option>Draft</option></select></div></div><button class="primary-button" type="submit">Save marks</button><p class="mini-help">Students and parents can see only published results in this demo.</p></form></section>`;
  }
  const rows = visibleMarks().slice().sort((a, b) => b.examDate.localeCompare(a.examDate)).map(mark => {
    const action = !isReader ? `<button type="button" class="inline-button" data-action="toggle-mark" data-id="${esc(mark.id)}">${mark.status === "Published" ? "Unpublish" : "Publish"}</button>` : "";
    return `<tr>${currentUser.role !== "student" ? `<td><strong>${esc(studentName(mark.studentId))}</strong></td>` : ""}<td><strong>${esc(mark.subject)}</strong><small>${esc(mark.examTitle)}</small></td><td>${esc(mark.score)} / ${esc(mark.maxMarks)}</td><td>${statusPill(mark.status)}</td><td>${action || esc(formatDate(mark.examDate))}</td></tr>`;
  });
  const headers = currentUser.role === "student" ? ["Subject / exam", "Score", "Status", "Exam date"]
    : isReader ? ["Student", "Subject / exam", "Score", "Status", "Exam date"]
    : ["Student", "Subject / exam", "Score", "Status", "Action"];
  // Keep reader tables semantically aligned with their row cells.
  const alignedRows = currentUser.role === "student"
    ? visibleMarks().slice().sort((a, b) => b.examDate.localeCompare(a.examDate)).map(mark => `<tr><td><strong>${esc(mark.subject)}</strong><small>${esc(mark.examTitle)}</small></td><td>${esc(mark.score)} / ${esc(mark.maxMarks)}</td><td>${statusPill(mark.status)}</td><td>${esc(formatDate(mark.examDate))}</td></tr>`)
    : rows;
  return pageHeading(isReader ? (currentUser.role === "parent" ? "Children's marks and results" : "My marks") : "Exams & marks", isReader ? "Only school-published results are visible here." : "Enter sample scores, then publish or unpublish them for the demo students.")
    + (formMarkup ? `<div class="module-grid"><div>${panel("Results ledger", table(headers, alignedRows, "No results match this account."))}</div><div>${formMarkup}</div></div>` : panel("Published results", table(headers, alignedRows, "No published results are available for this account.")));
}

function renderDatesheets() {
  if (!schoolData) return renderLiveModuleNotice("Datesheets");
  const isEditor = currentUser.role === "admin" || currentUser.role === "teacher";
  const formMarkup = isEditor ? `<section class="panel"><form id="datesheet-form" class="module-form"><h3>Upload a datesheet</h3><p>Choose a small test file. The demo stores the attachment in this browser only (maximum 400 KB).</p><div class="form-grid"><div class="field field-full"><label for="sheet-title">Exam / datesheet title</label><input id="sheet-title" name="title" value="Practice Exam Datesheet (Demo)" maxlength="90" required></div><div class="field"><label for="sheet-class">Class / section</label><select id="sheet-class" name="className">${DEMO_CLASS_LIST.map(name => `<option ${name === "X-A" ? "selected" : ""}>${name}</option>`).join("")}</select></div><div class="field"><label for="sheet-start">Start date</label><input id="sheet-start" name="startDate" type="date" value="2026-11-02" required></div><div class="field"><label for="sheet-end">End date</label><input id="sheet-end" name="endDate" type="date" value="2026-11-06" required></div><div class="field field-full"><label for="sheet-file">Choose datesheet file</label><input id="sheet-file" name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.doc,.docx,.xlsx" required></div><div class="field field-full"><label for="sheet-schedule">Optional schedule lines</label><textarea id="sheet-schedule" name="schedule" rows="3" placeholder="One per line: 2026-11-02,English,09:00-12:00"></textarea></div></div><button class="primary-button" type="submit">Upload demo datesheet</button><p class="mini-help">Files are not sent to a server. Use fictional materials only. Students can download files from this browser after upload.</p></form></section>` : "";
  const sheetBlocks = schoolData.datesheets.slice().sort((a, b) => b.startDate.localeCompare(a.startDate)).map(sheet => {
    const schedule = (sheet.schedule || []).map(item => `<div class="schedule-item"><div class="schedule-date"><strong>${esc(new Date(item.date + "T12:00:00").getDate())}</strong><small>${esc(new Date(item.date + "T12:00:00").toLocaleDateString("en-IN", { month: "short" }))}</small></div><div class="schedule-info"><strong>${esc(item.subject)}</strong><small>${esc(formatDate(item.date))} · ${esc(item.time || "As per school notice")}</small></div></div>`).join("");
    return `<section class="panel"><div class="panel-head"><div><h3>${esc(sheet.title)}</h3><p>Class ${esc(sheet.className)} · ${esc(formatDate(sheet.startDate))} to ${esc(formatDate(sheet.endDate))}</p></div><button type="button" class="inline-button" data-download-sheet="${esc(sheet.id)}">Download ${sheet.fileData ? "file" : "schedule"}</button></div>${sheet.fileName ? `<div class="panel-body"><p class="muted">Attachment: <strong>${esc(sheet.fileName)}</strong> · Uploaded by ${esc(sheet.uploadedBy)} on ${esc(formatDate(sheet.uploadedAt))}</p></div>` : `<div class="panel-body"><p class="muted">Sample schedule fixture. No uploaded document is attached to this seeded record.</p></div>`}${schedule ? `<div class="schedule-list">${schedule}</div>` : ""}</section>`;
  }).join("");
  return pageHeading("Datesheets & exam calendar", "Review exam schedules and upload a fictional sample datesheet.") +
    (formMarkup ? `<div class="module-grid"><div>${sheetBlocks || '<div class="empty-state">No datesheets yet.</div>'}</div><div>${formMarkup}</div></div>` : (sheetBlocks || '<div class="empty-state">No published datesheets yet.</div>'));
}

function renderFees() {
  if (!schoolData) return renderLiveModuleNotice("Fees and payments");
  const canEdit = currentUser.role === "admin" || currentUser.role === "finance";
  const students = visibleStudents();
  const formMarkup = canEdit ? `<section class="panel"><form id="fee-form" class="module-form"><h3>Create fee invoice</h3><p>Add a fictional fee line for a demo student.</p><div class="form-grid"><div class="field field-full"><label for="fee-student">Student</label><select id="fee-student" name="studentId" required>${students.map(student => `<option value="${esc(student.id)}">${esc(student.fullName)} · ${esc(student.className)}</option>`).join("")}</select></div><div class="field field-full"><label for="fee-description">Fee description</label><input id="fee-description" name="description" maxlength="90" placeholder="e.g. Transport fee — demo" required></div><div class="field"><label for="fee-amount">Amount (₹)</label><input id="fee-amount" name="amount" type="number" min="1" max="1000000" step="1" value="1500" required></div><div class="field"><label for="fee-due">Due date</label><input id="fee-due" name="dueDate" type="date" value="2026-11-15" required></div></div><button class="primary-button" type="submit">Create invoice</button><p class="mini-help">This does not collect money or connect to a payment gateway.</p></form></section>` : "";
  const rows = visibleInvoices().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(invoice => {
    const action = canEdit && invoice.status !== "Paid" ? `<button type="button" class="inline-button" data-action="mark-paid" data-id="${esc(invoice.id)}">Mark paid</button>` : "—";
    return `<tr>${currentUser.role !== "student" ? `<td><strong>${esc(studentName(invoice.studentId))}</strong><small>${esc(invoice.id)}</small></td>` : `<td><strong>${esc(invoice.id)}</strong></td>`}<td>${esc(invoice.description)}</td><td>${esc(currency(invoice.amount))}<small>Due ${esc(formatDate(invoice.dueDate))}</small></td><td>${esc(currency(totalDue(invoice)))}</td><td>${statusPill(invoice.status)}</td>${canEdit ? `<td>${action}</td>` : ""}</tr>`;
  });
  const headers = [currentUser.role === "student" ? "Invoice" : "Student / invoice", "Description", "Amount", "Balance due", "Status", ...(canEdit ? ["Action"] : [])];
  const content = panel(canEdit ? "Fee ledger" : (currentUser.role === "parent" ? "Children's fee details" : "My fee details"), table(headers, rows, "No fee records linked to this account."));
  const totals = visibleInvoices().reduce((sum, invoice) => sum + totalDue(invoice), 0);
  return pageHeading("Fees & payments", canEdit ? "Create invoices and update demo payment statuses." : "Review fictional balances. No real payments can be made here.")
    + `<div class="stats-grid">${statCard("Invoices", visibleInvoices().length, "Visible fee records", "▤")}${statCard("Outstanding", currency(totals), "Demo unpaid balance", "₹")}${statCard("Payments", visibleInvoices().filter(item => item.status === "Paid").length, "Marked paid in the demo", "✓")}${statCard("Payment gateway", "Off", "No money is collected", "⊘")}</div>`
    + (formMarkup ? `<div class="module-grid"><div>${content}</div><div>${formMarkup}</div></div>` : content);
}

function renderNotices() {
  if (!schoolData) return renderLiveModuleNotice("Notices and circulars");
  const canCreate = currentUser.role === "admin";
  const formMarkup = canCreate ? `<section class="panel"><form id="notice-form" class="module-form"><h3>Publish demo notice</h3><div class="field"><label for="notice-title">Notice title</label><input id="notice-title" name="title" maxlength="90" required></div><div class="field"><label for="notice-audience">Audience</label><select id="notice-audience" name="audience"><option>All</option><option>Students</option><option>Parents</option><option>Teachers</option><option>Finance / families</option></select></div><div class="field"><label for="notice-body">Message</label><textarea id="notice-body" name="body" rows="4" maxlength="700" required></textarea></div><button class="primary-button" type="submit">Publish notice</button></form></section>` : "";
  const notices = schoolData.notices.slice().sort((a, b) => b.date.localeCompare(a.date));
  const list = `<section class="panel"><div class="notice-list">${notices.map(noticeMarkup).join("")}</div></section>`;
  return pageHeading("School notices & circulars", "Read approved announcements and post a sample notice in the principal demo.")
    + (formMarkup ? `<div class="module-grid"><div>${list}</div><div>${formMarkup}</div></div>` : list);
}

function renderAccounts() {
  if (!schoolData || currentUser.role !== "admin") return renderLiveModuleNotice("Demo accounts");
  const cards = DEMO_ACCOUNTS.map(account => `<article class="account-card"><strong>${esc(account.fullName)} · ${esc(roleMeta[account.role]?.short || account.role)}</strong><span>${esc(account.email)}</span><code>Password: ${esc(DEMO_PASSWORD)}</code></article>`).join("");
  return pageHeading("Demo account directory", "Use these fictional accounts to switch between roles and test the portal.")
    + `<div class="notice notice-warn">These credentials are public test credentials. Never reuse them for a real account. The demo role is client-side only and is not a security model.</div>`
    + `<section class="panel"><div class="account-list">${cards}</div></section>`
    + panel("Reset the sandbox", '<div class="panel-body"><p class="muted">Reset all demo records to the original sample dataset. This removes changes and uploaded demo attachments from this browser.</p><button class="secondary-button" data-action="reset-demo" type="button">Reset sample data</button></div>');
}

function renderLiveModuleNotice(title) {
  return pageHeading(title, "This module is not connected to the live database yet.")
    + `<section class="panel"><div class="empty-state"><strong>Module planned for the next phase</strong>Live authentication is separate from the demo dataset. No fictional marks, fees, attendance or datesheets are being shown in live mode.</div></section>`;
}

function renderView() {
  if (!currentUser) return;
  if (!currentIsDemo) {
    portalView.innerHTML = activeView === "overview" ? renderOverview() : renderLiveModuleNotice(moduleTitle(activeView));
    return;
  }
  const renderers = {
    overview: renderOverview,
    students: renderStudents,
    attendance: renderAttendance,
    marks: renderMarks,
    datesheets: renderDatesheets,
    fees: renderFees,
    notices: renderNotices,
    accounts: renderAccounts
  };
  portalView.innerHTML = (renderers[activeView] || renderOverview)();
}

function saveAttendance(form) {
  const formData = new FormData(form);
  const date = String(formData.get("date") || todayISO());
  for (const student of schoolData.students.filter(item => item.className === String(formData.get("className") || "X-A"))) {
    const status = String(formData.get("status_" + student.id) || "Not marked");
    const index = schoolData.attendance.findIndex(row => row.studentId === student.id && row.date === date);
    if (status === "Not marked") {
      if (index >= 0) schoolData.attendance.splice(index, 1);
      continue;
    }
    const record = { id: "ATT-" + date + "-" + student.id, studentId: student.id, date, status, markedBy: currentUser.fullName, updatedAt: new Date().toISOString() };
    if (index >= 0) schoolData.attendance[index] = record;
    else schoolData.attendance.push(record);
  }
  recordAudit("Saved attendance for X-A on " + date);
  persistDemoData();
  renderView();
  showPortalMessage("Attendance saved in this browser's demo dataset.", false);
}

function saveMarks(form) {
  const values = new FormData(form);
  const studentId = String(values.get("studentId") || "");
  const examTitle = String(values.get("examTitle") || "").trim();
  const subject = String(values.get("subject") || "");
  const score = Number(values.get("score"));
  const maxMarks = Number(values.get("maxMarks"));
  const status = String(values.get("status") || "Draft");
  if (!studentById(studentId) || !examTitle || !subject || !Number.isFinite(score) || !Number.isFinite(maxMarks) || maxMarks <= 0 || score < 0 || score > maxMarks) {
    showPortalMessage("Check the student, exam, and marks. Score must be between zero and maximum marks.", true);
    return;
  }
  schoolData.marks.push({
    id: "MRK-" + Date.now(),
    studentId, examTitle, subject, score, maxMarks, status,
    examDate: todayISO(), enteredBy: currentUser.fullName
  });
  recordAudit((status === "Published" ? "Published" : "Drafted") + " " + subject + " marks for " + studentName(studentId));
  persistDemoData();
  renderView();
  showPortalMessage(status === "Published" ? "Marks saved and published to this student's demo account." : "Marks saved as a draft; they are not visible to student accounts.", false);
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function saveDatesheet(form) {
  const values = new FormData(form);
  const file = values.get("attachment");
  if (!(file instanceof File) || !file.name) {
    showPortalMessage("Choose a datesheet file to upload.", true);
    return;
  }
  if (file.size > 400 * 1024) {
    showPortalMessage("For this browser-only demo, the attachment must be 400 KB or smaller.", true);
    return;
  }
  const startDate = String(values.get("startDate") || "");
  const endDate = String(values.get("endDate") || "");
  if (!startDate || !endDate || endDate < startDate) {
    showPortalMessage("Check the datesheet date range.", true);
    return;
  }

  let schedule = [];
  const lines = String(values.get("schedule") || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(",").map(part => part.trim());
    if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) && parts[0] >= startDate && parts[0] <= endDate) {
      schedule.push({ date: parts[0], subject: parts[1].slice(0, 70), time: (parts[2] || "As per uploaded datesheet").slice(0, 50) });
    }
  }

  try {
    const fileData = await fileToBase64(file);
    schoolData.datesheets.unshift({
      id: "DS-" + Date.now(),
      title: String(values.get("title") || file.name).trim().slice(0, 90),
      className: String(values.get("className") || "X-A"),
      startDate, endDate,
      uploadedBy: currentUser.fullName,
      uploadedAt: new Date().toISOString(),
      fileName: file.name.slice(0, 150),
      fileData,
      fileType: file.type || "application/octet-stream",
      schedule
    });
    recordAudit("Uploaded demo datesheet: " + file.name);
    persistDemoData();
    renderView();
    showPortalMessage("Demo datesheet added. It is saved only in this browser and is visible to the other demo accounts in this browser.", false);
  } catch (error) {
    console.error(error);
    showPortalMessage("Could not store this demo file in browser storage. Try a smaller file or reset the demo.", true);
  }
}

function saveFee(form) {
  const values = new FormData(form);
  const studentId = String(values.get("studentId") || "");
  const description = String(values.get("description") || "").trim();
  const amount = Number(values.get("amount"));
  const dueDate = String(values.get("dueDate") || "");
  if (!studentById(studentId) || !description || !Number.isFinite(amount) || amount <= 0 || amount > 1000000 || !dueDate) {
    showPortalMessage("Enter a valid student, fee description, amount and due date.", true);
    return;
  }
  const id = "INV-" + String(Date.now()).slice(-7);
  schoolData.invoices.unshift({ id, studentId, description: description.slice(0, 90), amount, dueDate, status: "Due", createdAt: new Date().toISOString() });
  recordAudit("Created demo invoice " + id + " for " + studentName(studentId));
  persistDemoData();
  renderView();
  showPortalMessage("Demo fee invoice created. This does not collect or request a real payment.", false);
}

function saveNotice(form) {
  const values = new FormData(form);
  const title = String(values.get("title") || "").trim();
  const body = String(values.get("body") || "").trim();
  const audience = String(values.get("audience") || "All");
  if (!title || !body) {
    showPortalMessage("Enter both a title and a notice message.", true);
    return;
  }
  schoolData.notices.unshift({ id: "NTC-" + Date.now(), title: title.slice(0, 90), audience, body: body.slice(0, 700), date: todayISO() });
  recordAudit("Published demo notice: " + title);
  persistDemoData();
  renderView();
  showPortalMessage("Demo notice published to the sandbox.", false);
}

function downloadDatesheet(id) {
  const sheet = schoolData?.datesheets.find(item => item.id === id);
  if (!sheet) return;
  let blob;
  let filename;
  if (sheet.fileData && sheet.fileName) {
    const binary = atob(sheet.fileData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: sheet.fileType || "application/octet-stream" });
    filename = sheet.fileName.replace(/[\\/:*?"<>|]/g, "_");
  } else {
    const rows = [["Date", "Subject", "Time"], ...(sheet.schedule || []).map(item => [item.date, item.subject, item.time || ""])];
    const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    filename = (sheet.title || "sample-datesheet").replace(/[^a-z0-9-_]+/gi, "-") + ".csv";
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "datesheet-demo-file";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function resetDemoData() {
  if (!currentIsDemo || currentUser?.role !== "admin") return;
  if (!window.confirm("Reset all fictional demo records and demo uploads in this browser? This cannot be undone.")) return;
  localStorage.removeItem(DEMO_STORAGE_KEY);
  schoolData = createInitialDemoData();
  persistDemoData();
  activeView = "overview";
  renderChrome();
  renderView();
  showPortalMessage("Demo data has been reset to the original sample records.", false);
}

portalRoot.addEventListener("click", async event => {
  const navButton = event.target.closest("[data-nav]");
  if (navButton) {
    navTo(navButton.dataset.nav);
    return;
  }
  const demoButton = event.target.closest("[data-action]");
  if (demoButton) {
    const action = demoButton.dataset.action;
    const id = demoButton.dataset.id;
    if (action === "mark-paid" && currentIsDemo && ["admin", "finance"].includes(currentUser.role)) {
      const invoice = schoolData.invoices.find(item => item.id === id);
      if (!invoice) return;
      invoice.status = "Paid";
      invoice.paidAmount = invoice.amount;
      recordAudit("Marked demo invoice " + invoice.id + " as paid");
      persistDemoData();
      renderView();
      showPortalMessage("Invoice marked paid in the demo only. No payment was processed.", false);
    } else if (action === "toggle-mark" && currentIsDemo && ["admin", "teacher"].includes(currentUser.role)) {
      const mark = schoolData.marks.find(item => item.id === id);
      if (!mark) return;
      mark.status = mark.status === "Published" ? "Draft" : "Published";
      recordAudit((mark.status === "Published" ? "Published" : "Unpublished") + " demo marks for " + studentName(mark.studentId));
      persistDemoData();
      renderView();
      showPortalMessage(mark.status === "Published" ? "Result published to the relevant demo student account." : "Result unpublished and hidden from student/parent accounts.", false);
    } else if (action === "reset-demo") {
      await resetDemoData();
    }
    return;
  }
  const downloadButton = event.target.closest("[data-download-sheet]");
  if (downloadButton && currentIsDemo) {
    downloadDatesheet(downloadButton.dataset.downloadSheet);
  }
});

portalRoot.addEventListener("submit", async event => {
  const form = event.target;
  if (!form.matches("form")) return;
  event.preventDefault();
  if (!currentIsDemo) {
    showPortalMessage("Live data workflows have not been enabled yet.", true);
    return;
  }
  if (form.id === "attendance-form" && ["admin", "teacher"].includes(currentUser.role)) saveAttendance(form);
  else if (form.id === "marks-form" && ["admin", "teacher"].includes(currentUser.role)) saveMarks(form);
  else if (form.id === "datesheet-form" && ["admin", "teacher"].includes(currentUser.role)) await saveDatesheet(form);
  else if (form.id === "fee-form" && ["admin", "finance"].includes(currentUser.role)) saveFee(form);
  else if (form.id === "notice-form" && currentUser.role === "admin") saveNotice(form);
});

document.querySelector("#reset-demo-button").addEventListener("click", resetDemoData);

document.querySelector("#logout-button").addEventListener("click", async () => {
  if (currentIsDemo) {
    sessionStorage.removeItem("saraswati-erp-demo-email");
  } else if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showPortalMessage("We could not sign you out. Please try again.", true);
      return;
    }
  }
  currentUser = null;
  schoolData = null;
  portalRoot.hidden = true;
  loginLayout.hidden = false;
  publicFooter.hidden = false;
  loginForm.reset();
  showLoginMessage("You have signed out.", false);
});

demoAccountButtons.addEventListener("click", event => {
  const button = event.target.closest("[data-demo-email]");
  if (!button) return;
  const account = DEMO_ACCOUNTS.find(item => item.email === button.dataset.demoEmail);
  if (!account) return;
  document.querySelector("#email").value = account.email;
  document.querySelector("#password").value = DEMO_PASSWORD;
  document.querySelector("#password").focus();
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = "Signing in…";
  showLoginMessage("");

  const values = new FormData(loginForm);
  const email = String(values.get("email") || "").trim().toLowerCase();
  const password = String(values.get("password") || "");

  if (DEMO_MODE) {
    const account = DEMO_ACCOUNTS.find(item => item.email.toLowerCase() === email && item.password === password);
    if (!account) {
      showLoginMessage("Demo sign-in failed. Choose an account from the list and use the shared demo password.");
      loginButton.disabled = false;
      loginButton.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
      return;
    }
    beginDemoSession(account);
  } else if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      showLoginMessage("Sign-in failed. Check your school-issued credentials and try again.");
      loginButton.disabled = false;
      loginButton.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
      return;
    }
    await beginLiveSession(data.user);
  }
  loginButton.disabled = false;
  loginButton.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
});

document.querySelectorAll("[data-year]").forEach(element => {
  element.textContent = String(new Date().getFullYear());
});

if (DEMO_MODE) {
  demoNotice.hidden = false;
  setupNotice.hidden = false;
  demoAccountList.hidden = false;
  renderDemoAccounts();
  loginButton.disabled = false;
  showLoginMessage("Demo accounts are ready. Choose a role to start.", false);
  const lastDemoEmail = sessionStorage.getItem("saraswati-erp-demo-email");
  const savedAccount = DEMO_ACCOUNTS.find(account => account.email === lastDemoEmail);
  if (savedAccount) beginDemoSession(savedAccount);
} else {
  demoNotice.hidden = true;
  setupNotice.hidden = false;
  setupNotice.textContent = "Live authentication is configured. Demo accounts are disabled unless you add ?demo=1 to the URL for the fictional sandbox.";
  demoAccountList.hidden = true;
  loginButton.disabled = false;
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      showLoginMessage("Unable to check your session. Please refresh and try again.");
      return;
    }
    if (data.session?.user) beginLiveSession(data.session.user);
  });
}
