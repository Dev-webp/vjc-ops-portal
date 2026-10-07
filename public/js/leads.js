const statusBadge = (status) => {
  const map = {
    PENDING_INVOICE_REVIEW: 'info',
    AGREEMENT_SIGNED: 'info',
    AUDIT_PENDING: 'pending',
    AUDIT_FAILED: 'rejected',
    AUDIT_APPROVED: 'approved',
    CASE_ASSIGNED: 'info',
    CASE_FILED: 'approved',
  };

  const label = status === 'PENDING_INVOICE_REVIEW' ? 'NEW (FROM INVOICE)' : status.replaceAll('_', ' ');
  return `<span class="badge ${map[status] || 'info'}">${label}</span>`;
};

let selectedLeadId = null;
let selectedAuditReason = '';

// NEW — tabs are filtered client-side from one cached fetch (no extra API calls)
let allLeadsCache = [];
let activeTab = 'my';
let selectedInvoiceLead = null;

// Pagination
const LEADS_PAGE_SIZE = 20;
let leadsCurrentPage = 1;


async function loadLeads() {
  try {
    const { leads } = await apiFetch('/leads');
    allLeadsCache = leads;
    renderLeadStats();
    renderLeadsTable();
  } catch (err) {
    showToast(err.message, true);
  }
}

// NEW — 4 stat cards above the tabs (same look as the Dashboard page).
// Clicking a card jumps straight to the matching tab.
function renderLeadStats() {
  const total = allLeadsCache.length;
  const pendingInvoice = allLeadsCache.filter((l) => l.current_status === 'PENDING_INVOICE_REVIEW').length;
  const sentToAuditor = allLeadsCache.filter((l) => ['AGREEMENT_SIGNED', 'AUDIT_PENDING'].includes(l.current_status)).length;
  const returned = allLeadsCache.filter((l) => l.current_status === 'AUDIT_FAILED').length;

  document.getElementById('leadStatGrid').innerHTML = `
    <div class="stat-card" data-tab="all" style="cursor:pointer">
      <div class="icon">&#128100;</div><div class="label">Total Leads</div><div class="value">${total}</div>
    </div>
    <div class="stat-card orange" data-tab="my" style="cursor:pointer">
      <div class="icon">&#128228;</div><div class="label">Pending Invoice Review</div><div class="value">${pendingInvoice}</div>
    </div>
    <div class="stat-card" data-tab="auditor" style="cursor:pointer">
      <div class="icon">&#127908;</div><div class="label">Sent to Auditor</div><div class="value">${sentToAuditor}</div>
    </div>
    <div class="stat-card red" data-tab="returned" style="cursor:pointer">
      <div class="icon">&#10060;</div><div class="label">Returned / Rejected</div><div class="value">${returned}</div>
    </div>
  `;
}

document.getElementById('leadStatGrid').addEventListener('click', (event) => {
  const card = event.target.closest('.stat-card');
  if (!card) return;
  const btn = document.querySelector(`#leadTabs .tab-btn[data-tab="${card.dataset.tab}"]`);
  if (btn) btn.click();
});

