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
    ["overview", "Command center", "⌂"], ["students", "Students", "♧"], ["attendance", "Attendance", "✓"],
    ["marks", "Exams & marks", "▤"], ["datesheets", "Datesheets", "▦"], ["fees", "Fees & receipts", "₹"],
    ["notices", "Notices", "▧"], ["approvals", "Approvals", "✓"], ["timetable", "Timetable & calendar", "▦"],
    ["homework", "Homework centre", "✎"], ["communications", "Messages", "✉"], ["notifications", "Notifications", "•"],
    ["reports", "Reports & analytics", "▥"], ["admissions", "Admissions", "＋"], ["expenses", "Expenses", "−"],
    ["operations", "School operations", "⚙"], ["requests", "Requests", "☏"], ["accounts", "Demo accounts", "♙"]
  ],
  finance: [
    ["overview", "Finance desk", "⌂"], ["students", "Students", "♧"], ["fees", "Fees & receipts", "₹"],
    ["expenses", "Expenses & closing", "−"], ["reports", "Reports & exports", "▥"], ["communications", "Messages", "✉"],
    ["notifications", "Notifications", "•"], ["notices", "Notices", "▧"]
  ],
  teacher: [
    ["overview", "My teaching day", "⌂"], ["students", "My class", "♧"], ["attendance", "Attendance", "✓"],
    ["marks", "Exams & marks", "▤"], ["datesheets", "Datesheets", "▦"], ["timetable", "Timetable", "▦"],
    ["homework", "Homework centre", "✎"], ["communications", "Messages", "✉"], ["requests", "Leave & requests", "☏"],
    ["notifications", "Notifications", "•"], ["reports", "Class reports", "▥"], ["operations", "School operations", "⚙"], ["notices", "Notices", "▧"]
  ],
  parent: [
    ["overview", "Family dashboard", "⌂"], ["attendance", "Attendance", "✓"], ["marks", "Marks & results", "▤"],
    ["datesheets", "Datesheets", "▦"], ["fees", "Fees & receipts", "₹"], ["timetable", "Timetable & calendar", "▦"],
    ["homework", "Homework & resources", "✎"], ["communications", "Contact school", "✉"], ["requests", "Requests", "☏"],
    ["notifications", "Notifications", "•"], ["notices", "Notices", "▧"]
  ],
  student: [
    ["overview", "My school day", "⌂"], ["attendance", "My attendance", "✓"], ["marks", "My results", "▤"],
    ["datesheets", "Datesheets", "▦"], ["fees", "My fees & receipts", "₹"], ["timetable", "My timetable", "▦"],
    ["homework", "Homework & resources", "✎"], ["communications", "Message a teacher", "✉"], ["requests", "Ask the school", "☏"],
    ["notifications", "Notifications", "•"], ["notices", "Notices", "▧"]
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
    accounts: renderAccounts,
    approvals: renderApprovals,
    timetable: renderTimetable,
    homework: renderHomework,
    communications: renderCommunications,
    notifications: renderNotifications,
    requests: renderRequests,
    reports: renderReports,
    admissions: renderAdmissions,
    expenses: renderExpenses,
    operations: renderOperations
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

  function extras(data = schoolData) {
    if (!data) return;
    for (const key of ["payments","notifications","approvals","timetable","homework","submissions","messages","requests","schoolEvents","admissions","expenses","libraryBooks","libraryLoans","inventory","inventoryMovements","transportRoutes","attendanceHistory","resources"]) {
      if (!Array.isArray(data[key])) data[key] = [];
    }
  }

  function notify(title, body, audience = "All", studentId = null, targetEmail = null) {
    extras();
    schoolData.notifications.unshift({id:"NOT-"+Date.now()+"-"+Math.random().toString(36).slice(2,5),title,body,audience,studentId,targetEmail,date:new Date().toISOString(),readBy:[]});
    schoolData.notifications = schoolData.notifications.slice(0,100);
  }

  function askApproval(type, title, details, targetType = "generic", targetId = "", payload = null) {
    extras();
    const approval = {id:"APR-"+Date.now(),type,title,details,targetType,targetId,payload,status:"Pending",requestedBy:currentUser.fullName,requestedAt:new Date().toISOString(),reviewedBy:"",reviewedAt:""};
    schoolData.approvals.unshift(approval);
    notify("Approval required: "+title, details, "admin");
    return approval;
  }

  function notifyStudent(studentId, title, body) {
    const account = DEMO_ACCOUNTS.find(a => a.role === "student" && a.studentId === studentId);
    notify(title,body,"student",studentId,account?.email || null);
    notify(title,body,"parent",studentId);
  }

  function unreadCount() {
    extras();
    return schoolData.notifications.filter(n => {
      const visible = n.audience === "All" || n.audience === currentUser.role || n.targetEmail === currentUser.email || (n.studentId && visibleStudentIds().includes(n.studentId));
      return visible && !(n.readBy || []).includes(currentUser.email);
    }).length;
  }

  function roleNotices() {
    const allowed = {admin:["All","Principal"],finance:["All","Finance","Finance / families","Parents"],teacher:["All","Teachers"],parent:["All","Parents","Students","Finance / families"],student:["All","Students"]};
    return (schoolData.notices || []).filter(n => (allowed[currentUser.role] || ["All"]).includes(n.audience));
  }

  function downloadData(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content],{type}));
    const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvValue(value) { return '"' + String(value ?? "").replace(/"/g,'""') + '"'; }

  function downloadReceipt(paymentId) {
    const p = schoolData.payments.find(x => x.id === paymentId); if (!p) return;
    const invoice = schoolData.invoices.find(x => x.id === p.invoiceId);
    const html = `<!doctype html><html><meta charset="utf-8"><title>Demo receipt</title><body style="font:16px Arial;max-width:660px;margin:40px auto;color:#173f35"><h1>Saraswati Senior Secondary School</h1><p><b>DEMO RECEIPT — NOT VALID FOR ACTUAL PAYMENT</b></p><hr><p>Receipt: ${esc(p.receiptNo)}</p><p>Date: ${esc(formatDate(p.date))}</p><p>Student: ${esc(studentName(p.studentId))}</p><p>Invoice: ${esc(p.invoiceId)}</p><p>Description: ${esc(invoice?.description || "School fee")}</p><h2>Recorded amount: ${esc(currency(p.amount))}</h2><p>Method: ${esc(p.method || "Demo entry")}</p><p>Recorded by: ${esc(p.collectedBy || "Demo Finance")}</p><hr><p>No actual money was processed. This file is a fictional demo receipt.</p></body></html>`;
    downloadData(html,"text/html;charset=utf-8",p.receiptNo+"-DEMO.html");
  }

  function renderApprovals() {
    if (!schoolData || currentUser.role !== "admin") return renderLiveModuleNotice("Approvals");
    extras();
    const pending = schoolData.approvals.filter(a => a.status === "Pending");
    const queue = pending.map(a => `<article class="approval-card"><div class="approval-card-top"><span class="eyebrow">${esc(a.type)}</span>${statusPill(a.status)}</div><h3>${esc(a.title)}</h3><p>${esc(a.details)}</p><small>Requested by ${esc(a.requestedBy)} · ${esc(formatDate(a.requestedAt))}</small><div class="approval-actions"><button type="button" class="primary-button compact" data-action="resolve-approval" data-outcome="Approved" data-id="${esc(a.id)}">Approve</button><button type="button" class="secondary-button" data-action="resolve-approval" data-outcome="Rejected" data-id="${esc(a.id)}">Reject</button></div></article>`).join("");
    const history = schoolData.approvals.filter(a => a.status !== "Pending").slice(0,15).map(a => `<tr><td><strong>${esc(a.title)}</strong><small>${esc(a.type)}</small></td><td>${esc(a.requestedBy)}</td><td>${statusPill(a.status)}</td><td>${esc(a.reviewedBy || "—")}</td><td>${esc(formatDate(a.reviewedAt || a.requestedAt))}</td></tr>`);
    return pageHeading("Approvals & publishing","Review results, datesheets, assignments, expenses and school requests before they take effect.")
      + `<div class="stats-grid">${statCard("Pending approvals",pending.length,"Awaiting a decision","✓")}${statCard("Marks to review",schoolData.marks.filter(m=>m.status==="Pending approval").length,"Hidden from students","▤")}${statCard("Datesheets to review",schoolData.datesheets.filter(s=>s.status==="Pending approval").length,"Not yet published","▦")}${statCard("Expenses to review",schoolData.expenses.filter(e=>e.status==="Pending approval").length,"Finance requests","₹")}</div>`
      + `<div class="approval-grid">${queue || '<div class="empty-state"><strong>Approval queue is clear</strong>New submissions will appear here.</div>'}</div>`
      + panel("Decision history",table(["Item","Requested by","Decision","Reviewed by","Date"],history,"No decisions recorded yet."));
  }

  function renderTimetable() {
    if (!schoolData) return renderLiveModuleNotice("Timetable & calendar");
    extras();
    const role=currentUser.role;
    const classes = role==="student" ? [studentById(currentUser.studentId)?.className || "X-A"] : role==="parent" ? [...new Set(visibleStudents().map(s=>s.className))] : null;
    const rows=schoolData.timetable.filter(t=>!classes||classes.includes(t.className)).sort((a,b)=>["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(a.day)-["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(b.day)).map(t=>`<tr><td>${esc(t.day)}</td><td>${esc(t.time)}</td><td>${esc(t.className)}</td><td><strong>${esc(t.subject)}</strong></td><td>${esc(t.teacher)}</td><td>${esc(t.room||"—")}</td></tr>`);
    const editor=["admin","teacher"].includes(role)?`<section class="panel"><form id="timetable-form" class="module-form"><h3>Propose timetable change</h3><p>Teacher changes require principal approval.</p><div class="form-grid"><div class="field"><label for="tt-class">Class</label><select id="tt-class" name="className">${DEMO_CLASS_LIST.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div><div class="field"><label for="tt-day">Day</label><select id="tt-day" name="day">${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(d=>`<option>${d}</option>`).join("")}</select></div><div class="field"><label for="tt-period">Period</label><select id="tt-period" name="period">${["1","2","3","4","5","6"].map(p=>`<option>${p}</option>`).join("")}</select></div><div class="field"><label for="tt-time">Time</label><input id="tt-time" name="time" value="09:00–09:45" required></div><div class="field"><label for="tt-subject">Subject</label><input id="tt-subject" name="subject" required maxlength="70"></div><div class="field"><label for="tt-teacher">Teacher</label><input id="tt-teacher" name="teacher" value="${esc(currentUser.fullName)}" required maxlength="70"></div><div class="field"><label for="tt-room">Room</label><input id="tt-room" name="room" value="Room 10"></div></div><button class="primary-button" type="submit">Submit change</button></form></section>`:"";
    const events=schoolData.schoolEvents.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<div class="event-row"><div class="event-date"><strong>${esc(new Date(e.date+"T12:00:00").getDate())}</strong><small>${esc(new Date(e.date+"T12:00:00").toLocaleDateString("en-IN",{month:"short"}))}</small></div><div><strong>${esc(e.title)}</strong><small>${esc(e.kind||"School event")} · ${esc(formatDate(e.date))}</small></div></div>`).join("");
    const eventForm=role==="admin"?`<form id="calendar-form" class="module-form"><h3>Add calendar event</h3><div class="field"><label for="event-title">Event</label><input id="event-title" name="title" required></div><div class="field"><label for="event-date">Date</label><input id="event-date" name="date" type="date" required></div><div class="field"><label for="event-kind">Category</label><select id="event-kind" name="kind"><option>School event</option><option>Holiday</option><option>Exam</option><option>Parent meeting</option></select></div><button class="primary-button" type="submit">Add event</button></form>`:"";
    return pageHeading("Timetable & school calendar","Weekly class schedule, school events and approved timetable changes.")
      + `<div class="module-grid"><div>${panel("Weekly timetable",table(["Day","Time","Class","Subject","Teacher","Room"],rows,"No schedule rows available."))}${panel("Upcoming dates",`<div class="event-list">${events||'<div class="empty-state">No events have been added.</div>'}</div>`)}</div><div>${editor}${eventForm}</div></div>`;
  }

  function renderHomework() {
    if (!schoolData) return renderLiveModuleNotice("Homework");
    extras();
    const role=currentUser.role;
    const studentClass=studentById(currentUser.studentId)?.className || "X-A";
    const classes=role==="parent"?[...new Set(visibleStudents().map(s=>s.className))]:[studentClass];
    const tasks=schoolData.homework.filter(h=>(!["parent","student"].includes(role)||h.status==="Published")&&(!["parent","student"].includes(role)||classes.includes(h.className))).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const editor=["admin","teacher"].includes(role)?`<section class="panel"><form id="homework-form" class="module-form"><h3>Create assignment</h3><p>Teacher-created assignments are held for principal approval.</p><div class="field"><label for="hw-title">Title</label><input id="hw-title" name="title" required maxlength="100"></div><div class="form-grid"><div class="field"><label for="hw-class">Class</label><select id="hw-class" name="className">${DEMO_CLASS_LIST.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div><div class="field"><label for="hw-subject">Subject</label><select id="hw-subject" name="subject">${["English","Mathematics","Science","Social Science","Hindi"].map(s=>`<option>${s}</option>`).join("")}</select></div><div class="field"><label for="hw-due">Due date</label><input id="hw-due" name="dueDate" type="date" value="2026-10-30" required></div><div class="field field-full"><label for="hw-description">Instructions</label><textarea id="hw-description" name="description" required maxlength="800" rows="3"></textarea></div></div><button class="primary-button" type="submit">Submit assignment</button></form></section>`:"";
    const cards=tasks.map(h=>{
      const submission=schoolData.submissions.find(s=>s.homeworkId===h.id&&s.studentId===currentUser.studentId);
      const allSubmissions=schoolData.submissions.filter(s=>s.homeworkId===h.id);
      let area="";
      if(role==="student") area=submission?`<div class="submission-meta">${statusPill(submission.status)}<p>${esc(submission.text)}</p>${submission.feedback?`<small>Teacher feedback: ${esc(submission.feedback)}</small>`:""}</div>`:`<form class="module-form homework-submit-form" data-homework-id="${esc(h.id)}"><div class="field"><label for="sub-${esc(h.id)}">Your answer</label><textarea id="sub-${esc(h.id)}" name="submission" required maxlength="1200" rows="2"></textarea></div><button class="secondary-button" type="submit">Submit work</button></form>`;
      else if(["teacher","admin"].includes(role)) area=`<div class="submission-meta"><strong>${allSubmissions.length} submission(s)</strong>${allSubmissions.map(s=>`<div class="submission-row"><span><strong>${esc(studentName(s.studentId))}</strong><small>${esc(s.text)}</small></span>${s.status==="Submitted"?`<button class="inline-button" data-action="review-submission" data-id="${esc(s.id)}" type="button">Review</button>`:statusPill(s.status)}</div>`).join("")||'<p class="muted">No work submitted yet.</p>'}</div>`;
      else area=`<div class="submission-meta">${allSubmissions.filter(s=>visibleStudentIds().includes(s.studentId)).length} submission(s) from linked children.</div>`;
      return `<article class="homework-card"><div class="homework-card-head"><div><span class="eyebrow">${esc(h.subject)} · ${esc(h.className)}</span><h3>${esc(h.title)}</h3></div>${statusPill(h.status)}</div><p>${esc(h.description)}</p><div class="homework-meta"><span>Due ${esc(formatDate(h.dueDate))}</span><span>By ${esc(h.createdBy||"Demo teacher")}</span></div>${area}</article>`;
    }).join("");
    const resources=(schoolData.resources||[]).map(r=>`<tr><td><strong>${esc(r.title)}</strong><small>${esc(r.subject)}</small></td><td>${esc(r.description)}</td><td><button class="inline-button" type="button" data-action="download-resource" data-id="${esc(r.id)}">Download note</button></td></tr>`);
    return pageHeading("Homework & learning centre","Assignments, deadlines, submissions and reusable study notes.")
      + `<div class="module-grid"><div>${cards||'<div class="empty-state">No assignments have been published for this class.</div>'}${panel("Study resources",table(["Resource","Description","Action"],resources,"No sample resources."))}</div><div>${editor}${panel("How it works",'<div class="panel-body"><p class="muted">Student submissions stay in the sample browser dataset. Teachers can review them and add feedback. No actual file is uploaded to a server.</p></div>')}</div></div>`;
  }

  function renderCommunications() {
    if(!schoolData)return renderLiveModuleNotice("Messages");
    extras();
    const role=currentUser.role;
    const messages=schoolData.messages.filter(m=>(m.recipientRole==="All"||m.recipientRole===role||m.senderEmail===currentUser.email)&&(!m.studentId||visibleStudentIds().includes(m.studentId)||role==="admin")).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const recipients=role==="admin"?[["All","All school users"],["teacher","Teachers"],["parent","Parents"],["student","Students"],["finance","Finance"]]:role==="finance"?[["admin","Principal"],["parent","Parents"]]:role==="teacher"?[["admin","Principal"],["parent","Parents"],["student","Students"]]:role==="parent"?[["teacher","Class teacher"],["admin","Principal"]]:[["teacher","Class teacher"],["admin","Principal"]];
    const options=recipients.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
    const studentOptions=["admin","finance","teacher","parent"].includes(role)?`<div class="field"><label for="message-student">Linked student (optional)</label><select id="message-student" name="studentId"><option value="">None</option>${visibleStudents().map(s=>`<option value="${esc(s.id)}">${esc(s.fullName)}</option>`).join("")}</select></div>`:"";
    const form=`<section class="panel"><form id="communication-form" class="module-form"><h3>Compose message</h3><p>Demo messages do not leave this browser.</p><div class="field"><label for="message-to">Recipient</label><select id="message-to" name="recipientRole">${options}</select></div>${studentOptions}<div class="field"><label for="message-subject">Subject</label><input id="message-subject" name="subject" required maxlength="100"></div><div class="field"><label for="message-body">Message</label><textarea id="message-body" name="body" required rows="4" maxlength="1200"></textarea></div><button class="primary-button" type="submit">Send demo message</button></form></section>`;
    const rows=messages.map(m=>`<article class="message-card"><div class="message-card-head"><div><strong>${esc(m.subject)}</strong><small>${esc(m.senderName)} · ${esc(roleMeta[m.senderRole]?.short||m.senderRole)}</small></div><time>${esc(formatDate(m.date))}</time></div><p>${esc(m.body)}</p><small>To: ${esc(m.recipientRole==="All"?"All users":roleMeta[m.recipientRole]?.short||m.recipientRole)}${m.studentId?" · "+esc(studentName(m.studentId)):""}</small></article>`).join("");
    return pageHeading("Messages & communication","A role-aware inbox for parent questions and school updates.")
      + `<div class="module-grid"><div>${panel("Inbox & sent",`<div class="message-list">${rows||'<div class="empty-state">No messages for this account yet.</div>'}</div>`)}</div><div>${form}${panel("Demo boundary",'<div class="panel-body"><p class="muted">No SMS, email or WhatsApp is actually sent. Live messaging needs secure recipient checks and approved provider integration.</p></div>')}</div></div>`;
  }

  function renderNotifications() {
    if(!schoolData)return renderLiveModuleNotice("Notifications");
    extras();
    const rows=schoolData.notifications.filter(n=>n.audience==="All"||n.audience===currentUser.role||n.targetEmail===currentUser.email||(n.studentId&&visibleStudentIds().includes(n.studentId))).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>{
      const read=(n.readBy||[]).includes(currentUser.email);
      return `<article class="notification-card ${read?"is-read":""}"><div><div class="notification-title-row"><strong>${esc(n.title)}</strong>${statusPill(read?"Read":"Unread")}</div><p>${esc(n.body)}</p><small>${esc(formatDate(n.date))}</small></div>${read?"":`<button class="inline-button" data-action="read-notification" data-id="${esc(n.id)}" type="button">Mark read</button>`}</article>`;
    }).join("");
    return pageHeading("Notification centre", "Attendance alerts, new messages, due dates and approval updates.")
      + `<div class="page-tools"><span>${unreadCount()} unread alert(s)</span><button class="secondary-button" type="button" data-action="read-all-notifications">Mark all read</button></div>`
      + panel("Recent notifications",`<div class="notification-list">${rows||'<div class="empty-state">No notifications for this account.</div>'}</div>`);
  }

  function renderRequests() {
    if(!schoolData)return renderLiveModuleNotice("Requests");
    extras();
    const role=currentUser.role;
    const rows=schoolData.requests.filter(r=>role==="admin"||(role==="teacher"&&(r.studentId?studentById(r.studentId)?.className==="X-A":r.requestedRole==="teacher"))||(role==="parent"&&((r.studentId&&visibleStudentIds().includes(r.studentId))||r.requestedByEmail===currentUser.email))||(role==="student"&&(r.studentId===currentUser.studentId||r.requestedByEmail===currentUser.email))).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(r=>`<article class="request-card"><div class="request-card-head"><div><span class="eyebrow">${esc(r.type)}</span><h3>${esc(r.title||r.type)}</h3></div>${statusPill(r.status)}</div><p>${esc(r.details)}</p><small>${r.studentId?esc(studentName(r.studentId))+" · ":""}${esc(r.requestedBy)} · ${esc(formatDate(r.date))}</small>${["admin","teacher"].includes(role)&&r.status==="Pending"?`<div class="approval-actions"><button class="inline-button" data-action="resolve-request" data-outcome="Approved" data-id="${esc(r.id)}" type="button">Approve / resolve</button><button class="inline-button danger" data-action="resolve-request" data-outcome="Rejected" data-id="${esc(r.id)}" type="button">Decline</button></div>`:""}</article>`).join("");
    let form="";
    if(["parent","student"].includes(role)){
      const childOptions=role==="parent"?visibleStudents().map(s=>`<option value="${esc(s.id)}">${esc(s.fullName)}</option>`).join(""):`<option value="${esc(currentUser.studentId)}">${esc(studentName(currentUser.studentId))}</option>`;
      form=`<section class="panel"><form id="request-form" class="module-form"><h3>Ask the school</h3><div class="field"><label for="req-type">Request type</label><select name="requestType" id="req-type"><option>Absence explanation</option><option>Attendance correction</option><option>Record correction</option><option>Parent-teacher meeting</option><option>Certificate request</option></select></div><div class="field"><label for="req-student">Student</label><select name="studentId" id="req-student">${childOptions}</select></div><div class="field"><label for="req-details">Details</label><textarea name="details" id="req-details" rows="4" required maxlength="600"></textarea></div><button class="primary-button" type="submit">Send request</button></form></section>`;
    } else if(role==="teacher"){
      form=`<section class="panel"><form id="request-form" class="module-form"><h3>Staff leave / support request</h3><div class="field"><label for="req-type">Request type</label><select id="req-type" name="requestType"><option>Staff leave request</option><option>Substitute teacher request</option><option>Teaching resource request</option></select></div><div class="field"><label for="req-date">Relevant date</label><input id="req-date" name="date" type="date" required></div><div class="field"><label for="req-details">Details</label><textarea id="req-details" name="details" rows="3" required maxlength="600"></textarea></div><button class="primary-button" type="submit">Submit request</button></form></section>`;
    }
    return pageHeading("Requests & follow-up","Track absence explanations, corrections, meetings and staff support.")
      + `<div class="module-grid"><div>${panel("Request register",`<div class="request-list">${rows||'<div class="empty-state">No requests found for this account.</div>'}</div>`)}</div><div>${form}${panel("Workflow",'<div class="panel-body"><p class="muted">Student and parent requests are routed to school review. Teacher leave and timetable changes require approval in the demo. Real requests will need backend access control.</p></div>')}</div></div>`;
  }

  function renderReports() {
    if(!schoolData)return renderLiveModuleNotice("Reports");
    extras();
    const role=currentUser.role;
    const students=visibleStudents(), ids=new Set(students.map(s=>s.id));
    const attendance=schoolData.attendance.filter(r=>ids.has(r.studentId));
    const marks=visibleMarks().filter(r=>r.status==="Published");
    const invoices=visibleInvoices();
    const attPercent=attendance.length?Math.round(attendance.filter(r=>["Present","Late"].includes(r.status)).length/attendance.length*100):0;
    const paid=schoolData.payments.filter(p=>ids.has(p.studentId)).reduce((sum,p)=>sum+Number(p.amount||0),0);
    const due=invoices.reduce((sum,i)=>sum+totalDue(i),0);
    const canFinance=["admin","finance"].includes(role);
    const exports=[["attendance","Attendance register"],["marks","Published results"],...(canFinance?[["fees","Fee ledger"],["payments","Receipts / collections"],["expenses","Expense register"]]:[]),...(role==="admin"?[["audit","Audit trail"],["admissions","Admissions"]]:[])].map(([id,label])=>`<button class="report-download" data-action="export-report" data-report="${id}" type="button"><span>↓</span><strong>${label} CSV</strong><small>Export current demo records</small></button>`).join("");
    const progress=students.map(s=>`<tr><td><strong>${esc(s.fullName)}</strong></td><td>${esc(s.className)}</td><td>${attendancePercent(s.id)}%</td><td>${averageMarks(s.id)===null?"—":averageMarks(s.id)+"%"}</td><td>${canFinance?esc(currency(studentOutstanding(s.id))):"Restricted"}</td></tr>`);
    const flags=students.filter(s=>attendancePercent(s.id)<85||(averageMarks(s.id)!==null&&averageMarks(s.id)<60)||studentOutstanding(s.id)>0).map(s=>`<div class="task-row"><div><strong>${esc(s.fullName)}</strong><small>${attendancePercent(s.id)<85?"Attendance below 85% · ":""}${averageMarks(s.id)!==null&&averageMarks(s.id)<60?"Academic follow-up · ":""}${studentOutstanding(s.id)>0?"Fee balance outstanding":""}</small></div><button class="inline-button" type="button" data-nav="${role==="admin"?"communications":"requests"}">Follow up</button></div>`).join("");
    return pageHeading("Reports & analytics","Role-scoped exports and early-warning signals that suggest follow-up—not punishment.")
      + `<div class="stats-grid">${statCard("Attendance",attPercent+"%","Visible demo records","✓")}${statCard("Students",students.length,"Visible roster","♧")}${statCard("Published marks",marks.length,"Reader-visible scores","▤")}${statCard("Outstanding",canFinance?currency(due):"Restricted",canFinance?"Open invoice balances":"Finance-only figure","₹")}</div>`
      + `<div class="module-grid"><div>${panel("Student progress snapshot",table(["Student","Class","Attendance","Average marks","Fee balance"],progress))}${panel("Early-warning follow-up",`<div class="panel-body">${flags||'<p class="muted">No follow-up flags in this demo sample.</p>'}</div>`)}</div><div>${panel("Download reports",`<div class="report-download-grid">${exports}</div>`)}${role==="admin"?panel("Recent audit trail",table(["Date","Actor","Activity"],schoolData.audit.slice(0,8).map(a=>`<tr><td>${esc(formatDate(a.date))}</td><td>${esc(a.actor)}</td><td>${esc(a.message)}</td></tr>`))):""}</div></div>`;
  }

  function renderAdmissions() {
    if(!schoolData||currentUser.role!=="admin")return renderLiveModuleNotice("Admissions");
    extras();
    const form=`<section class="panel"><form id="admission-form" class="module-form"><h3>Record an admission enquiry</h3><div class="field"><label for="adm-name">Applicant name</label><input id="adm-name" name="applicant" required maxlength="90"></div><div class="form-grid"><div class="field"><label for="adm-class">Requested class</label><select id="adm-class" name="className">${["Pre-primary","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"].map(c=>`<option>${c}</option>`).join("")}</select></div><div class="field"><label for="adm-contact">Parent contact label</label><input id="adm-contact" name="contact" maxlength="80"></div><div class="field"><label for="adm-source">Source</label><select id="adm-source" name="source"><option>Website</option><option>School office</option><option>Referral</option><option>Walk-in</option></select></div><div class="field field-full"><label for="adm-notes">Follow-up notes</label><textarea id="adm-notes" name="notes" rows="2" maxlength="500"></textarea></div></div><button class="primary-button" type="submit">Add enquiry</button></form></section>`;
    const rows=schoolData.admissions.map(a=>`<tr><td><strong>${esc(a.applicant)}</strong><small>${esc(a.id)}</small></td><td>${esc(a.className)}</td><td>${esc(a.contact||"—")}</td><td>${esc(a.source||"Website")}</td><td>${statusPill(a.status)}</td><td><button class="inline-button" type="button" data-action="advance-admission" data-id="${esc(a.id)}">Update stage</button></td></tr>`);
    return pageHeading("Admissions enquiry pipeline","Capture enquiries and follow up until a decision is recorded.")
      + `<div class="stats-grid">${statCard("New",schoolData.admissions.filter(a=>a.status==="New").length,"Needs first contact","＋")}${statCard("In follow-up",schoolData.admissions.filter(a=>["Contacted","Visit scheduled"].includes(a.status)).length,"Next action needed","↗")}${statCard("Admitted",schoolData.admissions.filter(a=>a.status==="Admitted").length,"Demo pipeline","✓")}${statCard("Total",schoolData.admissions.length,"Fictional applications","▤")}</div>`
      + `<div class="module-grid"><div>${panel("Enquiries",table(["Applicant","Class","Contact","Source","Stage","Action"],rows))}</div><div>${form}${panel("Next rollout",'<div class="panel-body"><p class="muted">Live admissions can later add secure document checklists, acknowledgement messages and class seat availability.</p></div>')}</div></div>`;
  }

  function renderExpenses() {
    if(!schoolData)return renderLiveModuleNotice("Expenses");
    extras();
    const role=currentUser.role, canCreate=["admin","finance"].includes(role);
    const rows=schoolData.expenses.map(e=>`<tr><td><strong>${esc(e.title)}</strong><small>${esc(e.id)} · ${esc(e.category)}</small></td><td>${esc(formatDate(e.date))}</td><td>${esc(currency(e.amount))}</td><td>${esc(e.submittedBy||"Finance demo")}</td><td>${statusPill(e.status)}</td></tr>`);
    const form=canCreate?`<section class="panel"><form id="expense-form" class="module-form"><h3>Record school expense</h3><p>Submitted expenses enter the principal's approval queue.</p><div class="field"><label for="exp-title">Description</label><input id="exp-title" name="title" required maxlength="100"></div><div class="form-grid"><div class="field"><label for="exp-category">Category</label><select id="exp-category" name="category"><option>Learning materials</option><option>Maintenance</option><option>Transport</option><option>Utilities</option><option>Events</option><option>Other</option></select></div><div class="field"><label for="exp-amount">Amount (₹)</label><input id="exp-amount" name="amount" type="number" min="1" max="1000000" value="2500" required></div><div class="field"><label for="exp-date">Date</label><input id="exp-date" name="date" type="date" value="${esc(todayISO())}" required></div></div><button class="primary-button" type="submit">Submit for approval</button></form></section>`:"";
    const receipts=schoolData.payments.reduce((s,p)=>s+Number(p.amount||0),0), spend=schoolData.expenses.filter(e=>e.status==="Approved").reduce((s,e)=>s+Number(e.amount||0),0);
    return pageHeading("Expenses & reconciliation","Maintain a demo expense register and compare it with the sample receipt ledger.")
      + `<div class="stats-grid">${statCard("Recorded collections",currency(receipts),"Receipt ledger","₹")}${statCard("Approved expenses",currency(spend),"Approved demo rows","−")}${statCard("Pending expenses",schoolData.expenses.filter(e=>e.status==="Pending approval").length,"Needs principal review","✓")}${statCard("Bank connection","Off","No real reconciliation","⊘")}</div>`
      + `<div class="module-grid"><div>${panel("Expense register",table(["Expense","Date","Amount","Submitted by","Status"],rows))}${panel("Daily closing",`<div class="panel-body"><p class="muted">Receipt total: <strong>${esc(currency(receipts))}</strong> · Approved demo expenses: <strong>${esc(currency(spend))}</strong></p><p class="muted">A real bank/UPI reconciliation integration is not connected.</p><button class="secondary-button" data-action="export-report" data-report="payments" type="button">Export collections</button> <button class="secondary-button" data-action="export-report" data-report="expenses" type="button">Export expenses</button></div>`)}</div><div>${form}${panel("Finance controls",'<div class="panel-body"><p class="muted">Production must use immutable transactions, separate refund permissions and tested backups.</p></div>')}</div></div>`;
  }

  function renderOperations() {
    if(!schoolData)return renderLiveModuleNotice("School operations");
    extras();
    const role=currentUser.role;
    const books=schoolData.libraryBooks, loans=schoolData.libraryLoans, inv=schoolData.inventory;
    const bookRows=books.map(b=>`<tr><td><strong>${esc(b.title)}</strong><small>${esc(b.subject)}</small></td><td>${esc(b.total)}</td><td>${esc(b.available)}</td><td>${["admin","teacher"].includes(role)&&b.available>0?`<button class="inline-button" data-action="checkout-book" data-id="${esc(b.id)}" type="button">Issue</button>`:"—"}</td></tr>`);
    const loanRows=loans.map(l=>`<tr><td>${esc(studentName(l.studentId))}</td><td>${esc(books.find(b=>b.id===l.bookId)?.title||l.bookId)}</td><td>${esc(formatDate(l.dueDate))}</td><td>${statusPill(l.status)}</td><td>${l.status==="Borrowed"&&["admin","teacher"].includes(role)?`<button class="inline-button" data-action="return-book" data-id="${esc(l.id)}" type="button">Return</button>`:"—"}</td></tr>`);
    const invRows=inv.map(i=>`<tr><td><strong>${esc(i.name)}</strong><small>${esc(i.category)}</small></td><td>${esc(i.quantity)} ${esc(i.unit||"")}</td><td>${esc(i.location||"—")}</td><td>${["admin","teacher"].includes(role)?`<button class="inline-button" data-action="issue-inventory" data-id="${esc(i.id)}" type="button">Issue</button>`:"—"}</td></tr>`);
    const routes=(schoolData.transportRoutes||[]).map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${esc(r.vehicle)}</td><td>${esc(r.stops.join(" → "))}</td><td>${esc(r.time)}</td></tr>`);
    const events=schoolData.schoolEvents.map(e=>`<tr><td>${esc(formatDate(e.date))}</td><td>${esc(e.title)}</td><td>${esc(e.kind||"Event")}</td><td>${esc(e.audience||"All")}</td></tr>`);
    return pageHeading("School operations","Library lending, inventory, transport routes and event calendar.")
      + `<div class="operation-grid"><article class="operation-tile"><span class="operation-icon">▦</span><div><strong>Library</strong><p>Borrowing and return tracking.</p><small>${books.reduce((s,b)=>s+Number(b.available||0),0)} sample copies available</small></div></article><article class="operation-tile"><span class="operation-icon">🚌</span><div><strong>Transport</strong><p>Route and stop directory.</p><small>${(schoolData.transportRoutes||[]).length} sample routes</small></div></article><article class="operation-tile"><span class="operation-icon">▤</span><div><strong>Inventory</strong><p>Classroom equipment and consumables.</p><small>${inv.length} tracked sample items</small></div></article><article class="operation-tile"><span class="operation-icon">♙</span><div><strong>Staff leave</strong><p>Requests use the approval process.</p><small>${schoolData.requests.filter(r=>r.type.includes("leave")||r.type.includes("Substitute")).length} request(s)</small></div></article><article class="operation-tile"><span class="operation-icon">₹</span><div><strong>Payroll & payslips</strong><p>Planned for a later secure finance phase.</p><small>Not enabled in demo</small></div></article><article class="operation-tile"><span class="operation-icon">▣</span><div><strong>Certificates</strong><p>Bonafide / transfer / character requests.</p><small>Register in Requests</small></div></article></div>`
      + `<div class="module-grid"><div>${panel("Library catalogue",table(["Book","Total","Available","Action"],bookRows))}${panel("Active loans",table(["Student","Book","Due","Status","Action"],loanRows))}${panel("Inventory register",table(["Item","Quantity","Location","Action"],invRows))}</div><div>${panel("Transport routes",table(["Route","Vehicle","Stops","Timing"],routes))}${panel("School calendar",table(["Date","Event","Category","Audience"],events))}${panel("Staff support",`<div class="panel-body"><p class="muted">Staff leave, substitute cover and teaching support requests are tracked in the request register.</p><button type="button" class="secondary-button" data-nav="requests">Open requests →</button></div>`)}</div></div>`;
  }

  function resolveApproval(id, outcome) {
    if(currentUser.role!=="admin")return showPortalMessage("Only the principal demo account can resolve approvals.",true);
    const a=schoolData.approvals.find(x=>x.id===id&&x.status==="Pending"); if(!a)return;
    const ok=outcome==="Approved"; a.status=outcome; a.reviewedBy=currentUser.fullName; a.reviewedAt=new Date().toISOString();
    if(a.targetType==="mark"){const m=schoolData.marks.find(x=>x.id===a.targetId);if(m){m.status=ok?"Published":"Rejected";notifyStudent(m.studentId,ok?"Results published":"Results not published",`${m.subject} result status: ${m.status}.`);}}
    if(a.targetType==="datesheet"){const s=schoolData.datesheets.find(x=>x.id===a.targetId);if(s)s.status=ok?"Published":"Rejected";}
    if(a.targetType==="homework"){const h=schoolData.homework.find(x=>x.id===a.targetId);if(h){h.status=ok?"Published":"Rejected";if(ok)notify("New homework: "+h.title,`Due ${formatDate(h.dueDate)}.`,"student");}}
    if(a.targetType==="expense"){const e=schoolData.expenses.find(x=>x.id===a.targetId);if(e)e.status=ok?"Approved":"Rejected";}
    if(a.targetType==="request"){const r=schoolData.requests.find(x=>x.id===a.targetId);if(r)r.status=ok?"Approved":"Declined";}
    if(a.targetType==="timetable"&&ok&&a.payload){const t={...a.payload,id:"TT-"+Date.now()};const i=schoolData.timetable.findIndex(x=>x.className===t.className&&x.day===t.day&&String(x.period)===String(t.period));if(i>=0)schoolData.timetable[i]=t;else schoolData.timetable.push(t);}
    recordAudit(`${outcome} approval: ${a.title}`); persistDemoData(); renderView();
    showPortalMessage(`${a.title} — ${outcome.toLowerCase()} in the demo.`,false);
  }

  function submitHomework(form) {
    const v=new FormData(form), title=String(v.get("title")||"").trim(), desc=String(v.get("description")||"").trim(), due=String(v.get("dueDate")||"");
    if(!title||!desc||!due)return showPortalMessage("Complete all assignment fields.",true);
    const h={id:"HW-"+Date.now(),title,className:String(v.get("className")||"X-A"),subject:String(v.get("subject")||"English"),dueDate:due,description:desc,createdBy:currentUser.fullName,status:currentUser.role==="admin"?"Published":"Pending approval"};
    schoolData.homework.unshift(h);
    if(h.status==="Pending approval")askApproval("Homework publication","Publish assignment: "+title,`${h.className} · ${h.subject} · due ${formatDate(due)}.`,"homework",h.id);
    else notify("New homework: "+title,`Due ${formatDate(due)}.`,"student");
    recordAudit("Created assignment "+title);persistDemoData();renderView();showPortalMessage(h.status==="Published"?"Assignment published.":"Assignment sent for principal approval.",false);
  }

  function submitWork(form) {
    const task=schoolData.homework.find(x=>x.id===form.dataset.homeworkId&&x.status==="Published");
    const text=String(new FormData(form).get("submission")||"").trim();
    if(currentUser.role!=="student"||!task||!text)return showPortalMessage("Enter a valid submission.",true);
    if(schoolData.submissions.some(x=>x.homeworkId===task.id&&x.studentId===currentUser.studentId))return showPortalMessage("You have already submitted this demo assignment.",true);
    schoolData.submissions.unshift({id:"SUB-"+Date.now(),homeworkId:task.id,studentId:currentUser.studentId,text,status:"Submitted",feedback:"",submittedAt:new Date().toISOString()});
    notify("Homework submitted",`${studentName(currentUser.studentId)} submitted ${task.title}.`,"teacher");recordAudit("Submitted homework "+task.title);persistDemoData();renderView();showPortalMessage("Work submitted to the demo teacher workspace.",false);
  }

  function submitMessage(form) {
    const v=new FormData(form), to=String(v.get("recipientRole")||"admin"), subject=String(v.get("subject")||"").trim(), body=String(v.get("body")||"").trim(), studentId=String(v.get("studentId")||"")||null;
    const allowed={admin:["All","teacher","parent","student","finance"],finance:["admin","parent"],teacher:["admin","parent","student"],parent:["teacher","admin"],student:["teacher","admin"]};
    if(!allowed[currentUser.role]?.includes(to)||!subject||!body)return showPortalMessage("Check the recipient, subject and message.",true);
    schoolData.messages.unshift({id:"MSG-"+Date.now(),senderName:currentUser.fullName,senderRole:currentUser.role,senderEmail:currentUser.email,recipientRole:to,studentId,subject:subject.slice(0,100),body:body.slice(0,1200),date:new Date().toISOString()});
    notify("New message: "+subject,`From ${currentUser.fullName}: ${body.slice(0,160)}`,to,studentId);
    recordAudit("Sent demo message "+subject);persistDemoData();renderView();showPortalMessage("Message saved in the demo inbox; nothing was sent externally.",false);
  }

  function submitRequest(form) {
    const v=new FormData(form), type=String(v.get("requestType")||"School request"), details=String(v.get("details")||"").trim(), date=String(v.get("date")||""), studentId=String(v.get("studentId")||(currentUser.role==="student"?currentUser.studentId:""))||null;
    if(!details)return showPortalMessage("Add details to your request.",true);
    if(["student","parent"].includes(currentUser.role)&&(!studentId||!visibleStudentIds().includes(studentId)))return showPortalMessage("Choose a linked student.",true);
    const r={id:"REQ-"+Date.now(),type,title:type,details:details.slice(0,600),studentId,date:new Date().toISOString(),relevantDate:date,status:"Pending",requestedBy:currentUser.fullName,requestedByEmail:currentUser.email,requestedRole:currentUser.role};
    schoolData.requests.unshift(r);askApproval("School request","Review "+type+(studentId?" · "+studentName(studentId):""),details,"request",r.id);
    notify("Request received",`Your ${type.toLowerCase()} is awaiting school review.`,"All",studentId,currentUser.email);recordAudit("Submitted request "+type);persistDemoData();renderView();showPortalMessage("Request saved and queued for school review.",false);
  }

  function submitTimetableChange(form) {
    const v=new FormData(form), payload={className:String(v.get("className")||"X-A"),day:String(v.get("day")||"Monday"),period:String(v.get("period")||"1"),time:String(v.get("time")||""),subject:String(v.get("subject")||"").trim(),teacher:String(v.get("teacher")||"").trim(),room:String(v.get("room")||"").trim()};
    if(!payload.subject||!payload.time||!payload.teacher)return showPortalMessage("Complete the timetable change.",true);
    askApproval("Timetable change",`Change ${payload.className} timetable · ${payload.day} P${payload.period}`,`${payload.subject} · ${payload.time} · ${payload.teacher}.`,"timetable","",payload);
    recordAudit("Proposed timetable change");persistDemoData();renderView();showPortalMessage("Timetable change is pending principal approval.",false);
  }

  function submitExpense(form) {
    const v=new FormData(form), title=String(v.get("title")||"").trim(), amount=Number(v.get("amount")), date=String(v.get("date")||todayISO()), category=String(v.get("category")||"Other");
    if(!title||!Number.isFinite(amount)||amount<=0||amount>1000000)return showPortalMessage("Enter a valid expense.",true);
    const e={id:"EXP-"+Date.now(),title,category,amount,date,status:"Pending approval",submittedBy:currentUser.fullName};
    schoolData.expenses.unshift(e);askApproval("Expense approval","Approve expense: "+title,`${currency(amount)} · ${category} · ${formatDate(date)}.`,"expense",e.id);
    recordAudit("Submitted expense "+title);persistDemoData();renderView();showPortalMessage("Expense saved and sent to principal approval.",false);
  }

  function submitAdmission(form) {
    const v=new FormData(form), applicant=String(v.get("applicant")||"").trim();if(!applicant)return showPortalMessage("Enter the applicant name.",true);
    const a={id:"ADM-"+Date.now(),applicant,className:String(v.get("className")||"I"),contact:String(v.get("contact")||""),source:String(v.get("source")||"Website"),notes:String(v.get("notes")||""),status:"New",createdAt:new Date().toISOString()};
    schoolData.admissions.unshift(a);notify("New admission enquiry",`${applicant} · Class ${a.className}`,"admin");recordAudit("Added admission enquiry "+a.id);persistDemoData();renderView();showPortalMessage("Enquiry added to the demo pipeline.",false);
  }

  function submitCalendar(form) {
    const v=new FormData(form), title=String(v.get("title")||"").trim(), date=String(v.get("date")||"");if(!title||!date)return showPortalMessage("Enter event details.",true);
    schoolData.schoolEvents.push({id:"EVT-"+Date.now(),title,date,kind:String(v.get("kind")||"School event"),audience:"All"});notify("School calendar updated",`${title} · ${formatDate(date)}`,"All");recordAudit("Added calendar event "+title);persistDemoData();renderView();showPortalMessage("Demo event added to the calendar.",false);
  }

  function submitPayment(invoiceId) {
    if(!["admin","finance"].includes(currentUser.role))return;
    const invoice=schoolData.invoices.find(i=>i.id===invoiceId);if(!invoice)return;
    const balance=totalDue(invoice);if(balance<=0)return showPortalMessage("No balance remains on this invoice.",true);
    const input=window.prompt(`Fictional demo payment only. Remaining balance ${currency(balance)}. Enter amount in ₹:`,String(balance));if(input===null)return;
    const amount=Number(input);if(!Number.isFinite(amount)||amount<=0||amount>balance)return showPortalMessage("Enter an amount greater than zero and no greater than the balance.",true);
    invoice.paidAmount=Number(invoice.paidAmount||0)+amount;invoice.status=invoice.paidAmount>=invoice.amount?"Paid":"Partial";
    const p={id:"PAY-"+Date.now(),receiptNo:"DEMO-RCP-"+String(Date.now()).slice(-8),invoiceId:invoice.id,studentId:invoice.studentId,amount,date:new Date().toISOString(),method:"Demo manual entry",collectedBy:currentUser.fullName};
    schoolData.payments.unshift(p);notify("Demo fee receipt recorded",`${currency(amount)} recorded for invoice ${invoice.id}. Receipt ${p.receiptNo}. No actual payment occurred.`,"parent",invoice.studentId);recordAudit(`Recorded ${currency(amount)} against ${invoice.id}`);persistDemoData();renderView();showPortalMessage("Demo payment recorded. Receipt "+p.receiptNo+" is available below.",false);
  }

  function exportReport(report) {
    const ids=new Set(visibleStudents().map(s=>s.id));let rows=[["Saraswati School ERP Demo","Fictional sample records"],["Generated",new Date().toISOString()],[]];
    if(report==="attendance")rows.push(["Student ID","Student","Class","Date","Status","Marked by"],...schoolData.attendance.filter(a=>ids.has(a.studentId)).map(a=>[a.studentId,studentName(a.studentId),studentById(a.studentId)?.className,a.date,a.status,a.markedBy]));
    else if(report==="marks")rows.push(["Student ID","Student","Exam","Subject","Score","Max","Status"],...visibleMarks().filter(m=>m.status==="Published").map(m=>[m.studentId,studentName(m.studentId),m.examTitle,m.subject,m.score,m.maxMarks,m.status]));
    else if(report==="fees"&&["admin","finance"].includes(currentUser.role))rows.push(["Invoice","Student","Description","Amount","Paid","Balance","Status","Due date"],...visibleInvoices().map(i=>[i.id,studentName(i.studentId),i.description,i.amount,i.paidAmount||0,totalDue(i),i.status,i.dueDate]));
    else if(report==="payments"&&["admin","finance"].includes(currentUser.role))rows.push(["Receipt","Date","Invoice","Student","Amount","Method","Collector"],...schoolData.payments.filter(p=>ids.has(p.studentId)).map(p=>[p.receiptNo,p.date,p.invoiceId,studentName(p.studentId),p.amount,p.method,p.collectedBy]));
    else if(report==="expenses"&&["admin","finance"].includes(currentUser.role))rows.push(["ID","Expense","Category","Amount","Date","Status"],...schoolData.expenses.map(e=>[e.id,e.title,e.category,e.amount,e.date,e.status]));
    else if(report==="audit"&&currentUser.role==="admin")rows.push(["Date","Actor","Activity"],...schoolData.audit.map(a=>[a.date,a.actor,a.message]));
    else if(report==="admissions"&&currentUser.role==="admin")rows.push(["ID","Applicant","Class","Contact","Source","Status"],...schoolData.admissions.map(a=>[a.id,a.applicant,a.className,a.contact,a.source,a.status]));
    else return showPortalMessage("That report isn't available for this role.",true);
    downloadData("\ufeff"+rows.map(row=>row.map(csvValue).join(",")).join("\r\n"),"text/csv;charset=utf-8",`saraswati-${report}-${todayISO()}-demo.csv`);
    recordAudit("Exported demo report "+report);persistDemoData();showPortalMessage("CSV downloaded with fictional demo data only.",false);
  }

  function advancedClick(action,id,button) {
    if(!currentIsDemo||!schoolData)return;
    if(action==="resolve-approval")return resolveApproval(id,button.dataset.outcome||"Rejected");
    if(action==="collect-payment")return submitPayment(id);
    if(action==="download-receipt")return downloadReceipt(id);
    if(action==="export-report")return exportReport(button.dataset.report||"");
    if(action==="read-notification"){
      const n=schoolData.notifications.find(x=>x.id===id);if(!n)return;n.readBy||=[];if(!n.readBy.includes(currentUser.email))n.readBy.push(currentUser.email);persistDemoData();renderView();return showPortalMessage("Notification marked read.",false);
    }
    if(action==="read-all-notifications"){
      schoolData.notifications.forEach(n=>{n.readBy||=[];if(!n.readBy.includes(currentUser.email))n.readBy.push(currentUser.email);});persistDemoData();renderView();return showPortalMessage("All notifications marked read in this demo.",false);
    }
    if(action==="publish-mark"||action==="unpublish-mark"){
      if(currentUser.role!=="admin")return;const m=schoolData.marks.find(x=>x.id===id);if(!m)return;m.status=action==="publish-mark"?"Published":"Draft";recordAudit(m.status+" marks for "+studentName(m.studentId));persistDemoData();renderView();return;
    }
    if(action==="submit-mark-approval"){
      if(currentUser.role!=="teacher")return;const m=schoolData.marks.find(x=>x.id===id&&x.status==="Draft");if(!m)return;m.status="Pending approval";askApproval("Marks publication","Publish "+m.subject+" marks · "+studentName(m.studentId),`${m.examTitle}: ${m.score}/${m.maxMarks}.`,"mark",m.id);persistDemoData();renderView();return;
    }
    if(action==="publish-datesheet"){
      if(currentUser.role!=="admin")return;const s=schoolData.datesheets.find(x=>x.id===id);if(!s)return;s.status="Published";persistDemoData();renderView();return;
    }
    if(action==="review-submission"){
      if(!["teacher","admin"].includes(currentUser.role))return;const s=schoolData.submissions.find(x=>x.id===id);if(!s)return;const feedback=window.prompt("Enter feedback for "+studentName(s.studentId)+":","Good effort — reviewed.");if(feedback===null)return;s.status="Reviewed";s.feedback=feedback.slice(0,400);s.reviewedBy=currentUser.fullName;notify("Homework feedback","Teacher feedback is available for "+studentName(s.studentId)+".","student",s.studentId);recordAudit("Reviewed homework submission");persistDemoData();renderView();return;
    }
    if(action==="advance-admission"){
      if(currentUser.role!=="admin")return;const a=schoolData.admissions.find(x=>x.id===id);if(!a)return;const stages=["New","Contacted","Visit scheduled","Admitted","Closed"];a.status=stages[(stages.indexOf(a.status)+1)%stages.length];recordAudit("Admission "+a.id+" moved to "+a.status);persistDemoData();renderView();return;
    }
    if(action==="checkout-book"){
      if(!["admin","teacher"].includes(currentUser.role))return;const b=schoolData.libraryBooks.find(x=>x.id===id);if(!b||b.available<1)return;const input=window.prompt("Enter demo student ID to issue "+b.title+":\n"+schoolData.students.map(s=>s.id+" — "+s.fullName).join("\n"),"STU-001");if(input===null)return;const s=studentById(input.trim());if(!s)return showPortalMessage("Student ID not found.",true);schoolData.libraryLoans.unshift({id:"LIB-"+Date.now(),bookId:b.id,studentId:s.id,issueDate:todayISO(),dueDate:new Date(Date.now()+14*86400000).toISOString().slice(0,10),status:"Borrowed"});b.available--;recordAudit("Issued book "+b.title+" to "+s.fullName);persistDemoData();renderView();return;
    }
    if(action==="return-book"){
      if(!["admin","teacher"].includes(currentUser.role))return;const l=schoolData.libraryLoans.find(x=>x.id===id&&x.status==="Borrowed");if(!l)return;l.status="Returned";l.returnDate=todayISO();const b=schoolData.libraryBooks.find(x=>x.id===l.bookId);if(b)b.available=Math.min(b.total,b.available+1);recordAudit("Returned library book");persistDemoData();renderView();return;
    }
    if(action==="issue-inventory"){
      if(!["admin","teacher"].includes(currentUser.role))return;const item=schoolData.inventory.find(x=>x.id===id);if(!item||item.quantity<=0)return;const input=window.prompt("Quantity to issue (available: "+item.quantity+")","1");if(input===null)return;const quantity=Number(input);if(!Number.isInteger(quantity)||quantity<1||quantity>item.quantity)return showPortalMessage("Enter a whole number within available stock.",true);item.quantity-=quantity;schoolData.inventoryMovements.unshift({id:"MOV-"+Date.now(),itemId:id,quantity,type:"Issue",by:currentUser.fullName,date:todayISO()});recordAudit("Issued inventory item "+item.name);persistDemoData();renderView();return;
    }
    if(action==="download-resource"){
      const r=(schoolData.resources||[]).find(x=>x.id===id);if(r)downloadData(`${r.title}\n${r.subject}\n\n${r.description}\n\nFictional ERP demo note.`,"text/plain;charset=utf-8",r.id+".txt");
    }
  }

  portalRoot.addEventListener("click",event=>{
    const b=event.target.closest("[data-action]");
    if(b&&["resolve-approval","collect-payment","download-receipt","export-report","read-notification","read-all-notifications","publish-mark","unpublish-mark","submit-mark-approval","publish-datesheet","review-submission","advance-admission","checkout-book","return-book","issue-inventory","download-resource"].includes(b.dataset.action))advancedClick(b.dataset.action,b.dataset.id,b);
  });

  portalRoot.addEventListener("submit",event=>{
    const form=event.target;if(!form.matches("form"))return;
    if(form.matches(".homework-submit-form")){event.preventDefault();if(currentIsDemo)submitWork(form);return;}
    const handlers={"homework-form":submitHomework,"communication-form":submitMessage,"request-form":submitRequest,"timetable-form":submitTimetableChange,"expense-form":submitExpense,"admission-form":submitAdmission,"calendar-form":submitCalendar};
    const handler=handlers[form.id];if(!handler)return;
    event.preventDefault();if(!currentIsDemo)return showPortalMessage("Live module actions are not connected yet.",true);
    const permissions={"homework-form":["admin","teacher"],"communication-form":["admin","finance","teacher","parent","student"],"request-form":["admin","teacher","parent","student"],"timetable-form":["admin","teacher"],"expense-form":["admin","finance"],"admission-form":["admin"],"calendar-form":["admin"]};
    if(!permissions[form.id].includes(currentUser.role))return showPortalMessage("This action isn't available for your demo role.",true);
    handler(form);
  });

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
