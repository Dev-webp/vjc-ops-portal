let pendingLeads = [];
let auditHistoryCache = [];
let activeAuditView = 'pending';
// Pagination
const AUDIT_PAGE_SIZE = 15;
let pendingCurrentPage = 1;
let historyCurrentPage = 1;
const modalOverlay = document.getElementById('modalOverlay');
const scoreRange = document.getElementById('scoreRange');
const scoreVal = document.getElementById('scoreVal');

scoreRange.addEventListener('input', () => { scoreVal.textContent = scoreRange.value; });

function openModal(leadId) {
const lead = pendingLeads.find(l => String(l.id) === String(leadId));  if (!lead) return;

  document.getElementById('modalLeadId').value = lead.id;
  document.getElementById('modalTitle').textContent = `Verification Call — ${lead.student_name}`;

  document.getElementById('auditForm').reset();
  scoreRange.value = 8;
  scoreVal.textContent = 8;
document.getElementById('invoiceDetails').innerHTML = `
  <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
    <h4 style="margin: 0 0 10px;">Invoice Details</h4>
    <div><strong>Student Name:</strong> ${lead.student_name || '—'}</div>
    <div><strong>Phone:</strong> ${lead.phone || '—'}</div>
    <div><strong>Email:</strong> ${lead.email || '—'}</div>
    <div><strong>Invoice No:</strong> ${lead.invoice_number || '—'}</div>
    <div><strong>Total Amount:</strong> ₹${Number(lead.total_amount || 0).toLocaleString('en-IN')}</div>
    <div><strong>Paid Amount:</strong> ₹${Number(lead.paid_amount || 0).toLocaleString('en-IN')}</div>
    <div><strong>Outstanding:</strong> ₹${Number(lead.outstanding_amount || 0).toLocaleString('en-IN')}</div>
    <div><strong>Payment Status:</strong> ${lead.payment_status || '—'}</div>
    <div><strong>Sent to OPS By:</strong> ${lead.sent_to_ops_by_name || '—'}</div>
    <div style="margin-top: 8px;">
      <strong>Agreement PDF:</strong>
      ${
        lead.agreement_pdf_url
          ? `<a href="${lead.agreement_pdf_url}" target="_blank">View Agreement</a>`
          : '—'
      }
    </div>
  </div>
`;
  modalOverlay.style.display = 'flex';
}
document.getElementById('cancelModal').addEventListener('click', () => { modalOverlay.style.display = 'none'; });

async function loadPending() {
  try {
    const { leads } = await apiFetch('/audits/pending');

    pendingLeads = leads;

    pendingCurrentPage = 1;

    renderPendingPage();

    renderAuditStats();

  } catch (err) {
    showToast(err.message, true);
  }
}


function renderPendingPage() {
  const startIndex =
    (pendingCurrentPage - 1) * AUDIT_PAGE_SIZE;

  const pageLeads = pendingLeads.slice(
    startIndex,
    startIndex + AUDIT_PAGE_SIZE
  );

  const rows = pageLeads.map((l) => `
    <tr>
      <td>${l.student_name}</td>
      <td>${l.target_country}</td>
      <td>${l.visa_category}</td>
      <td>${l.counselor_name || '—'}</td>
      <td>
        <button
          class="btn-sm orange"
          onclick="openModal(${l.id})"
        >
          Start Audit
        </button>
      </td>
    </tr>
  `).join('');

  document.getElementById('pendingBody').innerHTML =
    rows ||
    '<tr><td colspan="5" class="empty-state">Nothing waiting — queue is clear.</td></tr>';

  renderAuditPagination(
    'pendingPagination',
    pendingLeads.length,
    pendingCurrentPage,
    'changePendingPage'
  );
}