// NEW — filters the cached list by the active tab and (re)draws the table.
// Called on load and whenever a tab button is clicked — no extra API call.
function renderLeadsTable() {
  const TAB_FILTERS = {
    my: () => true,
    auditor: (l) => ['AGREEMENT_SIGNED', 'AUDIT_PENDING'].includes(l.current_status),
    returned: (l) => l.current_status === 'AUDIT_FAILED',
    all: () => true,
  };

  const searchInput =
  document.getElementById('leadSearch');

const searchTerm =
  (searchInput?.value || '').trim().toLowerCase();

const tabFilteredLeads =
  allLeadsCache.filter(
    TAB_FILTERS[activeTab] || TAB_FILTERS.my
  );

const leads = tabFilteredLeads.filter((l) => {

  if (!searchTerm) {
    return true;
  }

  return (
    String(l.student_name || '')
      .toLowerCase()
      .includes(searchTerm) ||

    String(l.target_country || '')
      .toLowerCase()
      .includes(searchTerm) ||

    String(l.visa_category || '')
      .toLowerCase()
      .includes(searchTerm)
  );

});

  const totalPages = Math.ceil(leads.length / LEADS_PAGE_SIZE);

  if (leadsCurrentPage > totalPages && totalPages > 0) {
    leadsCurrentPage = totalPages;
  }

  const startIndex = (leadsCurrentPage - 1) * LEADS_PAGE_SIZE;

  const pageLeads = leads.slice(
    startIndex,
    startIndex + LEADS_PAGE_SIZE
  );

  const rows = pageLeads.map((l, index) => {
    const isFailed = l.current_status === 'AUDIT_FAILED';
    const isInvoicePending = l.current_status === 'PENDING_INVOICE_REVIEW';

    const reasonBlock = isFailed
      ? `
        <div class="empty-state" style="margin-top:4px">
          Score: ${l.last_audit_score ?? '—'}/10
          — Reason: ${l.last_audit_remarks || 'No reason given'}
        </div>
      `
      : '';

    let actionCell = '—';

    if (isFailed) {
      actionCell = `
        <button
          type="button"
          class="btn-sm orange correction-btn"
          data-lead-id="${l.id}"
          data-audit-reason="${encodeURIComponent(l.last_audit_remarks || 'No reason given')}"
        >
          View / Correct
        </button>
      `;
    } else if (isInvoicePending) {
      actionCell = `
        <button type="button" class="btn-sm green invoice-review-btn" data-lead-id="${l.id}">
          Add Lead
        </button>
      `;
    }

    if (l.source === 'FROM_INVOICE' && !isInvoicePending) {
      actionCell += `
        <button type="button" class="btn-sm outline invoice-view-btn" data-lead-id="${l.id}" style="margin-top:4px">
          View Invoice
        </button>
      `;
    }

    return `
      <tr>
        <td>${startIndex + index + 1}</td>
        <td>${l.student_name}</td>
        <td>${l.target_country}</td>
        <td>${l.visa_category}</td>
        <td>
          ${statusBadge(l.current_status)}
          ${reasonBlock}
        </td>
        <td>${new Date(l.created_at).toLocaleDateString()}</td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('leadsBody').innerHTML =
    rows ||
    '<tr><td colspan="6" class="empty-state">No leads in this tab.</td></tr>';

  renderLeadsPagination(leads.length);
}


// ADD THIS FUNCTION
function renderLeadsPagination(totalRecords) {
  const totalPages = Math.ceil(totalRecords / LEADS_PAGE_SIZE);

  let pagination = document.getElementById('leadsPagination');

  if (!pagination) {
    pagination = document.createElement('div');

    pagination.id = 'leadsPagination';

    pagination.style.cssText =
      'display:flex;justify-content:center;align-items:center;gap:6px;margin-top:18px;';

    document
      .getElementById('leadsBody')
      .parentElement
      .parentElement
      .appendChild(pagination);
  }

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';

  let html = `
    <button
      type="button"
      class="btn-sm outline"
      ${leadsCurrentPage === 1 ? 'disabled' : ''}
      onclick="changeLeadsPage(${leadsCurrentPage - 1})">
      Previous
    </button>
  `;

  for (let page = 1; page <= totalPages; page++) {
    html += `
      <button
        type="button"
        class="btn-sm ${page === leadsCurrentPage ? 'orange' : 'outline'}"
        onclick="changeLeadsPage(${page})">
        ${page}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="btn-sm outline"
      ${leadsCurrentPage === totalPages ? 'disabled' : ''}
      onclick="changeLeadsPage(${leadsCurrentPage + 1})">
      Next
    </button>
  `;

  pagination.innerHTML = html;
}


function changeLeadsPage(page) {
  if (page < 1) return;

  const TAB_FILTERS = {
    my: () => true,
    auditor: (l) =>
      ['AGREEMENT_SIGNED', 'AUDIT_PENDING'].includes(l.current_status),
    returned: (l) => l.current_status === 'AUDIT_FAILED',
    all: () => true,
  };

  const leads = allLeadsCache.filter(
    TAB_FILTERS[activeTab] || TAB_FILTERS.my
  );

  const totalPages = Math.ceil(leads.length / LEADS_PAGE_SIZE);

  if (page > totalPages) return;

  leadsCurrentPage = page;

  renderLeadsTable();
}
/* =========================================
   OPEN CORRECTION MODAL
========================================= */

function openCorrectionModal(leadId, auditReason) {
  selectedLeadId = leadId;
  selectedAuditReason = auditReason;

  document.getElementById('correctionAuditReason').innerHTML = `
    <strong>Auditor's Reason:</strong>
    <div style="margin-top:6px;">
      ${auditReason}
    </div>
  `;

  document.getElementById('correctionDetails').value = '';
  document.getElementById('correctionError').textContent = '';

  document.getElementById('correctionModal').style.display = 'flex';
}


/* =========================================
   CLOSE CORRECTION MODAL
========================================= */

function closeCorrectionModal() {
  selectedLeadId = null;
  selectedAuditReason = '';

  document.getElementById('correctionModal').style.display = 'none';

  document.getElementById('correctionDetails').value = '';
  document.getElementById('correctionError').textContent = '';
}


/* =========================================
   SAVE CORRECTION + RESUBMIT
========================================= */

async function saveCorrectionAndResubmit() {
  if (!selectedLeadId) {
    return;
  }

  const correctionDetails =
    document.getElementById('correctionDetails').value.trim();

  const errorBox =
    document.getElementById('correctionError');

  if (!correctionDetails) {
    errorBox.textContent =
      'Please enter what you corrected before resubmitting.';
    return;
  }

  errorBox.textContent = '';

  const button =
    document.getElementById('saveCorrectionBtn');

  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    await apiFetch(`/leads/${selectedLeadId}/resubmit`, {
      method: 'PATCH',
      body: JSON.stringify({
        correction_details: correctionDetails,
      }),
    });

    closeCorrectionModal();

    showToast(
      'Correction saved — Lead sent back to Quality Audit.'
    );

    await loadLeads();

  } catch (err) {
    errorBox.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Save Correction & Resubmit';
  }
}


/* =========================================
   TABS
========================================= */

document.getElementById('leadTabs').addEventListener('click', (event) => {
  const btn = event.target.closest('.tab-btn');

  if (!btn) {
    return;
  }

  activeTab = btn.dataset.tab;
  leadsCurrentPage = 1;

  document
    .querySelectorAll('#leadTabs .tab-btn')
    .forEach((b) => {
      b.classList.toggle('active', b === btn);
    });

  renderLeadsTable();
});


document.getElementById('leadSearch').addEventListener('input', () => {
  leadsCurrentPage = 1;
  renderLeadsTable();
});

/* =========================================
   MANUAL ADD TOGGLE ("+ Add New Lead (Manual)")
========================================= */

document.getElementById('toggleManualAddBtn').addEventListener('click', () => {
  const section = document.getElementById('manualAddSection');
  section.style.display = section.style.display === 'none' ? 'block' : 'none';
});


/* =========================================
   INVOICE LEAD REVIEW MODAL
========================================= */

function openInvoiceReviewModal(lead, readOnly = false) {
  selectedInvoiceLead = lead;
  const rows = [
    ['Student Name', lead.student_name],
    ['Phone', lead.phone],
    ['Email', lead.email || '—'],
    ['Service Type', lead.target_country],
    ['Invoice No', lead.invoice_number || '—'],
    ['Total Amount', lead.total_amount != null ? `₹${Number(lead.total_amount).toLocaleString('en-IN')}` : '—'],
    ['Paid Amount', lead.paid_amount != null ? `₹${Number(lead.paid_amount).toLocaleString('en-IN')}` : '—'],
    ['Outstanding', lead.outstanding_amount != null ? `₹${Number(lead.outstanding_amount).toLocaleString('en-IN')}` : '—'],
    ['Payment Status', lead.payment_status || '—'],
    ['Sent to OPS By', lead.sent_to_ops_by_name || '—'],

    ['Agreement PDF', lead.agreement_pdf_url ? `<a href="${lead.agreement_pdf_url}" target="_blank">View Agreement</a>` : '—'],
  ];
  document.getElementById('invoiceReviewBody').innerHTML = rows.map(
    ([label, value]) => `<tr><td style="font-weight:600">${label}</td><td>${value}</td></tr>`
  ).join('');
  document.getElementById('confirmInvoiceLeadBtn').style.display = readOnly ? 'none' : 'inline-block';
  document.getElementById('invoiceReviewModal').style.display = 'flex';
}

function closeInvoiceReviewModal() {
  selectedInvoiceLead = null;
  document.getElementById('invoiceReviewModal').style.display = 'none';
}

document.getElementById('closeInvoiceReviewBtn').addEventListener('click', closeInvoiceReviewModal);

document.getElementById('confirmInvoiceLeadBtn').addEventListener('click', async () => {
  if (!selectedInvoiceLead) return;
  const button = document.getElementById('confirmInvoiceLeadBtn');
  button.disabled = true;
  button.textContent = 'Adding...';
  try {
    await apiFetch(`/leads/${selectedInvoiceLead.id}/confirm-from-invoice`, { method: 'PATCH' });
    showToast('Lead added — sent to Quality Audit.');
    closeInvoiceReviewModal();
    await loadLeads();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Confirm & Add Lead';
  }
});

document.getElementById('leadsBody').addEventListener('click', (event) => {
  const button = event.target.closest('.invoice-review-btn');
  if (!button) return;
  const lead = allLeadsCache.find((l) => String(l.id) === button.dataset.leadId);
  if (lead) openInvoiceReviewModal(lead);
});

// NEW — permanent "View Invoice" button (read-only, no Confirm button)
document.getElementById('leadsBody').addEventListener('click', (event) => {
  const button = event.target.closest('.invoice-view-btn');
  if (!button) return;
  const lead = allLeadsCache.find((l) => String(l.id) === button.dataset.leadId);
  if (lead) openInvoiceReviewModal(lead, true);
});


/* =========================================
   VIEW / CORRECT BUTTON CLICK
   ========================================= */

document
  .getElementById('leadsBody')
  .addEventListener('click', (event) => {

    const button = event.target.closest('.correction-btn');

    if (!button) {
      return;
    }

    const leadId = button.dataset.leadId;

    const auditReason =
      decodeURIComponent(button.dataset.auditReason || 'No reason given');

    openCorrectionModal(
      leadId,
      auditReason
    );
  });


/* =========================================
   LEAD FORM
========================================= */

document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    student_name:
      document.getElementById('student_name').value,

    phone:
      document.getElementById('phone').value,

    email:
      document.getElementById('email').value,

    target_country:
      document.getElementById('target_country').value,

    visa_category:
      document.getElementById('visa_category').value,

    package_amount:
      Number(document.getElementById('package_amount').value) || 0,
  };

  try {

    await apiFetch('/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast(
      'Lead added — ready for Quality Audit.'
    );

    e.target.reset();

    await loadLeads();

  } catch (err) {
    showToast(err.message, true);
  }
});


/* =========================================
   MODAL BUTTONS
========================================= */

document
  .getElementById('closeCorrectionBtn')
  .addEventListener('click', closeCorrectionModal);


document
  .getElementById('saveCorrectionBtn')
  .addEventListener('click', saveCorrectionAndResubmit);


/* =========================================
   INITIAL LOAD
========================================= */

(async () => {
  await renderSidebar('leads');
  await loadLeads();
})();