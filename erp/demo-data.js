export const DEMO_PASSWORD = "Demo@12345";
export const DEMO_STORAGE_KEY = "saraswati-erp-demo-v1";
export const DEMO_CLASS_LIST = ["X-A", "IX-A", "VIII-A"];

export const DEMO_ACCOUNTS = [
  { email: "principal@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Principal", role: "admin" },
  { email: "finance@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Finance Officer", role: "finance" },
  { email: "teacher@demo.saraswati.test", password: DEMO_PASSWORD, fullName: "Demo Class Teacher", role: "teacher" },
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
    audit: [
      { id: "LOG-01", message: "Demo data loaded", actor: "System", date: "2026-10-22T09:00:00.000Z" }
    ]
  };
}
