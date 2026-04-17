export const DEMO_PATIENTS = [
  {
    patientId: "PT-1001",
    fullName: "Elena Martinez",
    dateOfBirth: "1988-03-14T00:00:00.000Z",
    sex: "female",
    email: "elena.martinez@example.com",
    phone: "555-210-4401",
    primaryDoctor: "Dr. Maya Chen",
    insuranceProvider: "Blue Horizon Health",
    diagnosisSummary: "Type 2 diabetes follow-up with stable A1C and medication adherence review.",
    allergies: ["Penicillin"],
    medications: [
      { name: "Metformin", dose: "500 mg", schedule: "Twice daily" },
      { name: "Lisinopril", dose: "10 mg", schedule: "Once daily" }
    ],
    notes: [
      {
        authorName: "Dr. Maya Chen",
        authorRole: "doctor",
        text: "Reviewed blood glucose trend. No acute complications. Continue current plan and repeat labs in 90 days.",
        createdAt: "2026-04-10T14:20:00.000Z"
      }
    ],
    privacyLevel: "standard",
    lastVisitAt: "2026-04-10T14:00:00.000Z",
    billingProfile: {
      payerName: "Blue Horizon Health",
      policyNumberMasked: "BH-***-4421",
      coverageStatus: "active",
      outstandingBalance: 120,
      lastClaimStatus: "submitted"
    }
  },
  {
    patientId: "PT-1002",
    fullName: "James Holloway",
    dateOfBirth: "1974-11-02T00:00:00.000Z",
    sex: "male",
    email: "james.holloway@example.com",
    phone: "555-210-4402",
    primaryDoctor: "Dr. Maya Chen",
    insuranceProvider: "Northline Mutual",
    diagnosisSummary: "Post-operative orthopedic follow-up with mobility improvement and restricted pain plan.",
    allergies: ["Latex"],
    medications: [
      { name: "Celecoxib", dose: "200 mg", schedule: "Once daily" }
    ],
    notes: [
      {
        authorName: "Dr. Maya Chen",
        authorRole: "doctor",
        text: "Patient reports improved mobility after physical therapy. Maintain activity progression and reassess in two weeks.",
        createdAt: "2026-04-12T16:05:00.000Z"
      }
    ],
    privacyLevel: "restricted",
    lastVisitAt: "2026-04-12T15:30:00.000Z",
    billingProfile: {
      payerName: "Northline Mutual",
      policyNumberMasked: "NM-***-9914",
      coverageStatus: "review",
      outstandingBalance: 450,
      lastClaimStatus: "in_review"
    }
  },
  {
    patientId: "PT-1003",
    fullName: "Ava Robinson",
    dateOfBirth: "1996-07-22T00:00:00.000Z",
    sex: "female",
    email: "ava.robinson@example.com",
    phone: "555-210-4403",
    primaryDoctor: "Dr. Owen Patel",
    insuranceProvider: "Blue Horizon Health",
    diagnosisSummary: "Asthma medication refill and preventative care review.",
    allergies: ["Shellfish"],
    medications: [
      { name: "Albuterol", dose: "90 mcg", schedule: "As needed" },
      { name: "Fluticasone", dose: "100 mcg", schedule: "Twice daily" }
    ],
    notes: [
      {
        authorName: "Dr. Owen Patel",
        authorRole: "doctor",
        text: "Symptoms controlled. Trigger review completed and refill approved.",
        createdAt: "2026-04-09T11:25:00.000Z"
      }
    ],
    privacyLevel: "standard",
    lastVisitAt: "2026-04-09T11:00:00.000Z",
    billingProfile: {
      payerName: "Blue Horizon Health",
      policyNumberMasked: "BH-***-1183",
      coverageStatus: "active",
      outstandingBalance: 0,
      lastClaimStatus: "paid"
    }
  }
];