function renderAuditPagination(
  containerId,
  totalItems,
  currentPage,
  changeFunction
) {
  const container = document.getElementById(containerId);

  if (!container) return;

  const totalPages = Math.ceil(
    totalItems / AUDIT_PAGE_SIZE
  );

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  html += `
    <button
      type="button"
      class="audit-page-btn"
      ${currentPage === 1 ? 'disabled' : ''}
      onclick="${changeFunction}(${currentPage - 1})"
    >
      Previous
    </button>
  `;

  for (let page = 1; page <= totalPages; page++) {
    html += `
      <button
        type="button"
        class="audit-page-btn ${page === currentPage ? 'active' : ''}"
        onclick="${changeFunction}(${page})"
      >
        ${page}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="audit-page-btn"
      ${currentPage === totalPages ? 'disabled' : ''}
      onclick="${changeFunction}(${currentPage + 1})"
    >
      Next
    </button>
  `;

    container.innerHTML = html;
}


function changePendingPage(page) {
  const totalPages = Math.ceil(
    pendingLeads.length / AUDIT_PAGE_SIZE
  );

  if (page < 1 || page > totalPages) {
    return;
  }

  pendingCurrentPage = page;

  renderPendingPage();
}


function changeHistoryPage(page) {
  const totalAudits = auditHistoryCache.filter((a) =>
    activeAuditView === 'approved'
      ? a.status === 'APPROVED'
      : a.status === 'REJECTED'
  ).length;

  const totalPages = Math.ceil(
    totalAudits / AUDIT_PAGE_SIZE
  );

  if (page < 1 || page > totalPages) {
    return;
  }

  historyCurrentPage = page;

  showAuditView(activeAuditView);
}


// NEW — 4 stat cards above "Pending Verification Calls"
// Leads/Dashboard pages). Recomputed whenever pending or history reloads.
function renderAuditStats() {
  const pending = pendingLeads.length;
  const approved = auditHistoryCache.filter((a) => a.status === 'APPROVED').length;
  const rejected = auditHistoryCache.filter((a) => a.status === 'REJECTED').length;
  const total = auditHistoryCache.length;

  document.getElementById('auditStatGrid').innerHTML = `
    <div class="stat-card orange">
      <div class="icon">&#127908;</div><div class="label">Pending Calls</div><div class="value">${pending}</div>
    </div>
    <div class="stat-card green">
      <div class="icon">&#9989;</div><div class="label">Approved</div><div class="value">${approved}</div>
    </div>
    <div class="stat-card red">
      <div class="icon">&#10060;</div><div class="label">Rejected</div><div class="value">${rejected}</div>
    </div>
    <div class="stat-card">
      <div class="icon">&#128202;</div><div class="label">Total Audits</div><div class="value">${total}</div>
    </div>
  `;
}

async function loadHistory() {
  try {
    const { audits } = await apiFetch('/audits/history');
    auditHistoryCache = audits;
    renderAuditStats();
    showAuditView(activeAuditView);
  } catch (err) { showToast(err.message, true); }
}

function showAuditView(view) {
  const pendingSection = document.getElementById('pendingAuditSection');
  const historySection = document.getElementById('historyAuditSection');

  const pendingBtn = document.getElementById('pendingAuditBtn');
  const approvedBtn = document.getElementById('approvedAuditBtn');
  const rejectedBtn = document.getElementById('rejectedAuditBtn');

  const historyTitle = historySection.querySelector('h3');

  activeAuditView = view;

  pendingSection.style.display = view === 'pending' ? 'block' : 'none';
  historySection.style.display = view === 'pending' ? 'none' : 'block';

  pendingBtn.classList.toggle('active', view === 'pending');
  approvedBtn.classList.toggle('active', view === 'approved');
  rejectedBtn.classList.toggle('active', view === 'rejected');

  if (view === 'pending') return;

const status = view === 'approved' ? 'APPROVED' : 'REJECTED';
const title = view === 'approved' ? 'Approved Audits' : 'Rejected Audits';

const audits = auditHistoryCache.filter((a) => a.status === status);

const startIndex =
  (historyCurrentPage - 1) * AUDIT_PAGE_SIZE;

const pageAudits = audits.slice(
  startIndex,
  startIndex + AUDIT_PAGE_SIZE
);


historyTitle.textContent = title;

const rows = pageAudits.map((a) => `
    <tr>
      <td>${a.student_name}</td>
      <td>${a.auditor_name || '—'}</td>
      <td>${a.score}/10</td>
      <td><span class="badge ${a.status === 'APPROVED' ? 'approved' : 'rejected'}">${a.status}</span></td>
      <td>${a.auditor_remarks || '—'}</td>
      <td>${a.audio_url ? `<a href="${a.audio_url}" target="_blank">&#9654; Play</a>` : '—'}</td>
      <td>
        <button
          type="button"
          class="btn-sm outline"
          onclick="openAuditDetails(${a.id})"
        >
          View
        </button>
      </td>
    </tr>
  `).join('');

    document.getElementById('historyBody').innerHTML =
  rows || '<tr><td colspan="7" class="empty-state">No audits yet.</td></tr>';

renderAuditPagination(
  'historyPagination',
  audits.length,
  historyCurrentPage,
  'changeHistoryPage'
);
}

function openAuditDetails(auditId) {
  const audit = auditHistoryCache.find(
    (a) => String(a.id) === String(auditId)
  );

  if (!audit) return;

  document.getElementById('auditDetailsTitle').textContent =
    `Audit Details — ${audit.student_name || '—'}`;

  document.getElementById('auditDetailsContent').innerHTML = `
    <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">

      <h4 style="margin: 0 0 10px;">Student Details</h4>

      <div><strong>Student Name:</strong> ${audit.student_name || '—'}</div>
      <div><strong>Phone:</strong> ${audit.phone || '—'}</div>
      <div><strong>Email:</strong> ${audit.email || '—'}</div>
      <div><strong>Country:</strong> ${audit.target_country || '—'}</div>
      <div><strong>Visa Category:</strong> ${audit.visa_category || '—'}</div>
      <div><strong>Counselor:</strong> ${audit.counselor_name || '—'}</div>

      <hr style="margin: 16px 0; border: 0; border-top: 1px solid #ddd;">

      <h4 style="margin: 0 0 10px;">Invoice Details</h4>

      <div><strong>Invoice No:</strong> ${audit.invoice_number || '—'}</div>
      <div><strong>Total Amount:</strong> ₹${Number(audit.total_amount || 0).toLocaleString('en-IN')}</div>
      <div><strong>Paid Amount:</strong> ₹${Number(audit.paid_amount || 0).toLocaleString('en-IN')}</div>
      <div><strong>Outstanding:</strong> ₹${Number(audit.outstanding_amount || 0).toLocaleString('en-IN')}</div>
      <div><strong>Payment Status:</strong> ${audit.payment_status || '—'}</div>
      <div><strong>Sent to OPS By:</strong> ${audit.sent_to_ops_by_name || '—'}</div>

      <div style="margin-top: 8px;">
        <strong>Agreement PDF:</strong>
        ${
          audit.agreement_pdf_url
            ? `<a href="${audit.agreement_pdf_url}" target="_blank">View Agreement</a>`
            : '—'
        }
      </div>

      <hr style="margin: 16px 0; border: 0; border-top: 1px solid #ddd;">

      <h4 style="margin: 0 0 10px;">Audit Details</h4>

      <div><strong>Auditor:</strong> ${audit.auditor_name || '—'}</div>
      <div><strong>Score:</strong> ${audit.score || '—'}/10</div>
      <div>
        <strong>Result:</strong>
        <span class="badge ${audit.status === 'APPROVED' ? 'approved' : 'rejected'}">
          ${audit.status || '—'}
        </span>
      </div>
      <div><strong>Remarks:</strong> ${audit.auditor_remarks || '—'}</div>

      <div style="margin-top: 8px;">
        <strong>Call Audio:</strong>
        ${
          audit.audio_url
            ? `<a href="${audit.audio_url}" target="_blank">&#9654; Play Audio</a>`
            : '—'
        }
      </div>

    </div>
  `;

  document.getElementById('auditDetailsOverlay').style.display = 'flex';
}

document.getElementById('pendingAuditBtn').addEventListener('click', () => {
  showAuditView('pending');
});

document.getElementById('approvedAuditBtn').addEventListener('click', () => {
  historyCurrentPage = 1;
  showAuditView('approved');
});

document.getElementById('rejectedAuditBtn').addEventListener('click', () => {
  historyCurrentPage = 1;
  showAuditView('rejected');
});

document.getElementById('closeAuditDetails').addEventListener('click', () => {
  document.getElementById('auditDetailsOverlay').style.display = 'none';
});

document.getElementById('auditForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const leadId = document.getElementById('modalLeadId').value;
  const fd = new FormData();
  fd.append('fees_match_agreement', document.getElementById('chk1').checked);
  fd.append('no_unauthorized_promises', document.getElementById('chk2').checked);
  fd.append('student_understands_embassy_discretion', document.getElementById('chk3').checked);
  fd.append('score', scoreRange.value);
  fd.append('auditor_remarks', document.getElementById('remarks').value);
  const file = document.getElementById('audioFile').files[0];
  if (file) fd.append('audio', file);

  try {
    const res = await apiFetch(`/audits/${leadId}`, { method: 'POST', body: fd });
    showToast(res.message);
    modalOverlay.style.display = 'none';
    loadPending();
    loadHistory();
  } catch (err) {
    showToast(err.message, true);
  }
});

(async () => {
  await renderSidebar('audit');
  showAuditView('pending');
  loadPending();
  loadHistory();
})();
