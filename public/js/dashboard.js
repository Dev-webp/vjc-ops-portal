(async () => {
  // =========================================================
  // VJC OPS DASHBOARD
  // Dashboard UI only
  // Existing API + sidebar functionality preserved
  // =========================================================

  const $ = (id) => document.getElementById(id);

  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatDate(dateValue) {
    if (!dateValue) return '-';

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function statusClass(status) {
    const value = String(status || '').toUpperCase();

    if (value === 'APPROVED') return 'approved';
    if (value === 'PENDING') return 'pending';

    return 'rejected';
  }

  function setText(id, value) {
    const el = $(id);
    if (el) {
      el.textContent = value;
    }
  }

  function setHTML(id, html) {
    const el = $(id);
    if (el) {
      el.innerHTML = html;
    }
  }

  // =========================================================
  // SIDEBAR
  // =========================================================

  const currentUser = await renderSidebar('dashboard');

  // =========================================================
// HEADER
// =========================================================

if (currentUser) {
  const displayName = currentUser.name || 'User';

  // Main dashboard heading
  setText(
    'dashboardName',
    `${displayName} 👋`
  );

  // Welcome message
  setText(
    'dashboardGreeting',
    `Welcome back, ${displayName}. Here's your latest operations overview.`
  );
}
const now = new Date();

setText(
  'dashboardDate',
  now.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
);

setText(
  'dashboardTime',
  now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
);
  // =========================================================
  // LOAD DASHBOARD DATA
  // =========================================================

  try {
    const response = await apiFetch('/dashboard/stats');

    const stats = response || {};

    const leads = stats.leads || {};
    const audits = stats.audits || {};
    const cases = stats.cases || {};

    // =======================================================
    // NUMBERS
    // =======================================================

    const totalLeads = safeNumber(leads.total);

    const pendingAudit = safeNumber(audits.pending);
    const auditApproved = safeNumber(audits.approved);
    const auditRejected = safeNumber(audits.rejected);

    const totalCases = safeNumber(cases.total);
    const completedCases = safeNumber(cases.completed);
    const rejectedCases = safeNumber(cases.rejected);
    const inProgressCases = safeNumber(cases.inProgress);

    // =======================================================
    // TOP KPI CARDS
    // =======================================================

    setHTML(
      'statGrid',
      `
        <div class="dashboard-kpi">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-label">
              Total Leads
            </div>

            <div class="dashboard-kpi-icon">
              ●
            </div>
          </div>

          <div class="dashboard-kpi-value">
            ${totalLeads}
          </div>

          <div class="dashboard-kpi-sub">
            Current pipeline
          </div>
        </div>


        <div class="dashboard-kpi warning">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-label">
              Pending Audit
            </div>

            <div class="dashboard-kpi-icon">
              ◷
            </div>
          </div>

          <div class="dashboard-kpi-value">
            ${pendingAudit}
          </div>

          <div class="dashboard-kpi-sub">
            Awaiting review
          </div>
        </div>


        <div class="dashboard-kpi success">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-label">
              Audit Approved
            </div>

            <div class="dashboard-kpi-icon">
              ✓
            </div>
          </div>

          <div class="dashboard-kpi-value">
            ${auditApproved}
          </div>

          <div class="dashboard-kpi-sub">
            Approved audits
          </div>
        </div>


        <div class="dashboard-kpi danger">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-label">
              Cases In Progress
            </div>

            <div class="dashboard-kpi-icon">
              ↗
            </div>
          </div>

          <div class="dashboard-kpi-value">
            ${inProgressCases}
          </div>

          <div class="dashboard-kpi-sub">
            Active case work
          </div>
        </div>
      `
    );

    // =======================================================
    // CASE PIPELINE
    // =======================================================

    const pipelineContainer = $('casePipeline');

    if (pipelineContainer) {
      const stages = pipelineContainer.querySelectorAll('.pipeline-stage');

      /*
       * If backend already provides stage-wise values,
       * use them.
       *
       * Otherwise use the existing dashboard statistics
       * as safe fallback values.
       */

      const pipeline = stats.pipeline || cases.pipeline || {};

      const stageValues = [
        safeNumber(
          pipeline.counselor ??
          pipeline.leads ??
          leads.total
        ),

        safeNumber(
          pipeline.qualityAudit ??
          pipeline.audit ??
          audits.pending
        ),

        safeNumber(
          pipeline.ops ??
          pipeline.inProcess ??
          cases.inProgress
        ),

        safeNumber(
          pipeline.caseOfficer ??
          pipeline.case_officer ??
          cases.inProgress
        ),

        safeNumber(
          pipeline.visaOutcome ??
          pipeline.visa_outcome ??
          cases.completed
        )
      ];

      stages.forEach((stage, index) => {
        const valueEl = stage.querySelector('.pipeline-stage-value');
        const line = stage.querySelector('.pipeline-stage-line span');

        const value = stageValues[index] || 0;

        if (valueEl) {
          valueEl.textContent = value;
        }

        if (line) {
          const percentage =
            totalCases > 0
              ? Math.min((value / totalCases) * 100, 100)
              : 0;

          line.style.width = `${percentage}%`;
        }
      });
    }

    // =======================================================
    // CASE STATUS
    // =======================================================

    setText('caseStatusTotal', totalCases);

    setText('statusLeads', totalLeads);

    setText('statusAudit', pendingAudit);

    setText('statusOps', inProgressCases);

    setText('statusCaseOfficer', inProgressCases);

    setText('statusVisa', completedCases);

    // =======================================================
    // RECENT AUDIT ACTIVITY
    // =======================================================

    const recentAudits = Array.isArray(stats.recentAudits)
      ? stats.recentAudits
      : [];

    if (recentAudits.length) {
      const rows = recentAudits
        .slice(0, 5)
        .map((audit, index) => {
          const studentName =
            audit.student_name ||
            audit.studentName ||
            audit.name ||
            '-';

const stageMap = {
  AGREEMENT_SIGNED: 'Counselor',
  AUDIT_PENDING: 'Quality Audit',
  AUDIT_APPROVED: 'OPS',
  CASE_ASSIGNED: 'Case Officer',
  CASE_PROCESSING: 'Case Officer',
  CASE_FILED: 'Visa Outcome'
};

const stage =
  audit.stage_name ||
  audit.stage ||
  stageMap[audit.current_status] ||
  'Quality Audit';

const stageClass = stage
  .toLowerCase()
  .replace(/\s+/g, '-');
const score =
  audit.score !== null &&
  audit.score !== undefined &&
  audit.score !== ''
    ? `${audit.score}/10`
    : '-';

const status =
  audit.status ||
  audit.result ||
  'PENDING';

          const date =
            audit.audited_at ||
            audit.created_at ||
            audit.date;

          return `
            <tr>
              <td>${index + 1}</td>

              <td>
  ${studentName}
</td>

<td>
  <span class="audit-stage-pill ${stageClass}">
    ${stage}
  </span>
</td>

<td>
  ${score}
</td>

              <td>
                <span class="status-pill ${statusClass(status)}">
                  ${status}
                </span>
              </td>

              <td>
                ${formatDate(date)}
              </td>
            </tr>
          `;
        })
        .join('');

      setHTML('recentAuditsBody', rows);
    } else {
      setHTML(
        'recentAuditsBody',
        `
          <tr>
            <td colspan="6">
              <div class="dashboard-empty">
                No audit activity yet.
              </div>
            </td>
          </tr>
        `
      );
    }

    // =======================================================
    // TODAY'S TASKS
    // =======================================================

    const tasks = [];

    if (pendingAudit > 0) {
      tasks.push({
        title: 'Review pending audit cases',
        meta: `${pendingAudit} case${pendingAudit === 1 ? '' : 's'}`,
        priority: 'High',
        priorityClass: 'high'
      });
    }

    if (inProgressCases > 0) {
      tasks.push({
        title: 'Review active case processing',
        meta: `${inProgressCases} case${inProgressCases === 1 ? '' : 's'}`,
        priority: 'Medium',
        priorityClass: 'medium'
      });
    }

    if (totalLeads > 0) {
      tasks.push({
        title: 'Follow up with active leads',
        meta: `${totalLeads} lead${totalLeads === 1 ? '' : 's'}`,
        priority: 'Medium',
        priorityClass: 'medium'
      });
    }

    if (auditRejected > 0) {
      tasks.push({
        title: 'Review rejected audits',
        meta: `${auditRejected} case${auditRejected === 1 ? '' : 's'}`,
        priority: 'High',
        priorityClass: 'high'
      });
    }

    if (tasks.length === 0) {
      tasks.push({
        title: 'No pending operational tasks',
        meta: 'Everything is up to date',
        priority: 'Low',
        priorityClass: 'low'
      });
    }

    setHTML(
      'dashboardTasks',
      tasks
        .slice(0, 5)
        .map(
          (task) => `
            <div class="task-item">

              <input
                type="checkbox"
                class="task-check"
              />

              <div class="task-content">

                <div class="task-title">
                  ${task.title}
                </div>

                <div class="task-meta">
                  ${task.meta}
                </div>

              </div>

              <span class="task-priority ${task.priorityClass}">
                ${task.priority}
              </span>

            </div>
          `
        )
        .join('')
    );

  } catch (err) {

    console.error('Dashboard loading error:', err);

    showToast(
      err.message || 'Unable to load dashboard data',
      true
    );

    // =======================================================
    // STOP ALL LOADING STATES ON ERROR
    // =======================================================

    setHTML(
      'recentAuditsBody',
      `
        <tr>
          <td colspan="6">
            <div class="dashboard-empty">
              Unable to load audit activity.
            </div>
          </td>
        </tr>
      `
    );

    setHTML(
      'dashboardTasks',
      `
        <div class="dashboard-empty">
          Unable to load today's tasks.
        </div>
      `
    );

    setText('caseStatusTotal', '0');
    setText('statusLeads', '0');
    setText('statusAudit', '0');
    setText('statusOps', '0');
    setText('statusCaseOfficer', '0');
    setText('statusVisa', '0');
  }
})();