export const DEMO_CLAIMS = [
  {
    claimNumber: "CLM-3001",
    patientId: "PT-1001",
    payerName: "Blue Horizon Health",
    amount: 215,
    procedureCode: "99214",
    diagnosisCode: "E11.9",
    status: "submitted",
    submittedAt: "2026-04-10T18:00:00.000Z",
    clinicianNote: "Routine diabetes follow-up with lab review.",
    insurerNote: "Awaiting payer review.",
    updatedByRole: "doctor",
    updatedByName: "Dr. Maya Chen"
  },
  {
    claimNumber: "CLM-3002",
    patientId: "PT-1002",
    payerName: "Northline Mutual",
    amount: 860,
    procedureCode: "27447",
    diagnosisCode: "Z47.1",
    status: "in_review",
    submittedAt: "2026-04-12T20:10:00.000Z",
    clinicianNote: "Post-operative review and care plan update.",
    insurerNote: "Reviewing therapy authorization detail.",
    updatedByRole: "insurer",
    updatedByName: "Coverage Analyst"
  },
  {
    claimNumber: "CLM-3003",
    patientId: "PT-1003",
    payerName: "Blue Horizon Health",
    amount: 140,
    procedureCode: "99213",
    diagnosisCode: "J45.909",
    status: "paid",
    submittedAt: "2026-04-09T15:10:00.000Z",
    coverageDecisionAt: "2026-04-11T10:20:00.000Z",
    clinicianNote: "Medication refill visit.",
    insurerNote: "Paid according to standard benefit schedule.",
    updatedByRole: "insurer",
    updatedByName: "Claims Reviewer"
  }
];

export const PRIVACY_SAFEGUARDS = [
  {
    id: "segregated-access",
    title: "Role-separated access",
    detail: "Doctors can view and edit clinical records. Insurance providers are limited to claims and billing data only.",
    status: "implemented"
  },
  {
    id: "audit-trail",
    title: "Access audit trail",
    detail: "Every login, chart access, clinical update, and billing decision is written to an audit log for review.",
    status: "implemented"
  },
  {
    id: "kms-cmk",
    title: "Encryption at rest with customer-managed keys",
    detail: "The AWS deployment uses KMS customer-managed keys to protect patient data stores, secrets, and log retention paths.",
    status: "implemented"
  },
  {
    id: "private-network",
    title: "Private network zones",
    detail: "The app tier and database tier stay in private subnets while the public load balancer is the only internet-facing entry point.",
    status: "implemented"
  }
];

export const ROLE_ACCESS_MATRIX = [
  {
    role: "doctor",
    clinicalRecords: "view_edit",
    billingClaims: "view_submit",
    auditTrail: "view_limited",
    userManagement: "none"
  },
  {
    role: "insurer",
    clinicalRecords: "none",
    billingClaims: "view_update",
    auditTrail: "view_own",
    userManagement: "none"
  },
  {
    role: "admin",
    clinicalRecords: "view",
    billingClaims: "view",
    auditTrail: "view_all",
    userManagement: "seed_demo"
  }
];

export const COMPLIANCE_FAMILIES = [
  {
    family: "AC",
    title: "Access Control",
    summary: "Role-based separation between doctors and insurance providers, least privilege in the application, and cloud IAM separation in AWS.",
    mappedControls: ["AC-2 Account Management", "AC-3 Access Enforcement", "AC-6 Least Privilege"],
    evidence: ["Role-based route guards", "Doctor-only patient record APIs", "Insurer-only claim adjudication actions", "Terraform IAM role separation"]
  },
  {
    family: "AU",
    title: "Audit and Accountability",
    summary: "The portal records authentication, patient chart access, billing actions, and admin demo operations to support HIPAA-ready review.",
    mappedControls: ["AU-2 Event Logging", "AU-3 Content of Audit Records", "AU-6 Audit Review"],
    evidence: ["AuditEvent collection", "Access log timeline in the UI", "Structured metadata with actor, patient, action, and timestamp"]
  }
];

export const DEMO_ROLE_GUIDE = [
  {
    role: "doctor",
    title: "Clinical workflow",
    summary: "Review patient records, add chart notes, update medications, and submit claims after a visit."
  },
  {
    role: "insurer",
    title: "Billing workflow",
    summary: "See billing details only, review submitted claims, and approve or deny coverage without accessing clinical notes."
  }
];
