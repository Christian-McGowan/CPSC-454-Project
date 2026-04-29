import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const INITIAL_AUTH = {
  name: "",
  email: "",
  password: "",
  role: "doctor",
  organization: "AegisCare Network"
};

const INITIAL_PATIENT_FORM = {
  diagnosisSummary: "",
  addNote: ""
};

const INITIAL_CLAIM_FORM = {
  patientId: "",
  amount: "",
  procedureCode: "",
  diagnosisCode: "",
  clinicianNote: ""
};

const ASSESSMENT_FINDINGS = [
  {
    id: "F-01",
    threat: "Public self-registration can bypass account provisioning",
    status: "Remediated in code",
    evidence:
      "ALLOW_PUBLIC_REGISTRATION defaults to false; seeded users are provisioned by the backend seed script.",
    remediation:
      "Keep public registration disabled in production and document admin-created accounts in the README.",
    control: "NIST AC-2, AC-3"
  },
  {
    id: "F-02",
    threat: "Insurer role could view audit activity",
    status: "Remediated in code",
    evidence:
      "Audit route now requires doctor or admin, and the insurer navigation no longer exposes the Audit Trail tab.",
    remediation:
      "Use the insurer demo account to screenshot the missing Patient Records and Audit Trail tabs.",
    control: "NIST AC-3, AC-6"
  },
  {
    id: "F-03",
    threat: "Demo data seeding could be triggered by non-admin workflows",
    status: "Remediated in code",
    evidence:
      "Automatic seeding was removed from summary, patient, and claim routes. Admin bootstrap remains protected.",
    remediation: "Seed demo data from the Admin tab before presenting the user workflow.",
    control: "NIST AC-2, CM-6"
  },
  {
    id: "F-04",
    threat: "Audit trail needed stronger tamper-resistance evidence",
    status: "Improved in code",
    evidence:
      "Audit events are append-only through application hooks and mirrored to stdout for ECS/CloudWatch collection.",
    remediation:
      "For production, forward audit events to immutable S3 Object Lock or CloudTrail Lake.",
    control: "NIST AU-2, AU-3, AU-9"
  },
  {
    id: "F-05",
    threat: "Private workloads could still depend on public AWS service endpoints",
    status: "Improved in Terraform",
    evidence:
      "Interface endpoints were added for ECR, ECS, Logs, KMS, Secrets Manager, and SSM; an S3 gateway endpoint was added.",
    remediation:
      "Capture Terraform plan/apply evidence and show endpoint resources in the AWS console.",
    control: "NIST SC-7, SC-13"
  }
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function roleLabel(role) {
  return (
    {
      doctor: "Doctor",
      insurer: "Insurance provider",
      admin: "Admin"
    }[role] || role
  );
}

function statusTone(status) {
  return (
    {
      draft: "muted",
      submitted: "info",
      in_review: "warning",
      approved: "success",
      denied: "danger",
      paid: "success"
    }[status] || "muted"
  );
}

function privacyTone(level) {
  return level === "restricted" ? "warning" : "success";
}

function Alert({ tone = "error", children }) {
  return <div className={`alert ${tone}`}>{children}</div>;
}

function Badge({ tone = "muted", children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function SectionHeader({ eyebrow, title, body, action }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <span className="eyebrow-pill">{eyebrow}</span>}
        <h2>{title}</h2>
        {body && <p>{body}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function ActivityItem({ item }) {
  return (
    <div className="activity-item">
      <div>
        <strong>{item.action.replace(/\./g, " ")}</strong>
        <p>
          {item.details || "Portal activity recorded"}
          {item.patientName ? ` • ${item.patientName}` : ""}
        </p>
      </div>
      <div className="activity-meta">
        <Badge tone={item.outcome === "denied" ? "danger" : "muted"}>
          {item.actorRole || "system"}
        </Badge>
        <span>{formatDateTime(item.createdAt)}</span>
      </div>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(INITIAL_AUTH);
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientForm, setPatientForm] = useState(INITIAL_PATIENT_FORM);
  const [claims, setClaims] = useState([]);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [claimForm, setClaimForm] = useState(INITIAL_CLAIM_FORM);
  const [claimUpdate, setClaimUpdate] = useState({
    status: "",
    insurerNote: "",
    clinicianNote: ""
  });
  const [privacyOverview, setPrivacyOverview] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [claimQuery, setClaimQuery] = useState("");

  const canViewPatients = user && ["doctor", "admin"].includes(user.role);
  const canCreateClaims = user && ["doctor", "admin"].includes(user.role);
  const canReviewClaims = user && ["insurer", "admin"].includes(user.role);
  const isAdmin = user?.role === "admin";

  const navItems = useMemo(() => {
    const items = [
      { id: "overview", label: "Overview" },
      { id: "patients", label: "Patient records" },
      { id: "billing", label: "Billing" },
      { id: "privacy", label: "Privacy center" }
    ];

    if (["doctor", "admin"].includes(user?.role)) {
      items.splice(3, 0, { id: "audit", label: "Audit trail" });
    }

    if (isAdmin) {
      items.push({ id: "admin", label: "Demo admin" });
    }

    return items;
  }, [isAdmin, user?.role]);

  const selectedPatient =
    patients.find((item) => item._id === selectedPatientId || item.id === selectedPatientId) ||
    null;

  const selectedClaim =
    claims.find((item) => item._id === selectedClaimId || item.id === selectedClaimId) || null;

  async function loadPortalData(currentUser = user) {
    if (!currentUser) return;

    setBusy(true);
    setError("");

    try {
      const canAccessAudit = ["doctor", "admin"].includes(currentUser.role);
      const requests = [api.portalSummary(), api.listClaims({ q: claimQuery }), api.privacyOverview()];

      if (canAccessAudit) {
        requests.push(api.listAuditEvents());
      }

      if (["doctor", "admin"].includes(currentUser.role)) {
        requests.push(api.listPatients({ q: patientQuery }));
      }

      const [summaryData, claimsData, privacyData, maybeAuditData, maybePatientsData] =
        await Promise.all(requests);

      const auditData = canAccessAudit ? maybeAuditData : { items: [] };
      const patientsData = canAccessAudit ? maybePatientsData : maybeAuditData;

      setSummary(summaryData);
      setClaims(claimsData.items || []);
      setPrivacyOverview(privacyData);
      setAuditEvents(auditData.items || []);

      if (patientsData) {
        setPatients(patientsData.items || []);
        const nextPatient = patientsData.items?.[0]?._id || "";
        setSelectedPatientId((existing) => existing || nextPatient);

        const firstPatient =
          patientsData.items?.find((item) => item._id === (selectedPatientId || nextPatient)) ||
          patientsData.items?.[0];

        setPatientForm({
          diagnosisSummary: firstPatient?.diagnosisSummary || "",
          addNote: ""
        });
      } else {
        setPatients([]);
        setSelectedPatientId("");
      }

      const nextClaim = claimsData.items?.[0]?._id || "";
      setSelectedClaimId((existing) => existing || nextClaim);

      const firstClaim =
        claimsData.items?.find((item) => item._id === (selectedClaimId || nextClaim)) ||
        claimsData.items?.[0];

      setClaimUpdate({
        status: firstClaim?.status || "",
        insurerNote: firstClaim?.insurerNote || "",
        clinicianNote: firstClaim?.clinicianNote || ""
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    Promise.allSettled([api.passwordPolicy(), api.me()])
      .then(([policyResult, meResult]) => {
        if (policyResult.status === "fulfilled") {
          setPasswordPolicy(policyResult.value.policy);
          setAllowSelfRegistration(Boolean(policyResult.value.publicRegistrationEnabled));
        }

        if (meResult.status === "fulfilled") {
          setUser(meResult.value.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!allowSelfRegistration && authMode === "register") {
      setAuthMode("login");
    }
  }, [allowSelfRegistration, authMode]);

  useEffect(() => {
    if (user) {
      loadPortalData(user);
    }
  }, [user]);

  useEffect(() => {
    if (selectedPatient) {
      setPatientForm({
        diagnosisSummary: selectedPatient.diagnosisSummary || "",
        addNote: ""
      });
    }
  }, [selectedPatientId, patients.length]);

  useEffect(() => {
    if (selectedClaim) {
      setClaimUpdate({
        status: selectedClaim.status || "",
        insurerNote: selectedClaim.insurerNote || "",
        clinicianNote: selectedClaim.clinicianNote || ""
      });
    }
  }, [selectedClaimId, claims.length]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response =
        authMode === "login"
          ? await api.login({
              email: authForm.email,
              password: authForm.password
            })
          : await api.register({
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
              role: authForm.role,
              organization: authForm.organization
            });

      setUser(response.user);
      setAuthForm(INITIAL_AUTH);
      setNotice(authMode === "login" ? "Welcome back." : "Account created. You are now signed in.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");

    try {
      await api.logout();
      setUser(null);
      setSummary(null);
      setPatients([]);
      setClaims([]);
      setAuditEvents([]);
      setActiveTab("overview");
      setNotice("You have been signed out.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePatientSave(event) {
    event.preventDefault();
    if (!selectedPatient) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api.updatePatient(selectedPatient._id, patientForm);
      setNotice("Patient chart updated.");
      await loadPortalData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimCreate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api.createClaim({
        ...claimForm,
        amount: Number(claimForm.amount)
      });
      setClaimForm(INITIAL_CLAIM_FORM);
      setNotice("Claim submitted to the billing queue.");
      await loadPortalData();
      setActiveTab("billing");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimUpdate(event) {
    event.preventDefault();
    if (!selectedClaim) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const payload = Object.fromEntries(
        Object.entries(claimUpdate).filter(([, value]) => value !== "")
      );
      await api.updateClaim(selectedClaim._id, payload);
      setNotice("Billing workflow updated.");
      await loadPortalData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrapDemo() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await api.bootstrapDemo();
      setNotice(
        `${result.message}. ${result.counts.patients} patients and ${result.counts.claims} claims are available.`
      );
      await loadPortalData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="screen-shell loading-shell">Loading portal…</div>;
  }

  if (!user) {
    return (
      <div className="screen-shell public-shell">
        <header className="public-nav">
          <div className="brand-lockup">
            <div className="brand-mark">AC</div>
            <div>
              <strong>AegisCare</strong>
              <span>HIPAA-focused healthcare portal</span>
            </div>
          </div>
          <nav>
            <a href="#workflow">How it works</a>
          </nav>
        </header>

        <main className="public-main">
          <section className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow-pill">Patient records with privacy by default</span>
              <h1>Clinical records for doctors. Billing views for insurers. One audited portal.</h1>
              <p>
                AegisCare keeps patient charts, claims, and audit history in one place while
                preventing the wrong role from seeing the wrong data.
              </p>
              <div className="hero-points">
                <span>KMS-backed storage</span>
                <span>Role-separated access</span>
                <span>Audit trail for every chart touch</span>
              </div>
            </div>

            <div className="auth-panel" id="access">
              <div className="auth-tabs">
                <button
                  type="button"
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>

                <button
                  type="button"
                  className={authMode === "register" ? "active" : ""}
                  onClick={() => allowSelfRegistration && setAuthMode("register")}
                  disabled={!allowSelfRegistration}
                  title={
                    !allowSelfRegistration
                      ? "Set ALLOW_PUBLIC_REGISTRATION=true in backend/.env to enable self-registration."
                      : undefined
                  }
                >
                  Register
                </button>
              </div>

              <div className="auth-copy">
                <h2>
                  {authMode === "login"
                    ? "Access the portal"
                    : allowSelfRegistration
                      ? "Create an account"
                      : "Seeded access only"}
                </h2>
                <p>
                  {authMode === "login"
                    ? "Sign in as a doctor, insurer, or admin to walk through the portal workflow."
                    : allowSelfRegistration
                      ? "Register as a doctor or insurer to test the access separation built into the application."
                      : "Public self-registration is disabled by default so accounts are provisioned through the seeded demo or an admin-controlled process."}
                </p>
              </div>

              {error && <Alert>{error}</Alert>}
              {notice && <Alert tone="success">{notice}</Alert>}

              <form className="auth-form" onSubmit={handleAuthSubmit}>
                {authMode === "register" && (
                  <>
                    <label>
                      Name
                      <input
                        value={authForm.name}
                        onChange={(event) =>
                          setAuthForm((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={authForm.role}
                        onChange={(event) =>
                          setAuthForm((current) => ({
                            ...current,
                            role: event.target.value
                          }))
                        }
                      >
                        <option value="doctor">Doctor</option>
                        <option value="insurer">Insurance provider</option>
                      </select>
                    </label>
                  </>
                )}

                <label>
                  Email
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        email: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        password: event.target.value
                      }))
                    }
                  />
                </label>

                {authMode === "register" && (
                  <label>
                    Organization
                    <input
                      value={authForm.organization}
                      onChange={(event) =>
                        setAuthForm((current) => ({
                          ...current,
                          organization: event.target.value
                        }))
                      }
                    />
                  </label>
                )}

                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? "Working…" : authMode === "login" ? "Enter portal" : "Create account"}
                </button>
              </form>

              {passwordPolicy && (
                <div className="policy-card">
                  <strong>Password policy</strong>
                  <ul>
                    {passwordPolicy.hints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="info-grid" id="workflow">
            <article className="info-card">
              <span className="step-pill">01</span>
              <h3>Doctors manage the chart</h3>
              <p>
                Review diagnoses, medications, allergies, and encounter notes from a single patient
                view.
              </p>
            </article>
            <article className="info-card">
              <span className="step-pill">02</span>
              <h3>Insurers stay in billing only</h3>
              <p>
                Claims can be reviewed and updated without exposing clinical notes or detailed chart
                history.
              </p>
            </article>
            <article className="info-card">
              <span className="step-pill">03</span>
              <h3>Every action is logged</h3>
              <p>
                Logins, chart opens, edits, and claim decisions are written to the audit timeline
                for review.
              </p>
            </article>
          </section>

          <section className="split-panel" id="privacy">
            <div>
              <span className="eyebrow-pill">Privacy controls</span>
              <h2>Built for HIPAA-style access separation</h2>
              <p>
                The app demonstrates NIST access control and audit ideas through role-based
                permissions, KMS-backed storage in AWS, and a visible audit trail inside the
                product.
              </p>
            </div>
            <div className="safeguard-stack">
              <div className="mini-card">
                <strong>Doctors</strong>
                <p>View and edit patient records. Submit claims after care is documented.</p>
              </div>
              <div className="mini-card">
                <strong>Insurance providers</strong>
                <p>Review claim amounts and statuses only. No chart details, notes, or medication access.</p>
              </div>
              <div className="mini-card">
                <strong>Audit visibility</strong>
                <p>
                  Sensitive actions record who did it, when it happened, and which patient or claim
                  it touched; doctor/admin users review the audit trail.
                </p>
              </div>
            </div>
          </section>

          <section className="role-guide" id="roles">
            <div className="role-callout">
              <h3>Suggested demo roles</h3>
              <p>
                Use the seeded accounts to show role separation in real time. Public registration is
                disabled unless ALLOW_PUBLIC_REGISTRATION is set to true for a test run.
              </p>
            </div>
            <div className="role-chip-row">
              <span>doctor.demo@aegiscare.local / DoctorDemo1</span>
              <span>insurer.demo@aegiscare.local / InsurerDemo1</span>
              <span>Admin from backend .env</span>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="screen-shell app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">AC</div>
          <div>
            <strong>AegisCare</strong>
            <span>Healthcare privacy portal</span>
          </div>
        </div>
        <div className="header-actions">
          <Badge
            tone={user.role === "doctor" ? "info" : user.role === "insurer" ? "warning" : "success"}
          >
            {roleLabel(user.role)}
          </Badge>
          <span className="last-login">Last login {formatDateTime(user.lastLoginAt)}</span>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tab-bar">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeTab === item.id ? "active" : ""}
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {(error || notice) && (
        <div className="message-stack">
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
        </div>
      )}

      {activeTab === "overview" && summary && (
        <main className="app-main">
          <section className="overview-hero">
            <div className="hero-copy-panel">
              <span className="eyebrow-pill">Live portal workspace</span>
              <h1>{summary.hero.title}</h1>
              <p>{summary.hero.body}</p>
              <div className="hero-points compact">
                <span>Doctors keep the chart current</span>
                <span>Insurers stay in the billing lane</span>
                <span>Audit history follows every action</span>
              </div>
            </div>
            <div className="hero-side-panel">
              <h3>A Sample demo</h3>
              <ul>
                <li>Open a patient record as a doctor and add a chart note.</li>
                <li>Switch to Billing and show the claim queue.</li>
                <li>Log in as an insurer and prove the chart is hidden.</li>
                {["doctor", "admin"].includes(user.role) && (
                  <li>Open Audit Trail to show that access was recorded.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="stats-grid">
            {summary.stats.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} helper={item.helper} />
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel-card">
              <SectionHeader
                eyebrow="Spotlight"
                title={user.role === "insurer" ? "Billing roster" : "Patient roster"}
                body="A quick slice of the data you should review first."
              />
              <div className="stack-list">
                {summary.spotlight.map((item) => (
                  <div className="list-row" key={item._id || item.id || item.patientId}>
                    <div>
                      <strong>{item.fullName}</strong>
                      <p>
                        {item.patientId} • {item.insuranceProvider}
                      </p>
                    </div>
                    <div className="row-meta">
                      {item.privacyLevel && <Badge tone={privacyTone(item.privacyLevel)}>{item.privacyLevel}</Badge>}
                      <span>{formatCurrency(item.billingProfile?.outstandingBalance || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <SectionHeader
                eyebrow={user.role === "insurer" ? "Recent billing activity" : "Recent activity"}
                title={user.role === "insurer" ? "Recent claim activity" : "Audit timeline"}
                body={
                  user.role === "insurer"
                    ? "Recent claim updates that stay inside the billing workflow."
                    : "The latest sensitive actions captured by the portal."
                }
              />
              <div className="activity-list">
                {summary.recentActivity.length ? (
                  summary.recentActivity.map((item) => <ActivityItem key={item._id} item={item} />)
                ) : (
                  <EmptyState
                    title={user.role === "insurer" ? "No claim activity yet" : "No audit activity yet"}
                    body={
                      user.role === "insurer"
                        ? "Use the billing workflow to generate recent claim updates."
                        : "Use the portal to generate access records."
                    }
                  />
                )}
              </div>
            </article>
          </section>
        </main>
      )}

      {activeTab === "patients" && (
        <main className="app-main section-layout">
          {canViewPatients ? (
            <>
              <section className="sidebar-panel">
                <SectionHeader
                  eyebrow="Clinical access"
                  title="Patient records"
                  body="Search the chart list and open a record for review."
                />
                <label className="inline-label">
                  Search
                  <input
                    value={patientQuery}
                    onChange={(event) => setPatientQuery(event.target.value)}
                    placeholder="Name, patient ID, diagnosis"
                  />
                </label>
                <button
                  className="ghost-button full"
                  type="button"
                  onClick={() => loadPortalData()}
                  disabled={busy}
                >
                  Refresh list
                </button>
                <div className="stack-list selectable-list">
                  {patients.map((patient) => (
                    <button
                      key={patient._id}
                      type="button"
                      className={selectedPatientId === patient._id ? "selected" : ""}
                      onClick={() => setSelectedPatientId(patient._id)}
                    >
                      <strong>{patient.fullName}</strong>
                      <span>{patient.patientId}</span>
                      <div className="row-meta">
                        <Badge tone={privacyTone(patient.privacyLevel)}>{patient.privacyLevel}</Badge>
                        <span>{formatDate(patient.lastVisitAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="detail-panel">
                {selectedPatient ? (
                  <>
                    <SectionHeader
                      eyebrow={selectedPatient.patientId}
                      title={selectedPatient.fullName}
                      body={`${selectedPatient.primaryDoctor} • ${selectedPatient.insuranceProvider}`}
                    />
                    <div className="detail-grid">
                      <article className="panel-card">
                        <h3>Record summary</h3>
                        <p>{selectedPatient.diagnosisSummary}</p>
                        <div className="bullet-stack">
                          <span>
                            <strong>Date of birth:</strong> {formatDate(selectedPatient.dateOfBirth)}
                          </span>
                          <span>
                            <strong>Allergies:</strong>{" "}
                            {selectedPatient.allergies?.join(", ") || "None recorded"}
                          </span>
                          <span>
                            <strong>Last visit:</strong> {formatDateTime(selectedPatient.lastVisitAt)}
                          </span>
                          <span>
                            <strong>Coverage:</strong> {selectedPatient.billingProfile?.coverageStatus}
                          </span>
                        </div>
                      </article>
                      <article className="panel-card">
                        <h3>Medications</h3>
                        <div className="stack-list mini-gap">
                          {(selectedPatient.medications || []).map((medication) => (
                            <div
                              key={`${medication.name}-${medication.dose}`}
                              className="list-row compact"
                            >
                              <div>
                                <strong>{medication.name}</strong>
                                <p>
                                  {medication.dose} • {medication.schedule}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    </div>

                    <article className="panel-card form-card">
                      <h3>Update chart</h3>
                      <form className="stack-form" onSubmit={handlePatientSave}>
                        <label>
                          Diagnosis summary
                          <textarea
                            rows="4"
                            value={patientForm.diagnosisSummary}
                            onChange={(event) =>
                              setPatientForm((current) => ({
                                ...current,
                                diagnosisSummary: event.target.value
                              }))
                            }
                          />
                        </label>
                        <label>
                          Add care note
                          <textarea
                            rows="4"
                            value={patientForm.addNote}
                            onChange={(event) =>
                              setPatientForm((current) => ({
                                ...current,
                                addNote: event.target.value
                              }))
                            }
                            placeholder="Document what changed during the visit or follow-up."
                          />
                        </label>
                        <button className="primary-button" type="submit" disabled={busy}>
                          Save chart update
                        </button>
                      </form>
                    </article>

                    <article className="panel-card">
                      <h3>Care notes</h3>
                      <div className="activity-list">
                        {(selectedPatient.notes || []).map((note, index) => (
                          <div
                            className="activity-item"
                            key={`${note.authorName}-${note.createdAt || index}`}
                          >
                            <div>
                              <strong>{note.authorName}</strong>
                              <p>{note.text}</p>
                            </div>
                            <div className="activity-meta">
                              <Badge tone={note.authorRole === "doctor" ? "info" : "muted"}>
                                {note.authorRole}
                              </Badge>
                              <span>{formatDateTime(note.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  </>
                ) : (
                  <EmptyState
                    title="No patient selected"
                    body="Choose a patient from the left to open the chart."
                  />
                )}
              </section>
            </>
          ) : (
            <section className="panel-card restricted-card">
              <SectionHeader
                eyebrow="Access boundary"
                title="Patient charts are hidden for this role"
                body="Insurance providers can review claims and balances, but the clinical record stays closed."
              />
              <p>Switch to the Billing tab to review the payer workflow that is allowed for your role.</p>
            </section>
          )}
        </main>
      )}

      {activeTab === "billing" && (
        <main className="app-main section-layout">
          <section className="sidebar-panel">
            <SectionHeader
              eyebrow="Billing lane"
              title="Claims queue"
              body="Review the active claim list and open one for more detail."
            />
            <label className="inline-label">
              Search
              <input
                value={claimQuery}
                onChange={(event) => setClaimQuery(event.target.value)}
                placeholder="Claim number, payer, patient"
              />
            </label>
            <button
              className="ghost-button full"
              type="button"
              onClick={() => loadPortalData()}
              disabled={busy}
            >
              Refresh claims
            </button>
            <div className="stack-list selectable-list">
              {claims.map((claim) => (
                <button
                  key={claim._id}
                  type="button"
                  className={selectedClaimId === claim._id ? "selected" : ""}
                  onClick={() => setSelectedClaimId(claim._id)}
                >
                  <strong>{claim.claimNumber}</strong>
                  <span>{claim.patientName}</span>
                  <div className="row-meta">
                    <Badge tone={statusTone(claim.status)}>{claim.status.replace("_", " ")}</Badge>
                    <span>{formatCurrency(claim.amount)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="detail-panel">
            {selectedClaim ? (
              <>
                <SectionHeader
                  eyebrow={selectedClaim.claimNumber}
                  title={`${selectedClaim.patientName} • ${selectedClaim.payerName}`}
                  body={`Procedure ${selectedClaim.procedureCode} • Diagnosis ${selectedClaim.diagnosisCode}`}
                />
                <div className="detail-grid">
                  <article className="panel-card">
                    <h3>Claim summary</h3>
                    <div className="bullet-stack">
                      <span>
                        <strong>Status:</strong> {selectedClaim.status.replace("_", " ")}
                      </span>
                      <span>
                        <strong>Amount:</strong> {formatCurrency(selectedClaim.amount)}
                      </span>
                      <span>
                        <strong>Submitted:</strong> {formatDateTime(selectedClaim.submittedAt)}
                      </span>
                      <span>
                        <strong>Last updated by:</strong> {selectedClaim.updatedByName || "—"}
                      </span>
                    </div>
                  </article>
                  <article className="panel-card">
                    <h3>Notes</h3>
                    <p>
                      <strong>Clinical note:</strong> {selectedClaim.clinicianNote || "None"}
                    </p>
                    <p>
                      <strong>Insurer note:</strong> {selectedClaim.insurerNote || "None"}
                    </p>
                  </article>
                </div>

                <article className="panel-card form-card">
                  <h3>{canReviewClaims ? "Review claim" : "Update claim detail"}</h3>
                  <form className="stack-form" onSubmit={handleClaimUpdate}>
                    <label>
                      Status
                      <select
                        value={claimUpdate.status}
                        onChange={(event) =>
                          setClaimUpdate((current) => ({
                            ...current,
                            status: event.target.value
                          }))
                        }
                      >
                        <option value="">Leave unchanged</option>
                        {["draft", "submitted", "in_review", "approved", "denied", "paid"].map(
                          (status) => (
                            <option key={status} value={status}>
                              {status.replace("_", " ")}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    {canReviewClaims && (
                      <label>
                        Insurer note
                        <textarea
                          rows="4"
                          value={claimUpdate.insurerNote}
                          onChange={(event) =>
                            setClaimUpdate((current) => ({
                              ...current,
                              insurerNote: event.target.value
                            }))
                          }
                        />
                      </label>
                    )}
                    {canCreateClaims && (
                      <label>
                        Clinical note
                        <textarea
                          rows="4"
                          value={claimUpdate.clinicianNote}
                          onChange={(event) =>
                            setClaimUpdate((current) => ({
                              ...current,
                              clinicianNote: event.target.value
                            }))
                          }
                        />
                      </label>
                    )}
                    <button className="primary-button" type="submit" disabled={busy}>
                      Save billing update
                    </button>
                  </form>
                </article>

                {canCreateClaims && (
                  <article className="panel-card form-card">
                    <h3>Create a new claim</h3>
                    <form className="stack-form two-col" onSubmit={handleClaimCreate}>
                      <label>
                        Patient ID
                        <input
                          value={claimForm.patientId}
                          onChange={(event) =>
                            setClaimForm((current) => ({
                              ...current,
                              patientId: event.target.value
                            }))
                          }
                          placeholder="PT-1001"
                        />
                      </label>
                      <label>
                        Amount
                        <input
                          value={claimForm.amount}
                          onChange={(event) =>
                            setClaimForm((current) => ({
                              ...current,
                              amount: event.target.value
                            }))
                          }
                          placeholder="250"
                        />
                      </label>
                      <label>
                        Procedure code
                        <input
                          value={claimForm.procedureCode}
                          onChange={(event) =>
                            setClaimForm((current) => ({
                              ...current,
                              procedureCode: event.target.value
                            }))
                          }
                          placeholder="99214"
                        />
                      </label>
                      <label>
                        Diagnosis code
                        <input
                          value={claimForm.diagnosisCode}
                          onChange={(event) =>
                            setClaimForm((current) => ({
                              ...current,
                              diagnosisCode: event.target.value
                            }))
                          }
                          placeholder="E11.9"
                        />
                      </label>
                      <label className="full-span">
                        Clinical note
                        <textarea
                          rows="4"
                          value={claimForm.clinicianNote}
                          onChange={(event) =>
                            setClaimForm((current) => ({
                              ...current,
                              clinicianNote: event.target.value
                            }))
                          }
                        />
                      </label>
                      <button className="primary-button full-span" type="submit" disabled={busy}>
                        Submit new claim
                      </button>
                    </form>
                  </article>
                )}
              </>
            ) : (
              <EmptyState
                title="No claim selected"
                body="Choose a claim from the left to inspect billing details."
              />
            )}
          </section>
        </main>
      )}

      {activeTab === "audit" && (
        <main className="app-main">
          <section className="panel-card">
            <SectionHeader
              eyebrow="Audit family"
              title="Access history"
              body="This log shows who entered the portal, opened a chart, or changed billing data."
              action={
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => loadPortalData()}
                  disabled={busy}
                >
                  Refresh
                </button>
              }
            />
            <div className="activity-list">
              {auditEvents.length ? (
                auditEvents.map((item) => <ActivityItem key={item._id} item={item} />)
              ) : (
                <EmptyState
                  title="No audit activity yet"
                  body="Use the portal to generate access records."
                />
              )}
            </div>
          </section>
        </main>
      )}

      {activeTab === "privacy" && privacyOverview && (
        <main className="app-main">
          <section className="dashboard-grid single-top-gap">
            <article className="panel-card">
              <SectionHeader
                eyebrow="Safeguards"
                title="Privacy controls in the product"
                body="These are the controls the demo is meant to show during the assignment."
              />
              <div className="stack-list">
                {privacyOverview.safeguards.map((item) => (
                  <div key={item.id} className="list-row compact">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <Badge tone={item.status === "implemented" ? "success" : "warning"}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <SectionHeader
                eyebrow="Role access"
                title="Who can do what"
                body="This matrix is the easiest way to explain the IAM-style separation in the application."
              />
              <div className="role-matrix">
                {privacyOverview.roleMatrix.map((row) => (
                  <div key={row.role} className="matrix-row">
                    <strong>{roleLabel(row.role)}</strong>
                    <span>Clinical: {row.clinicalRecords}</span>
                    <span>Billing: {row.billingClaims}</span>
                    <span>Audit: {row.auditTrail}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel-card">
            <SectionHeader
              eyebrow="NIST mapping"
              title="HIPAA-aligned AC and AU families"
              body="Access control keeps the right people in the right lanes, and audit records prove what happened."
            />
            <div className="stack-list">
              {privacyOverview.complianceFamilies.map((family) => (
                <div key={family.family} className="list-row wide-row">
                  <div>
                    <strong>
                      {family.family} — {family.title}
                    </strong>
                    <p>{family.summary}</p>
                    <div className="chip-row">
                      {family.mappedControls.map((control) => (
                        <Badge key={control}>{control}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="evidence-col">
                    {family.evidence.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {activeTab === "assessment" && isAdmin && <SecurityAssessment />}

      {activeTab === "admin" && isAdmin && (
        <main className="app-main">
          <section className="panel-card admin-card">
            <SectionHeader
              eyebrow="Admin tools"
              title="Demo controls"
              body="Use this button if you want to reseed the portal with the sample patients and claims used in the demo."
            />
            <button className="primary-button" type="button" onClick={handleBootstrapDemo} disabled={busy}>
              Load or refresh demo data
            </button>
            <div className="bullet-stack top-gap">
              <span>
                <strong>Doctor demo:</strong> doctor.demo@aegiscare.local / DoctorDemo1
              </span>
              <span>
                <strong>Insurer demo:</strong> insurer.demo@aegiscare.local / InsurerDemo1
              </span>
              <span>
                <strong>Tip:</strong> log in as doctor first, update a chart, then switch to the
                insurer account and show that the chart is hidden while the claim is still visible.
              </span>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}