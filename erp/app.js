import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.SARASWATI_ERP_CONFIG || {};
const configured = typeof config.supabaseUrl === "string"
  && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl)
  && typeof config.supabaseAnonKey === "string"
  && config.supabaseAnonKey.length > 20
  && !config.supabaseAnonKey.includes("YOUR-");
const supabase = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const loginPanel = document.querySelector("#login-panel");
const dashboardPanel = document.querySelector("#dashboard-panel");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginStatus = document.querySelector("#login-status");
const setupNotice = document.querySelector("#setup-notice");
const roleCards = document.querySelector("#role-cards");

const roleDetails = {
  admin: {
    label: "Administrator",
    summary: "Manage the school's approved ERP setup and access.",
    cards: [
      ["School setup", "Classes, sections, subjects, staff and student records.", "Planned · Phase 2"],
      ["Attendance oversight", "Review class attendance and correction history.", "Planned · Phase 3"],
      ["Exams & datesheets", "Publish assessment schedules and results after review.", "Planned · Phase 4"]
    ]
  },
  teacher: {
    label: "Teacher",
    summary: "Your teaching workspace will show only your assigned classes and subjects.",
    cards: [
      ["My classes", "Class lists and teaching assignments.", "Planned · Phase 2"],
      ["Mark attendance", "Record and submit attendance for authorized classes.", "Planned · Phase 3"],
      ["Marks & datesheets", "Enter marks for assigned subjects and view published datesheets.", "Planned · Phase 4"]
    ]
  },
  parent: {
    label: "Parent / Guardian",
    summary: "Family access will be limited to the student records linked and approved by the school.",
    cards: [
      ["Attendance", "View linked child's attendance and school-published updates.", "Planned · Phase 3"],
      ["Marks & report cards", "See published marks and downloadable report cards.", "Planned · Phase 4"],
      ["Notices & homework", "Read circulars, assignments and important school dates.", "Planned · Phase 5"]
    ]
  },
  student: {
    label: "Student",
    summary: "Your workspace will show only your own records and school-published information.",
    cards: [
      ["My attendance", "Review your attendance record.", "Planned · Phase 3"],
      ["My results", "See marks and report cards after publication.", "Planned · Phase 4"],
      ["Timetable & homework", "Check your schedule, assignments and school notices.", "Planned · Phase 5"]
    ]
  }
};

function setLoginMessage(message, isError = true) {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "var(--danger)" : "var(--green-2)";
}

function setDashboardMessage(message, isError = true) {
  const el = document.querySelector("#dashboard-status");
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "var(--green-2)";
}

function renderRoleCard(title, description, status) {
  const card = document.createElement("article");
  card.className = "role-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = description;
  const tag = document.createElement("span");
  tag.textContent = status;
  card.append(heading, text, tag);
  return card;
}

function showDashboard(profile, email) {
  const details = roleDetails[profile.role];
  if (!details) {
    throw new Error("Your account does not have an approved ERP role. Contact the school office.");
  }

  document.querySelector("#welcome-title").textContent = profile.full_name?.trim()
    ? "Welcome, " + profile.full_name.trim()
    : "Welcome";
  document.querySelector("#role-summary").textContent = details.label + " · " + (email || "");
  roleCards.replaceChildren(...details.cards.map(card => renderRoleCard(...card)));
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  setDashboardMessage("", false);
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
  if (data.role === "pending" || !roleDetails[data.role]) {
    await supabase.auth.signOut();
    throw new Error("Your account is waiting for school approval. Contact the school office.");
  }
  return data;
}

async function startSession(user) {
  try {
    const profile = await loadApprovedProfile(user);
    showDashboard(profile, user.email);
  } catch (error) {
    dashboardPanel.hidden = true;
    loginPanel.hidden = false;
    setLoginMessage(error.message || "Unable to load your school profile.");
  }
}

if (!supabase) {
  setupNotice.hidden = false;
  loginButton.disabled = true;
  setLoginMessage("Sign-in is disabled until the Supabase project is configured.");
} else {
  setupNotice.hidden = true;
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      setLoginMessage("Unable to check your session. Please refresh and try again.");
      return;
    }
    if (data.session?.user) startSession(data.session.user);
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;

  loginButton.disabled = true;
  loginButton.textContent = "Signing in…";
  setLoginMessage("");

  const form = new FormData(loginForm);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    setLoginMessage("Sign-in failed. Check your school-issued credentials and try again.");
    loginButton.disabled = false;
    loginButton.innerHTML = 'Sign in securely <span aria-hidden="true">→</span>';
    return;
  }

  await startSession(data.user);
  loginButton.disabled = false;
  loginButton.innerHTML = 'Sign in securely <span aria-hidden="true">→</span>';
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    setDashboardMessage("We could not sign you out. Please try again.");
    return;
  }
  dashboardPanel.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
  setLoginMessage("You have signed out.", false);
});

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});