export const DEMO_PASSWORD = "Demo@12345";
export const DEMO_STORAGE_KEY = "saraswati-erp-demo-v1";
export const DEMO_CLASS_LIST = ["X-A", "IX-A", "VIII-A"];

export const DEMO_ACCOUNTS = [
  { email: "principal@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Principal", role: "admin" },
  { email: "finance@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Finance Officer", role: "finance" },
  { email: "teacher@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Class Teacher", role: "teacher" },
  { email: "parent@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Parent / Guardian", role: "parent", studentIds: ["STU-001", "STU-002"] },
  { email: "aarav@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Aarav Sharma", role: "student", studentId: "STU-001" },
  { email: "ananya@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Ananya Verma", role: "student", studentId: "STU-002" },
  { email: "vivaan@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Vivaan Singh", role: "student", studentId: "STU-003" },
  { email: "meera@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Meera Gupta", role: "student", studentId: "STU-004" }
];

export function createInitialDemoData() {
  const students = [
    { id: "STU-001", fullName: "Aarav Sharma", className: "X-A", rollNo: 1, guardianName: "Rohan Sharma" },
    { id: "STU-002", fullName: "Ananya Verma", className: "X-A", rollNo: 2, guardianName: "Neha Verma" },
    { id: "STU-003", fullName: "Vivaan Singh", className: "X-A", rollNo: 3, guardianName: "Manoj Singh" },
    { id: "STU-004", fullName: "Meera Gupta", className: "X-A", rollNo: 4, guardianName: "Kavita Gupta" }
  ];

  const attendance = [
    ["2026-10-19", ["Present", "Present", "Absent", "Present"]],
    ["2026-10-20", ["Present", "Late", "Present", "Present"]],
    ["2026-10-21", ["Present", "Present", "Present", "Absent"]],
    ["2026-10-22", ["Present", "Absent", "Present", "Present"]]
  ].flatMap(([date, statuses]) =>
    students.map((student, index) => ({
      id: `ATT-${date}-${student.id}`,
      studentId: student.id,
      date,
      status: statuses[index],
      markedBy: "Demo Class Teacher",
      updatedAt: new Date().toISOString()
    }))
  );

  const scoreRows = [
    ["STU-001", [86, 91, 82, 88, 90]],
    ["STU-002", [93, 89, 95, 87, 92]],
    ["STU-003", [74, 78, 81, 76, 79]],
    ["STU-004", [88, 94, 90, 91, 85]]
  ];
  const subjects = ["English", "Mathematics", "Science", "Social Science", "Hindi"];
  const marks = scoreRows.flatMap(([studentId, scores]) =>
    subjects.map((subject, index) => ({
      id: `MRK-${studentId}-${index + 1}`,
      studentId,
      examTitle: "Term 1 Assessment (Demo)",
      subject,
      score: scores[index],
      maxMarks: 100,
      status: "Published",
      examDate: "2026-10-15",
      enteredBy: "Demo Class Teacher"
    }))
  );

  return {
    academicYear: "2026–27",
    students,
    attendance,
    marks,
    datesheets: [
      {
        id: "DS-001",
        title: "Term Assessment Datesheet (Demo)",
        className: "X-A",
        startDate: "2026-10-26",
        endDate: "2026-10-30",
        uploadedBy: "Demo Class Teacher",
        uploadedAt: "2026-10-20T10:00:00.000Z",
        fileName: "",
        fileData: "",
        fileType: "",
        schedule: [
          { date: "2026-10-26", subject: "English", time: "09:00–12:00" },
          { date: "2026-10-27", subject: "Hindi", time: "09:00–12:00" },
          { date: "2026-10-28", subject: "Mathematics", time: "09:00–12:00" },
          { date: "2026-10-29", subject: "Science", time: "09:00–12:00" },
          { date: "2026-10-30", subject: "Social Science", time: "09:00–12:00" }
        ]
      }
    ],
    invoices: [
      { id: "INV-1001", studentId: "STU-001", description: "Term fee — demo", amount: 4200, dueDate: "2026-11-05", status: "Due", createdAt: "2026-10-01T09:00:00.000Z" },
      { id: "INV-1002", studentId: "STU-002", description: "Term fee — demo", amount: 4200, dueDate: "2026-11-05", status: "Paid", createdAt: "2026-10-01T09:00:00.000Z" },
      { id: "INV-1003", studentId: "STU-003", description: "Transport fee — demo", amount: 1800, dueDate: "2026-11-10", status: "Due", createdAt: "2026-10-02T09:00:00.000Z" },
      { id: "INV-1004", studentId: "STU-004", description: "Term fee — demo", amount: 4200, dueDate: "2026-11-05", status: "Partial", paidAmount: 2000, createdAt: "2026-10-01T09:00:00.000Z" },
      { id: "INV-1005", studentId: "STU-001", description: "Library and activity fee — demo", amount: 650, dueDate: "2026-11-12", status: "Due", createdAt: "2026-10-03T09:00:00.000Z" }
    ],
    notices: [
      { id: "NTC-01", title: "Term assessment datesheet (demo)", audience: "All", body: "A sample datesheet is available in the portal. Dates are fictional and for testing only.", date: "2026-10-20" },
      { id: "NTC-02", title: "Parent-teacher meeting (demo)", audience: "All", body: "Sample notice: a parent-teacher meeting is planned for demonstration purposes.", date: "2026-10-18" },
      { id: "NTC-03", title: "Fee reminder (demo)", audience: "Finance / families", body: "Sample fee records are fictional. Do not make payments against this demo portal.", date: "2026-10-16" }
    ],
    payments: [
      { id: "PAY-SEED-1", receiptNo: "DEMO-RCP-1002", invoiceId: "INV-1002", studentId: "STU-002", amount: 4200, date: "2026-10-15T09:30:00.000Z", method: "Demo UPI entry", collectedBy: "Demo Finance Officer" },
      { id: "PAY-SEED-2", receiptNo: "DEMO-RCP-1004", invoiceId: "INV-1004", studentId: "STU-004", amount: 2000, date: "2026-10-16T10:15:00.000Z", method: "Demo cash entry", collectedBy: "Demo Finance Officer" }
    ],
    notifications: [
      { id: "NOT-SEED-1", title: "Attendance alert: Ananya Verma", body: "Ananya was marked absent in a sample attendance record on 22 Oct 2026. This is a fictional demo alert.", audience: "parent", studentId: "STU-002", targetEmail: null, date: "2026-10-22T08:00:00.000Z", readBy: [] },
      { id: "NOT-SEED-2", title: "Term assessment datesheet", body: "The sample class X-A datesheet is available in the portal. All dates are fictional.", audience: "All", studentId: null, targetEmail: null, date: "2026-10-20T10:00:00.000Z", readBy: [] },
      { id: "NOT-SEED-3", title: "Fee receipt available", body: "A sample payment receipt is available for a fictional fee payment.", audience: "parent", studentId: "STU-002", targetEmail: null, date: "2026-10-15T09:30:00.000Z", readBy: [] }
    ],
    approvals: [
      { id: "APR-SEED-1", type: "School request", title: "Review absence explanation · Vivaan Singh", details: "Demo parent requests follow-up for a sample absence. This is fictional information.", targetType: "request", targetId: "REQ-SEED-1", payload: null, status: "Pending", requestedBy: "Demo Parent / Guardian", requestedAt: "2026-10-21T09:00:00.000Z", reviewedBy: "", reviewedAt: "" },
      { id: "APR-SEED-2", type: "Expense approval", title: "Approve classroom materials expense", details: "₹2,500 · Learning materials · 22 Oct 2026. Sample expense awaiting principal review.", targetType: "expense", targetId: "EXP-SEED-1", payload: null, status: "Pending", requestedBy: "Demo Finance Officer", requestedAt: "2026-10-22T08:30:00.000Z", reviewedBy: "", reviewedAt: "" }
    ],
    timetable: [
      { id: "TT-1", className: "X-A", day: "Monday", period: "1", time: "08:30–09:15", subject: "Mathematics", teacher: "Demo Class Teacher", room: "Room 10" },
      { id: "TT-2", className: "X-A", day: "Monday", period: "2", time: "09:15–10:00", subject: "English", teacher: "Demo Class Teacher", room: "Room 10" },
      { id: "TT-3", className: "X-A", day: "Monday", period: "3", time: "10:15–11:00", subject: "Science", teacher: "Demo Science Teacher", room: "Lab 1" },
      { id: "TT-4", className: "X-A", day: "Tuesday", period: "1", time: "08:30–09:15", subject: "Hindi", teacher: "Demo Hindi Teacher", room: "Room 10" },
      { id: "TT-5", className: "X-A", day: "Tuesday", period: "2", time: "09:15–10:00", subject: "Mathematics", teacher: "Demo Class Teacher", room: "Room 10" },
      { id: "TT-6", className: "X-A", day: "Wednesday", period: "1", time: "08:30–09:15", subject: "Social Science", teacher: "Demo SST Teacher", room: "Room 10" },
      { id: "TT-7", className: "X-A", day: "Wednesday", period: "2", time: "09:15–10:00", subject: "Science", teacher: "Demo Science Teacher", room: "Lab 1" },
      { id: "TT-8", className: "X-A", day: "Thursday", period: "1", time: "08:30–09:15", subject: "English", teacher: "Demo Class Teacher", room: "Room 10" },
      { id: "TT-9", className: "X-A", day: "Thursday", period: "2", time: "09:15–10:00", subject: "Hindi", teacher: "Demo Hindi Teacher", room: "Room 10" },
      { id: "TT-10", className: "X-A", day: "Friday", period: "1", time: "08:30–09:15", subject: "Mathematics", teacher: "Demo Class Teacher", room: "Room 10" },
      { id: "TT-11", className: "X-A", day: "Friday", period: "2", time: "09:15–10:00", subject: "Social Science", teacher: "Demo SST Teacher", room: "Room 10" },
      { id: "TT-12", className: "IX-A", day: "Monday", period: "1", time: "08:30–09:15", subject: "English", teacher: "Demo Teacher", room: "Room 9" },
      { id: "TT-13", className: "VIII-A", day: "Monday", period: "1", time: "08:30–09:15", subject: "Science", teacher: "Demo Teacher", room: "Room 8" }
    ],
    homework: [
      { id: "HW-SEED-1", title: "Mathematics: practice set 4", className: "X-A", subject: "Mathematics", dueDate: "2026-10-30", description: "Complete the sample linear-equations practice set. Show working for every answer.", createdBy: "Demo Class Teacher", status: "Published", createdAt: "2026-10-20T10:00:00.000Z" },
      { id: "HW-SEED-2", title: "English: reading response", className: "X-A", subject: "English", dueDate: "2026-10-27", description: "Write a short paragraph about the main idea of the reading passage discussed in class.", createdBy: "Demo Class Teacher", status: "Published", createdAt: "2026-10-21T10:00:00.000Z" },
      { id: "HW-SEED-3", title: "Science: revision questions", className: "X-A", subject: "Science", dueDate: "2026-11-02", description: "Answer the five sample revision questions from the last lesson.", createdBy: "Demo Science Teacher", status: "Published", createdAt: "2026-10-22T08:00:00.000Z" }
    ],
    submissions: [
      { id: "SUB-SEED-1", homeworkId: "HW-SEED-1", studentId: "STU-002", text: "Sample submission: completed questions 1–5 in my notebook.", status: "Submitted", feedback: "", submittedAt: "2026-10-22T09:15:00.000Z" }
    ],
    messages: [
      { id: "MSG-SEED-1", senderName: "Demo Principal", senderRole: "admin", senderEmail: "principal@demo.saraswati.test", recipientRole: "All", studentId: null, subject: "Welcome to the connected school portal", body: "This is a fictional message. Use the demo modules to test school notices, homework, approvals and fee records.", date: "2026-10-22T08:00:00.000Z" },
      { id: "MSG-SEED-2", senderName: "Demo Class Teacher", senderRole: "teacher", senderEmail: "teacher@demo.saraswati.test", recipientRole: "parent", studentId: "STU-001", subject: "Sample parent-teacher follow-up", body: "A sample message showing how a teacher could coordinate a meeting with a family.", date: "2026-10-21T11:00:00.000Z" }
    ],
    requests: [
      { id: "REQ-SEED-1", type: "Absence explanation", title: "Absence explanation", studentId: "STU-003", details: "Demo parent note: Vivaan was unwell on the sample absence date. Please review the record.", date: "2026-10-21T09:00:00.000Z", relevantDate: "2026-10-21", status: "Pending", requestedBy: "Demo Parent / Guardian", requestedByEmail: "parent@demo.saraswati.test", requestedRole: "parent" }
    ],
    schoolEvents: [
      { id: "EVT-SEED-1", title: "Parent-teacher meeting (demo)", date: "2026-10-31", kind: "Parent meeting", audience: "All" },
      { id: "EVT-SEED-2", title: "Practice assessment week (demo)", date: "2026-11-02", kind: "Examination", audience: "All" },
      { id: "EVT-SEED-3", title: "Sports and activities day (demo)", date: "2026-11-14", kind: "School event", audience: "All" }
    ],
    admissions: [
      { id: "ADM-SEED-1", applicant: "Riya Demo", className: "VI", contact: "Demo family contact", source: "Website", notes: "Fictional inquiry for testing the follow-up workflow.", status: "New", createdAt: "2026-10-20T09:00:00.000Z" },
      { id: "ADM-SEED-2", applicant: "Kabir Sample", className: "IX", contact: "Demo family contact", source: "School office", notes: "Fictional inquiry already contacted.", status: "Contacted", createdAt: "2026-10-18T09:00:00.000Z" }
    ],
    expenses: [
      { id: "EXP-SEED-1", title: "Classroom materials", category: "Learning materials", amount: 2500, date: "2026-10-22", status: "Pending approval", submittedBy: "Demo Finance Officer", createdAt: "2026-10-22T08:30:00.000Z" },
      { id: "EXP-SEED-2", title: "Minor classroom repair", category: "Maintenance", amount: 1200, date: "2026-10-10", status: "Approved", submittedBy: "Demo Finance Officer", createdAt: "2026-10-10T09:00:00.000Z" }
    ],
    libraryBooks: [
      { id: "BOOK-1", title: "Mathematics practice workbook", subject: "Mathematics", total: 12, available: 8 },
      { id: "BOOK-2", title: "Science explorer", subject: "Science", total: 10, available: 6 },
      { id: "BOOK-3", title: "English reading anthology", subject: "English", total: 15, available: 11 }
    ],
    libraryLoans: [
      { id: "LIB-SEED-1", bookId: "BOOK-1", studentId: "STU-003", issueDate: "2026-10-12", dueDate: "2026-10-26", status: "Borrowed" }
    ],
    inventory: [
      { id: "INVTRY-1", name: "Whiteboard markers", category: "Classroom supplies", quantity: 80, unit: "markers", location: "Store room" },
      { id: "INVTRY-2", name: "Exercise books", category: "Learning materials", quantity: 240, unit: "books", location: "Office store" },
      { id: "INVTRY-3", name: "Science lab goggles", category: "Lab equipment", quantity: 32, unit: "pairs", location: "Science lab" }
    ],
    inventoryMovements: [],
    transportRoutes: [
      { id: "ROUTE-1", name: "Bilaspur town loop (demo)", vehicle: "Bus Demo-01", stops: ["School gate", "Main market", "Bus stand"], time: "07:30 AM" },
      { id: "ROUTE-2", name: "Nearby villages loop (demo)", vehicle: "Bus Demo-02", stops: ["School gate", "Village stop A", "Village stop B"], time: "07:15 AM" }
    ],
    attendanceHistory: [],
    resources: [
      { id: "RES-1", title: "Mathematics revision note", subject: "Mathematics", description: "Sample revision structure for linear equations and showing your working." },
      { id: "RES-2", title: "Science study checklist", subject: "Science", description: "Revise key terms, diagrams and short-answer questions from the current sample unit." },
      { id: "RES-3", title: "English writing guide", subject: "English", description: "Plan a paragraph with a main idea, supporting evidence and a short conclusion." }
    ],
    audit: [
      { id: "LOG-01", message: "Demo data loaded", actor: "System", date: "2026-10-22T09:00:00.000Z" }
    ]
  };
}
