(async () => {
  const currentUser = await renderSidebar('reports');
  if (!currentUser) return;

  const employeeFilter = document.getElementById('employeeFilter');
  const employeeField = document.getElementById('employeeField');

  const isManagement =
    currentUser.work_profile === 'MD' || currentUser.work_profile === 'OPS_MANAGER';

  if (!isManagement) {
    employeeField.style.display = 'none';
  } else {
    document.getElementById('employeeReportCard').style.display = 'block';
    document.getElementById('branchReportCard').style.display = 'block';
    document.getElementById('topPerformersCard').style.display = 'block';
  }

  function num(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function scoreLabel(v) {
    const x = Number(v);
    return v !== null && v !== undefined && Number.isFinite(x) ? `${x}/10` : '—';
  }

  async function loadEmployees() {
    if (!isManagement) return;
    try {
      const data = await apiFetch('/reports/employees');
      employeeFilter.innerHTML = '<option value="">All Employees</option>';
      (data.employees || []).forEach((e) => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `${e.name} — ${e.designation || e.work_profile}`;
        employeeFilter.appendChild(opt);
      });
    } catch (err) {
      console.error('Could not load employees:', err);
    }
  }

  function getFilters() {
    const params = new URLSearchParams();
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (isManagement && employeeFilter.value) params.set('employee_id', employeeFilter.value);
    return params.toString();
  }

  function formatCurrency(value) {
    return '₹' + num(value).toLocaleString('en-IN');
  }

  function kpiCard(icon, label, value, sub = '', colorClass = '') {
    return `
      <div class="kpi-card ${colorClass}">
        <div class="kpi-icon">${icon}</div>
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
      </div>`;
  }

  function hbarRow(label, value, maxValue, colorClass) {
    const v = num(value);
    const pct = maxValue > 0 ? Math.round((v / maxValue) * 100) : 0;
    return `
      <div class="hbar-row">
        <div class="hbar-top"><span class="lbl">${label}</span><span class="val">${v}</span></div>
        <div class="hbar-track"><div class="hbar-fill ${colorClass}" style="width:${pct}%"></div></div>
      </div>`;
  }

  function emptyNote(text) {
    return `<div class="empty-state">${text}</div>`;
  }

  async function loadReport() {
    try {
      const query = getFilters();
      const data = await apiFetch(`/reports/summary${query ? `?${query}` : ''}`);
      const k = data.kpis || {};
      const lead = data.leadBreakdown || {};
      const audit = data.auditBreakdown || {};
      const cs = data.caseBreakdown || {};

      // ---- KPI CARDS ----
      document.getElementById('kpiGrid').innerHTML =
        kpiCard('&#128100;', 'Total Leads', num(k.totalLeads)) +
        kpiCard('&#127908;', 'Quality Audits', num(k.totalAudits), audit.avgScore != null ? `Avg score ${scoreLabel(audit.avgScore)}` : 'No audits yet', 'orange') +
        kpiCard('&#128203;', 'Total Cases', num(k.totalCases)) +
        kpiCard('&#9989;', 'Visa Success Rate', `${num(k.visaSuccessRate)}%`, `${num(cs.visaApproved)} approved / ${num(cs.visaRejected)} rejected`, 'green');

      // ---- LEAD BREAKDOWN ----
      const leadTotal = num(lead.signed) + num(lead.pending);
      document.getElementById('leadBreakdown').innerHTML = leadTotal
        ? hbarRow('Agreement Signed', lead.signed, leadTotal, 'green') +
          hbarRow('Pending', lead.pending, leadTotal, 'orange')
        : emptyNote('No leads in this range.');

      // ---- AUDIT BREAKDOWN ----
      const auditTotal = num(audit.approved) + num(audit.rejected) + num(audit.pending);
      document.getElementById('auditBreakdown').innerHTML = auditTotal
        ? hbarRow('Approved', audit.approved, auditTotal, 'green') +
          hbarRow('Rejected', audit.rejected, auditTotal, 'red') +
          hbarRow('Pending', audit.pending, auditTotal, 'orange')
        : emptyNote('No audits in this range.');

      // ---- CASE BREAKDOWN ----
      const caseTotal = num(cs.inProgress) + num(cs.visaApproved) + num(cs.visaRejected);
      document.getElementById('caseBreakdown').innerHTML = caseTotal
        ? hbarRow('In Progress', cs.inProgress, caseTotal, 'orange') +
          hbarRow('Visa Approved', cs.visaApproved, caseTotal, 'green') +
          hbarRow('Visa Rejected', cs.visaRejected, caseTotal, 'red')
        : emptyNote('No cases in this range.');
      renderCountries(data.topCountries || []);

      if (isManagement) {
        renderTopPerformers(data.employeeReport || []);
        renderEmployeeReport(data.employeeReport || []);
        renderBranchReport(data.branchReport || []);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Could not load reports', true);
    }
  }

     function renderTopPerformers(rows) {
    const el = document.getElementById('topPerformersList');
    if (!rows.length) {
      el.innerHTML = emptyNote('No employee activity yet.');
      return;
    }

    const ranked = rows
      .map((r) => ({ ...r, score: num(r.leads) + num(r.audits) + num(r.cases) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!ranked.length) {
      el.innerHTML = emptyNote('No employee activity yet.');
      return;
    }

    const medals = ['&#129351;', '&#129352;', '&#129353;'];

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;">
        ${ranked.map((r, i) => `
          <div style="background:#f7f9fc;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:26px;margin-bottom:6px;">${medals[i]}</div>
            <div style="font-weight:700;color:var(--text-dark);">${escapeHtml(r.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">${escapeHtml(r.designation || r.work_profile || '-')}</div>
            <div style="font-size:20px;font-weight:800;color:var(--brand-blue-dark);">${r.score}</div>
            <div style="font-size:11px;color:var(--text-muted);">total activity (${num(r.leads)} leads, ${num(r.audits)} audits, ${num(r.cases)} cases)</div>
          </div>
        `).join('')}
      </div>`;
  }

    const DONUT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e34948', '#9085e9'];

  function renderCountries(rows) {
    const el = document.getElementById('countryBreakdown');
    const total = rows.reduce((sum, r) => sum + num(r.total), 0);

    if (!rows.length || total === 0) {
      el.innerHTML = emptyNote('No leads in this range.');
      return;
    }

    let cursor = 0;
    const segments = rows.map((r, i) => {
      const pct = num(r.pct ?? Math.round((num(r.total) / total) * 100));
      const start = cursor;
      cursor += pct;
      const color = DONUT_COLORS[i % DONUT_COLORS.length];
      return `${color} ${start}% ${cursor}%`;
    });

    const legend = rows.map((r, i) => `
      <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;">
        <span><span style="display:inline-block;width:9px;height:9px;background:${DONUT_COLORS[i % DONUT_COLORS.length]};border-radius:2px;margin-right:7px;"></span>${escapeHtml(r.country)}</span>
        <strong>${num(r.total)} (${num(r.pct ?? Math.round((num(r.total) / total) * 100))}%)</strong>
      </div>
    `).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap;">
        <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
          <div style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${segments.join(',')});"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:86px;height:86px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:20px;font-weight:800;color:var(--text-dark);">${total}</div>
            <div style="font-size:10px;color:var(--text-muted);">total leads</div>
          </div>
        </div>
        <div style="flex:1;min-width:180px;">${legend}</div>
      </div>`;
  }

  function renderEmployeeReport(rows) {
    const tbody = document.getElementById('employeeReportBody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No employee data found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td><span class="badge info">${escapeHtml(r.designation || r.work_profile || '-')}</span></td>
        <td>${num(r.leads)}</td>
        <td>${num(r.audits)}</td>
        <td>${scoreLabel(r.avg_score)}</td>
        <td>${num(r.cases)}</td>
        <td><span class="badge approved">${num(r.visa_approved)}</span></td>
      </tr>
    `).join('');
  }

  function renderBranchReport(rows) {
    const tbody = document.getElementById('branchReportBody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No branches found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.branch_name)}</strong></td>
        <td>${escapeHtml(r.city)}</td>
        <td>${num(r.leads)}</td>
        <td>${num(r.cases)}</td>
        <td><span class="badge approved">${num(r.visa_approved)}</span></td>
      </tr>
    `).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  document.getElementById('applyBtn').addEventListener('click', loadReport);

  await loadEmployees();
  await loadReport();
})();