let CURRENT_USER = null;
let officersCache = [];

const DOC_LABELS = {
  PASSPORT: 'Passport',
  TRANSCRIPTS: 'Transcripts',
  IELTS_PTE: 'IELTS / PTE',
  BANK_LETTER: 'Bank Letter',
  CAS_I20: 'CAS / I-20',
  PHOTO: 'Photo',
  OFFER_LETTER: 'Offer Letter',
};
const REQUIRED_DOC_COUNT = Object.keys(DOC_LABELS).length;
async function loadUnassigned() {
  try {
    const { leads } = await apiFetch('/cases/unassigned');

    const rows = leads.map((l) => `
      <tr>
        <td>${l.student_name}</td>
        <td>${l.target_country}</td>
        <td>${l.visa_category}</td>
        <td>${l.invoice_number || '—'}</td>
        <td>₹${Number(l.total_amount || 0).toLocaleString('en-IN')}</td>
        <td>₹${Number(l.paid_amount || 0).toLocaleString('en-IN')}</td>
        <td>₹${Number(l.outstanding_amount || 0).toLocaleString('en-IN')}</td>
        <td>
          <span class="badge ${l.payment_status === 'Paid' ? 'approved' : 'pending'}">
            ${l.payment_status || 'Pending'}
          </span>
        </td>
        <td>
          <button class="btn-sm" onclick="openAssign(${l.id})">
            Assign Case Officer
          </button>
          <button
            class="btn-sm outline"
            style="margin-left:4px"
            onclick="openInvoiceDetails(${l.id})"
          >
            Details
          </button>
        </td>
      </tr>
    `).join('');

    window.unassignedInvoiceLeads = leads;

        document.getElementById('unassignedBody').innerHTML =
      rows ||
      '<tr><td colspan="9" class="empty-state">Nothing waiting — all audit-approved leads are assigned.</td></tr>';
  } catch (err) {
    showToast(err.message, true);
  }
}

function openInvoiceDetails(leadId) {
  const lead = (window.unassignedInvoiceLeads || []).find(
    (l) => String(l.id) === String(leadId)
  );

  if (!lead) return;

  document.getElementById('invoiceDetailsBody').innerHTML = `
    <tr>
      <td><strong>Student Name</strong></td>
      <td>${lead.student_name || '—'}</td>
    </tr>
    <tr>
      <td><strong>Phone</strong></td>
      <td>${lead.phone || '—'}</td>
    </tr>
    <tr>
      <td><strong>Email</strong></td>
      <td>${lead.email || '—'}</td>
    </tr>
<tr>
  <td><strong>Service Type</strong></td>
  <td>${lead.target_country || '—'}</td>
</tr>
    <tr>
      <td><strong>Invoice No</strong></td>
      <td>${lead.invoice_number || '—'}</td>
    </tr>
    <tr>
      <td><strong>Total Amount</strong></td>
      <td>₹${Number(lead.total_amount || 0).toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <td><strong>Paid Amount</strong></td>
      <td>₹${Number(lead.paid_amount || 0).toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <td><strong>Outstanding</strong></td>
      <td>₹${Number(lead.outstanding_amount || 0).toLocaleString('en-IN')}</td>
    </tr>
    <tr>
  <td><strong>Payment Status</strong></td>
  <td>${lead.payment_status || '—'}</td>
</tr>
<tr>
  <td><strong>Sent to OPS By</strong></td>
  <td>${lead.sent_to_ops_by_name || '—'}</td>
</tr>
<tr>
  <td><strong>Agreement PDF</strong></td>
      <td>
        ${
          lead.agreement_pdf_url
            ? `<a href="${lead.agreement_pdf_url}" target="_blank">View Agreement</a>`
            : '—'
        }
      </td>
    </tr>
  `;

  document.getElementById('invoiceDetailsModal').style.display = 'flex';
}

async function openAssign(leadId) {
  document.getElementById('assignLeadId').value = leadId;
  document.getElementById('targetUniversity').value = '';
  if (!officersCache.length) {
    const { officers } = await apiFetch('/cases/officers');
    officersCache = officers;
  }
  document.getElementById('officerSelect').innerHTML = officersCache
    .map((o) => `<option value="${o.id}">${o.name}${o.specialty ? ' — ' + o.specialty : ''}</option>`).join('');
  document.getElementById('assignModal').style.display = 'flex';
}
document.getElementById('cancelAssign').addEventListener('click', () => { document.getElementById('assignModal').style.display = 'none'; });

document.getElementById('assignForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const leadId = document.getElementById('assignLeadId').value;
  try {
    await apiFetch(`/cases/${leadId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        case_officer_id: document.getElementById('officerSelect').value,
        target_university: document.getElementById('targetUniversity').value,
      }),
    });
    showToast('Case assigned to officer.');
    document.getElementById('assignModal').style.display = 'none';
    loadUnassigned();
    loadBoard();
  } catch (err) { showToast(err.message, true); }
});

const STAGE_LABELS = {
  CHECKLIST_SENT: 'Checklist Sent',
  DOCUMENT_COLLECTION: 'Document Collection',
  SOP_LOR_REVIEW: 'SOP / LOR Review',
  UNIVERSITY_APPLICATION_SUBMITTED: 'University Application Submitted',
  OFFER_RECEIVED: 'Offer Received',
  FINANCIAL_DOCUMENTATION: 'Financial Documentation',
  EMBASSY_SLOT_BOOKED: 'Embassy Slot Booked',
  BIOMETRICS_DONE: 'Biometrics Done',
  VISA_OUTCOME: 'Visa Outcome',
  PRE_DEPARTURE: 'Pre-Departure',
  TRAVEL_ARRIVAL: 'Travel / Arrival',
  STUDENT_ONBOARDING: 'Student Onboarding',
  CASE_CLOSED: 'Case Closed',
};
const CASES_PAGE_SIZE = 20;
let casesCurrentPage = 1;

const isProcessingView =
  new URLSearchParams(window.location.search).get('view') === 'processing';
const casesPageTitle = document.getElementById('casesPageTitle');

if (casesPageTitle) {
  casesPageTitle.innerHTML = isProcessingView
    ? 'Case <span style="color:#f28c18; font-weight:800;">Processing</span>'
    : 'Case Filing <span style="color:#f28c18; font-weight:800;">Ops</span>';
}
function renderCasesPagination(totalRecords) {
  const pagination = document.getElementById('casesPagination');

  if (!pagination) return;

  const totalPages = Math.ceil(
    totalRecords / CASES_PAGE_SIZE
  );

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  html += `
    <button
      type="button"
      class="pagination-btn"
      onclick="changeCasesPage(${casesCurrentPage - 1})"
      ${casesCurrentPage === 1 ? 'disabled' : ''}
    >
      Previous
    </button>
  `;

  for (let page = 1; page <= totalPages; page++) {
    html += `
      <button
        type="button"
        class="pagination-btn ${
          page === casesCurrentPage ? 'active' : ''
        }"
        onclick="changeCasesPage(${page})"
      >
        ${page}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="pagination-btn"
      onclick="changeCasesPage(${casesCurrentPage + 1})"
      ${casesCurrentPage === totalPages ? 'disabled' : ''}
    >
      Next
    </button>
  `;

  pagination.innerHTML = html;
}

function changeCasesPage(page) {
  if (page < 1) {
    return;
  }

  casesCurrentPage = page;
  loadBoard();
}
// =========================================================
// CASE DETAILS TABS
// =========================================================

function setCaseDetailsTab(tabName) {

  const modal =
    document.getElementById('caseDetailsModal');

  if (!modal) {
    return;
  }


  // Active tab
  modal
    .querySelectorAll('.case-details-tab')
    .forEach(tab => {

      tab.classList.toggle(
        'active',
        tab.dataset.tab === tabName
      );

    });


  // Show / hide sections
  modal
    .querySelectorAll('fieldset')
    .forEach(fieldset => {

      const legend =
        fieldset.querySelector('legend');

      const title =
        legend?.textContent
          ?.trim()
          ?.toLowerCase() || '';


      let section = null;


      // Overview
      if (
        title.includes('client') &&
        title.includes('invoice')
      ) {

        section = 'overview';

      }


      // University
      else if (
        title.includes('university application')
      ) {

        section = 'university';

      }


      // Offer
else if (
  title.includes('offer management')
) {
  section = 'offer';
}

// Financial
else if (
  title.includes('financial documentation')
) {
  section = 'financial';
}

// Embassy
else if (
  title.includes('embassy slot')
) {
  section = 'embassy';
}

// Visa
else if (
  title.includes('visa application')
) {
  section = 'visa';
}

      // Biometrics
      else if (
        title.includes('appointment') ||
        title.includes('biometrics')
      ) {

        section = 'biometrics';

      }


      // Pre-Departure
      else if (
        title.includes('pre-departure')
      ) {

        section = 'predeparture';

      }


      // Travel
      else if (
        title.includes('travel') ||
        title.includes('arrival')
      ) {

        section = 'travel';

      }


      // Onboarding
      else if (
        title.includes('student onboarding')
      ) {

        section = 'onboarding';

      }


      // Show only selected section
      fieldset.style.display =
        section === tabName
          ? ''
          : 'none';

    });

}


// Tab click
document
  .querySelectorAll('#caseDetailsModal .case-details-tab')
  .forEach(tab => {

    tab.addEventListener('click', () => {

      setCaseDetailsTab(
        tab.dataset.tab
      );

    });

  });

// Stage change
async function handleCaseStageChange(select) {
  const caseId = select.dataset.caseId;
  const oldStage = select.dataset.currentStage;
  const newStage = select.value;

  if (!caseId || !newStage || newStage === oldStage) {
    return;
  }

  // Visa Outcome needs a separate outcome selection
  if (newStage === 'VISA_OUTCOME') {

    document.getElementById('outcomeCaseId').value = caseId;
    document.getElementById('outcomeModal').style.display = 'flex';

    // Keep the current stage until outcome is submitted
    select.value = oldStage;

    return;
  }

  try {

    await apiFetch(`/cases/${caseId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({
        stage: newStage
      })
    });

    select.dataset.currentStage = newStage;
    select.dataset.stage = newStage;

    await loadBoard();

  } catch (err) {

    select.value = oldStage;
    select.dataset.stage = oldStage;

    alert(err.message || 'Failed to update stage');

  }
}
async function loadBoard() {
  try {
    const { stages, board } = await apiFetch('/cases/board');

    window.caseBoardData = board;
    const stageFilter = document.getElementById('caseStageFilter');

if (stageFilter) {
  const currentStage = stageFilter.value || 'ALL';

  stageFilter.innerHTML = `
    <option value="ALL">All stages</option>
    ${stages.map(stage => `
      <option
        value="${stage}"
        ${stage === currentStage ? 'selected' : ''}
      >
        ${STAGE_LABELS[stage] || stage}
      </option>
    `).join('')}
  `;
}

    const body = document.getElementById('activeCasesBody');

const allCases = stages.flatMap((stage) =>
  (board[stage] || []).map((c) => ({
    ...c,
    current_stage: stage,
  }))
);
// =========================================================
// CASE PROCESSING KPI COUNTS
// =========================================================

const totalActiveCases = allCases.filter(
  c => c.current_stage !== 'CASE_CLOSED'
).length;

const documentsPending = allCases.filter(
  c => Number(c.documents_verified || 0) < REQUIRED_DOC_COUNT
).length;

const inProcessing = allCases.filter(
  c =>
    c.current_stage !== 'CASE_CLOSED' &&
    c.current_stage !== 'VISA_OUTCOME'
).length;

const visaApproved = (board.VISA_OUTCOME || []).filter(
  c =>
    String(c.visa_status || '').toUpperCase() === 'APPROVED'
).length;

const caseClosed = (board.CASE_CLOSED || []).length;


// Update KPI cards

document.getElementById('kpiTotalActiveCases').textContent =
  totalActiveCases;

document.getElementById('kpiDocumentsPending').textContent =
  documentsPending;

document.getElementById('kpiInProcessing').textContent =
  inProcessing;

document.getElementById('kpiVisaApproved').textContent =
  visaApproved;

document.getElementById('kpiCaseClosed').textContent =
  caseClosed;
// Keep flattened cases available for Case Details
window.caseBoardCases = allCases;
const officerFilter =
  document.getElementById('caseOfficerFilter');

if (officerFilter) {
  const currentOfficer =
    officerFilter.value || 'ALL';

  try {
    const { officers } =
      await apiFetch('/cases/officers');

    officerFilter.innerHTML = `
      <option value="ALL">All officers</option>
      ${officers.map(o => `
        <option
          value="${o.id}"
          ${String(o.id) === String(currentOfficer) ? 'selected' : ''}
        >
          ${o.name}
        </option>
      `).join('')}
    `;
  } catch (err) {
    console.error('Could not load case officers:', err);
  }
}
const selectedStage =
  document.getElementById('caseStageFilter')?.value || 'ALL';

const selectedOfficer =
  document.getElementById('caseOfficerFilter')?.value || 'ALL';

const searchInput =
  document.getElementById('caseSearch');

const searchTerm =
  (searchInput?.value || '').trim().toLowerCase();
const caseDate =
  document.getElementById('caseDate')?.value || '';
const filteredCases = allCases.filter((c) => {

  const stageMatch =
    selectedStage === 'ALL' ||
    c.current_stage === selectedStage;

  const officerMatch =
    selectedOfficer === 'ALL' ||
    String(c.officer_id || '') === String(selectedOfficer);

  const searchMatch =
    !searchTerm ||
    String(c.student_name || '').toLowerCase().includes(searchTerm) ||
    String(c.passport_number || '').toLowerCase().includes(searchTerm) ||
    String(c.invoice_number || '').toLowerCase().includes(searchTerm);

const updatedDate = c.updated_at
  ? new Date(c.updated_at).toLocaleDateString('en-CA')
  : '';

const dateMatch =
  !caseDate ||
  updatedDate === caseDate;

return (
  stageMatch &&
  officerMatch &&
  searchMatch &&
  dateMatch
);

});

const totalPages = Math.ceil(
  filteredCases.length / CASES_PAGE_SIZE
);
if (casesCurrentPage > totalPages && totalPages > 0) {
  casesCurrentPage = totalPages;
}

const startIndex =
  (casesCurrentPage - 1) * CASES_PAGE_SIZE;

const pageCases = filteredCases.slice(
  startIndex,
  startIndex + CASES_PAGE_SIZE
);

body.innerHTML = pageCases.length
  ? pageCases.map((c, index) => `
          <tr>
  <td>${startIndex + index + 1}</td>

            <td>
              <strong>${c.student_name}</strong>
            </td>

            <td>
              ${c.target_country || '-'}
            </td>

            <td>
              ${c.visa_category || '-'}
            </td>

            <td>
              ${c.officer_name || '-'}
            </td>

<td>
  <div class="document-progress">
    <span class="document-progress-bar">
      <span
        style="width:${Math.min(
          (Number(c.documents_verified || 0) /
            REQUIRED_DOC_COUNT) *
            100,
          100
        )}%"
      ></span>
    </span>

    <span>
      ${c.documents_verified || 0}/${REQUIRED_DOC_COUNT}
    </span>
  </div>
</td>

<td>
  <button
    type="button"
    class="rejected-files-count"
    title="View rejected documents"
    onclick='showRejectedDocuments(${JSON.stringify(c.rejected_documents || [])})'
  >
    ${Number(c.rejected_count || 0)}
  </button>
</td>

<td>
  <select
    class="case-stage-select"
    data-case-id="${c.id}"
    data-current-stage="${c.current_stage}"
    data-stage="${c.current_stage}"
    onchange="handleCaseStageChange(this)"
  >
    ${stages.map(stage => `
      <option
        value="${stage}"
        ${stage === c.current_stage ? 'selected' : ''}
      >
        ${STAGE_LABELS[stage] || stage}
      </option>
    `).join('')}
  </select>
</td>
</td>

            <td>
              ${c.updated_at
                ? new Date(c.updated_at).toLocaleDateString()
                : '-'}
            </td>

            <td>
              <button
                type="button"
                class="btn-sm outline"
                onclick="openDocuments(
                  ${c.id},
                  '${String(c.student_name || '').replace(/'/g, "\\'")}'
                )"
              >
                📁 Documents
              </button>

              <button
                type="button"
                class="btn-sm outline"
                style="margin-left:4px"
                onclick="openCaseDetails(
                  ${c.id},
                  '${String(c.student_name || '').replace(/'/g, "\\'")}'
                )"
              >
                📄 Details
              </button>
            </td>
          </tr>
        `).join('')
      : `
          <tr>
            <td colspan="9" class="empty-state">
              No active cases found.
            </td>
          </tr>
        `;

    renderCasesPagination(filteredCases.length);

  } catch (err) {
    showToast(err.message, true);
  }
}
document.getElementById('cancelOutcome').addEventListener('click', () => { document.getElementById('outcomeModal').style.display = 'none'; });
document.getElementById('outcomeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const caseId = document.getElementById('outcomeCaseId').value;
  try {
    await apiFetch(`/cases/${caseId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({
        stage: 'VISA_OUTCOME',
        visa_status: document.getElementById('outcomeStatus').value,
        note: document.getElementById('outcomeNote').value,
      }),
    });
    showToast('Visa outcome recorded.');
    document.getElementById('outcomeModal').style.display = 'none';
    loadBoard();
  } catch (err) { showToast(err.message, true); }
});

// ---- Document Repository (Documents button on each Kanban card) ----

async function openDocuments(caseId, studentName) {
  document.getElementById('documentsCaseId').value = caseId;
  document.getElementById('documentsTitle').textContent = `Documents — ${studentName}`;
  document.getElementById('documentsModal').style.display = 'flex';
  await loadDocuments(caseId);
}
document.getElementById('closeDocuments').addEventListener('click', () => {
  document.getElementById('documentsModal').style.display = 'none';
  loadBoard(); // refresh badge counts in case anything was verified/uploaded
});

async function loadDocuments(caseId) {
const isManagement = CURRENT_USER && (
  !isProcessingView &&
  (
    CURRENT_USER.work_profile === 'OPS_MANAGER' ||
    CURRENT_USER.work_profile === 'MD'
  )
); try {
    const { documents } = await apiFetch(`/case-documents/${caseId}`);
    const byType = {};
    documents.forEach((d) => { byType[d.doc_type] = d; });

    const STATUS_BADGE = {
      UPLOADED: '<span class="badge pending">Uploaded — awaiting review</span>',
      VERIFIED: '<span class="badge approved">Verified</span>',
      REJECTED: '<span class="badge rejected">Rejected</span>',
      NOT_REQUIRED: '<span class="badge info">Not Required</span>',
    };

    const rows = Object.keys(DOC_LABELS).map((type) => {
      const doc = byType[type];
      const fileCell = doc
        ? `<a href="${doc.file_url}" target="_blank">${doc.original_filename || 'View'}</a>`
        : '<span class="empty-state">Not uploaded (Pending)</span>';
      const uploadedBy = doc ? (doc.uploaded_by_name || '—') : '—';

      let statusCell;
      if (!doc) {
        statusCell = '<span class="empty-state">—</span>';
      } else if (isManagement) {
        statusCell = `
          <select onchange="setDocStatus(${doc.id}, this.value, ${caseId})">
            <option value="UPLOADED" ${doc.status === 'UPLOADED' ? 'selected' : ''}>Uploaded</option>
            <option value="VERIFIED" ${doc.status === 'VERIFIED' ? 'selected' : ''}>Verified</option>
            <option value="REJECTED" ${doc.status === 'REJECTED' ? 'selected' : ''}>Rejected</option>
            <option value="NOT_REQUIRED" ${doc.status === 'NOT_REQUIRED' ? 'selected' : ''}>Not Required</option>
          </select>
          ${doc.status === 'REJECTED' && doc.rejection_reason ? `<div class="empty-state" style="margin-top:4px">Reason: ${doc.rejection_reason}</div>` : ''}`;
      } else {
        statusCell = STATUS_BADGE[doc.status] || doc.status;
        if (doc.status === 'REJECTED' && doc.rejection_reason) {
          statusCell += `<div class="empty-state" style="margin-top:4px">Reason: ${doc.rejection_reason}</div>`;
        }
      }

      const actionCell = `
        <label class="btn-sm outline" style="cursor:pointer">
          ${doc ? 'Replace' : 'Upload'}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="uploadDoc(${caseId}, '${type}', this.files[0])" />
        </label>`;
      return `<tr><td>${DOC_LABELS[type]}</td><td>${fileCell}</td><td>${uploadedBy}</td><td>${statusCell}</td><td>${actionCell}</td></tr>`;
    }).join('');

       document.getElementById('documentsBody').innerHTML = rows;
    renderAdditionalDocs(caseId, documents, isManagement);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderAdditionalDocs(caseId, documents, isManagement) {
  const STATUS_BADGE = {
    UPLOADED: '<span class="badge pending">Uploaded — awaiting review</span>',
    VERIFIED: '<span class="badge approved">Verified</span>',
    REJECTED: '<span class="badge rejected">Rejected</span>',
    NOT_REQUIRED: '<span class="badge info">Not Required</span>',
  };
  const additional = documents.filter((d) => d.doc_type.startsWith('ADDITIONAL_'));
  const rows = additional.map((doc) => {
    const fileCell = `<a href="${doc.file_url}" target="_blank">${doc.original_filename || 'View'}</a>`;
    const uploadedBy = doc.uploaded_by_name || '—';
    let statusCell;
    if (isManagement) {
      statusCell = `
        <select onchange="setDocStatus(${doc.id}, this.value, ${caseId})">
          <option value="UPLOADED" ${doc.status === 'UPLOADED' ? 'selected' : ''}>Uploaded</option>
          <option value="VERIFIED" ${doc.status === 'VERIFIED' ? 'selected' : ''}>Verified</option>
          <option value="REJECTED" ${doc.status === 'REJECTED' ? 'selected' : ''}>Rejected</option>
          <option value="NOT_REQUIRED" ${doc.status === 'NOT_REQUIRED' ? 'selected' : ''}>Not Required</option>
        </select>
        ${doc.status === 'REJECTED' && doc.rejection_reason ? `<div class="empty-state" style="margin-top:4px">Reason: ${doc.rejection_reason}</div>` : ''}`;
    } else {
      statusCell = STATUS_BADGE[doc.status] || doc.status;
      if (doc.status === 'REJECTED' && doc.rejection_reason) {
        statusCell += `<div class="empty-state" style="margin-top:4px">Reason: ${doc.rejection_reason}</div>`;
      }
    }
    return `<tr><td>${fileCell}</td><td>${uploadedBy}</td><td>${statusCell}</td></tr>`;
  }).join('');
  document.getElementById('additionalDocsBody').innerHTML = rows || '<tr><td colspan="3" class="empty-state">None yet.</td></tr>';

  const input = document.getElementById('additionalDocInput');
  input.value = '';
  input.onchange = () => uploadAdditionalDoc(caseId, input.files[0]);
}

async function uploadAdditionalDoc(caseId, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('doc_type', 'ADDITIONAL');
  fd.append('file', file);
  try {
    await apiFetch(`/case-documents/${caseId}`, { method: 'POST', body: fd });
    showToast('Additional document uploaded.');
    loadDocuments(caseId);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function uploadDoc(caseId, docType, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('doc_type', docType);
  fd.append('file', file);
  try {
    await apiFetch(`/case-documents/${caseId}`, { method: 'POST', body: fd });
    showToast(`${DOC_LABELS[docType]} uploaded.`);
    loadDocuments(caseId);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function setDocStatus(docId, status, caseId) {
  let rejection_reason;
  if (status === 'REJECTED') {
    rejection_reason = window.prompt('Reason for rejecting this document (student/officer will see this):');
    if (!rejection_reason || !rejection_reason.trim()) {
      showToast('Rejection needs a reason — cancelled.', true);
      loadDocuments(caseId);
      return;
    }
  }
  try {
    await apiFetch(`/case-documents/doc/${docId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejection_reason }),
    });
    showToast(`Marked as ${status.replace('_', ' ').toLowerCase()}.`);
    loadDocuments(caseId);
  } catch (err) {
    showToast(err.message, true);
    loadDocuments(caseId);
  }
}

// ---- Case Details modal (University Application / Offer / Visa Application / Appointment) ----

let caseDetailsCaseId = null;

async function openCaseDetails(caseId, studentName) {
  caseDetailsCaseId = caseId;
  await loadFinancialDocumentation();
await loadEmbassySlot();
  document.getElementById('caseDetailsCaseId').value = caseId;
  document.getElementById('caseDetailsTitle').textContent = `Case Details — ${studentName}`;
  document.getElementById('caseDetailsModal').style.display = 'flex';

  // Always open Case Details on Overview
  setCaseDetailsTab('overview');

const { stages, board } =
  await apiFetch('/cases/board');

const allCases = stages.flatMap((stage) =>
  (board[stage] || []).map((c) => ({
    ...c,
    current_stage: stage,
  }))
);

const currentCase = allCases.find(
  (c) => String(c.id) === String(caseId)
);
document.getElementById('case_client_name').value =
  currentCase?.student_name || '';

document.getElementById('case_client_phone').value =
  currentCase?.phone || '';

document.getElementById('case_client_email').value =
  currentCase?.email || '';

document.getElementById('case_client_country').value =
  currentCase?.target_country || '';

document.getElementById('case_visa_category').value =
  currentCase?.visa_category || '';



/* =========================================================
   CASE DETAILS TOP SUMMARY
   ========================================================= */

const summaryName =
  currentCase?.student_name || studentName || '-';

const summaryAvatar =
  summaryName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(name => name.charAt(0).toUpperCase())
    .join('');


document.getElementById('case_summary_avatar').textContent =
  summaryAvatar || 'C';

document.getElementById('case_summary_client_name').textContent =
  summaryName;

document.getElementById('case_summary_phone').textContent =
  currentCase?.phone || '-';

document.getElementById('case_summary_email').textContent =
  currentCase?.email || '-';

document.getElementById('case_summary_country').textContent =
  currentCase?.target_country || '-';

document.getElementById('case_summary_visa_category').textContent =
  currentCase?.visa_category || '-';


document.getElementById('case_summary_invoice_number').textContent =
  currentCase?.invoice_number || '-';


document.getElementById('case_summary_total_amount').textContent =
  currentCase?.total_amount != null
    ? `₹${Number(currentCase.total_amount).toLocaleString('en-IN')}`
    : '₹0';

document.getElementById('case_summary_paid_amount').textContent =
  currentCase?.paid_amount != null
    ? `₹${Number(currentCase.paid_amount).toLocaleString('en-IN')}`
    : '₹0';

document.getElementById('case_summary_outstanding_amount').textContent =
  currentCase?.outstanding_amount != null
    ? `₹${Number(currentCase.outstanding_amount).toLocaleString('en-IN')}`
    : '₹0';


document.getElementById('case_summary_payment_status').textContent =
  currentCase?.payment_status || 'Pending';


document.getElementById('case_summary_sent_to_ops').textContent =
  currentCase?.sent_to_ops_by_name || '-';


const summaryAgreement =
  document.getElementById('case_summary_agreement');

const summaryNoAgreement =
  document.getElementById('case_summary_no_agreement');


if (currentCase?.agreement_pdf_url) {

  summaryAgreement.href =
    currentCase.agreement_pdf_url;

  summaryAgreement.style.display =
    'inline-block';

  summaryNoAgreement.style.display =
    'none';

} else {

  summaryAgreement.href =
    '#';

  summaryAgreement.style.display =
    'none';

  summaryNoAgreement.style.display =
    'inline';

}


/* =========================================================
   EXISTING CLIENT & INVOICE DETAILS
   ========================================================= */

document.getElementById('case_client_name').value =
  currentCase?.student_name || '';

document.getElementById('case_client_phone').value =
  currentCase?.phone || '';

document.getElementById('case_client_email').value =
  currentCase?.email || '';

document.getElementById('case_client_country').value =
  currentCase?.target_country || '';

document.getElementById('case_visa_category').value =
  currentCase?.visa_category || '';

document.getElementById('case_invoice_number').value =
  currentCase?.invoice_number || '';

document.getElementById('case_total_amount').value =
  currentCase?.total_amount != null
    ? `₹${Number(currentCase.total_amount).toLocaleString('en-IN')}`
    : '';

document.getElementById('case_paid_amount').value =
  currentCase?.paid_amount != null
    ? `₹${Number(currentCase.paid_amount).toLocaleString('en-IN')}`
    : '';

document.getElementById('case_outstanding_amount').value =
  currentCase?.outstanding_amount != null
    ? `₹${Number(currentCase.outstanding_amount).toLocaleString('en-IN')}`
    : '';

document.getElementById('case_payment_status').value =
  currentCase?.payment_status || 'Pending';

const agreementLink = document.getElementById('case_agreement_pdf');
const noAgreement = document.getElementById('case_no_agreement');
if (currentCase?.agreement_pdf_url) {
  agreementLink.href = currentCase.agreement_pdf_url;
  agreementLink.style.display = 'inline-block';
  noAgreement.style.display = 'none';
} else {
  agreementLink.href = '#';
  agreementLink.style.display = 'none';
  noAgreement.style.display = 'inline';
}

try {
    const { universityApplication: ua, offer: of, visaApplication: va, appointment: ap } =
      await apiFetch(`/case-details/${caseId}`);

    const { preDeparture: pd } =
      await apiFetch(`/cases/${caseId}/pre-departure`);

    const { travelArrival: ta } =
      await apiFetch(`/cases/${caseId}/travel-arrival`);

    const { studentOnboarding: so } =
      await apiFetch(`/cases/${caseId}/student-onboarding`);

    
    document.getElementById('ua_university').value = ua?.university || '';
    document.getElementById('ua_course').value = ua?.course || '';
    document.getElementById('ua_intake').value = ua?.intake || '';
    document.getElementById('ua_application_number').value = ua?.application_number || '';
    document.getElementById('ua_application_date').value = ua?.application_date ? ua.application_date.slice(0, 10) : '';
    document.getElementById('ua_status').value = ua?.status || 'SUBMITTED';

    document.getElementById('of_university').value = of?.university || '';
    document.getElementById('of_course').value = of?.course || '';
    document.getElementById('of_intake').value = of?.intake || '';
    document.getElementById('of_offer_date').value = of?.offer_date ? of.offer_date.slice(0, 10) : '';
    document.getElementById('of_is_conditional').value = String(!!of?.is_conditional);
    document.getElementById('of_offer_status').value = of?.offer_status || 'RECEIVED';
    document.getElementById('of_conditions').value = of?.conditions || '';

    document.getElementById('va_application_number').value = va?.application_number || '';
    document.getElementById('va_submission_date').value = va?.submission_date ? va.submission_date.slice(0, 10) : '';
    document.getElementById('va_status').value = va?.status || 'PREPARING';
    document.getElementById('va_notes').value = va?.notes || '';

    document.getElementById('ap_appointment_date').value = ap?.appointment_date ? ap.appointment_date.slice(0, 10) : '';
    document.getElementById('ap_appointment_time').value = ap?.appointment_time || '';
    document.getElementById('ap_location').value = ap?.location || '';
    document.getElementById('ap_booking_reference').value = ap?.booking_reference || '';
    document.getElementById('ap_is_rescheduled').value = String(!!ap?.is_rescheduled);
    document.getElementById('ap_biometrics_date').value = ap?.biometrics_date ? ap.biometrics_date.slice(0, 10) : '';
    document.getElementById('ap_biometrics_completed').value = String(!!ap?.biometrics_completed);
    document.getElementById('pd_briefing_completed').value =
  String(!!pd?.briefing_completed);

document.getElementById('pd_documents_confirmed').value =
  String(!!pd?.documents_confirmed);

document.getElementById('pd_accommodation_confirmed').value =
  String(!!pd?.accommodation_confirmed);

document.getElementById('pd_travel_guidance_completed').value =
  String(!!pd?.travel_guidance_completed);

document.getElementById('pd_departure_date').value =
  pd?.departure_date ? pd.departure_date.slice(0, 10) : '';

document.getElementById('pd_notes').value =
  pd?.notes || '';
  document.getElementById('ta_flight_number').value =
  ta?.flight_number || '';

document.getElementById('ta_departure_date').value =
  ta?.departure_date ? ta.departure_date.slice(0, 10) : '';

document.getElementById('ta_arrival_date').value =
  ta?.arrival_date ? ta.arrival_date.slice(0, 10) : '';

document.getElementById('ta_departure_city').value =
  ta?.departure_city || '';

document.getElementById('ta_arrival_city').value =
  ta?.arrival_city || '';

document.getElementById('ta_travel_confirmed').value =
  String(!!ta?.travel_confirmed);

document.getElementById('ta_arrival_confirmed').value =
  String(!!ta?.arrival_confirmed);

document.getElementById('ta_notes').value =
  ta?.notes || '';
  document.getElementById('so_student_arrived').value =
  String(!!so?.student_arrived);

document.getElementById('so_university_joined').value =
  String(!!so?.university_joined);

document.getElementById('so_accommodation_confirmed').value =
  String(!!so?.accommodation_confirmed);

document.getElementById('so_onboarding_completed').value =
  String(!!so?.onboarding_completed);

document.getElementById('so_joining_date').value =
  so?.joining_date ? so.joining_date.slice(0, 10) : '';

document.getElementById('so_notes').value =
  so?.notes || '';
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('closeCaseDetails').addEventListener('click', () => {
  document.getElementById('caseDetailsModal').style.display = 'none';
  caseDetailsCaseId = null;
});

async function saveUniversityApplication() {
  try {
    await apiFetch(`/case-details/${caseDetailsCaseId}/university-application`, {
      method: 'PUT',
      body: JSON.stringify({
        university: document.getElementById('ua_university').value,
        course: document.getElementById('ua_course').value,
        intake: document.getElementById('ua_intake').value,
        application_number: document.getElementById('ua_application_number').value,
        application_date: document.getElementById('ua_application_date').value || null,
        status: document.getElementById('ua_status').value,
      }),
    });
    showToast('University Application saved.');
  } catch (err) { showToast(err.message, true); }
}

async function saveOffer() {
  try {
    await apiFetch(`/case-details/${caseDetailsCaseId}/offer`, {
      method: 'PUT',
      body: JSON.stringify({
        university: document.getElementById('of_university').value,
        course: document.getElementById('of_course').value,
        intake: document.getElementById('of_intake').value,
        offer_date: document.getElementById('of_offer_date').value || null,
        is_conditional: document.getElementById('of_is_conditional').value === 'true',
        conditions: document.getElementById('of_conditions').value,
        offer_status: document.getElementById('of_offer_status').value,
      }),
    });
    showToast('Offer saved.');
  } catch (err) { showToast(err.message, true); }
}

async function saveVisaApplication() {
  try {
    await apiFetch(`/case-details/${caseDetailsCaseId}/visa-application`, {
      method: 'PUT',
      body: JSON.stringify({
        application_number: document.getElementById('va_application_number').value,
        submission_date: document.getElementById('va_submission_date').value || null,
        status: document.getElementById('va_status').value,
        notes: document.getElementById('va_notes').value,
      }),
    });
    showToast('Visa Application saved.');
  } catch (err) { showToast(err.message, true); }
}
async function loadFinancialDocumentation() {

  try {

    const data = await apiFetch(
      `/cases/${caseDetailsCaseId}/financial-documentation`
    );

    const fd = data.financialDocumentation;

    if (!fd) {
      return;
    }

    document.getElementById('fd_financial_institution').value =
      fd.financial_institution || '';

    document.getElementById('fd_funds_amount').value =
      fd.funds_amount || '';

    document.getElementById('fd_currency').value =
      fd.currency || 'INR';

    document.getElementById('fd_document_type').value =
      fd.document_type || '';

    document.getElementById('fd_document_date').value =
      fd.document_date ? String(fd.document_date).slice(0, 10) : '';

    document.getElementById('fd_verification_status').value =
      fd.verification_status || 'PENDING';

    document.getElementById('fd_notes').value =
      fd.notes || '';

  } catch (err) {

    console.error(
      'Failed to load Financial Documentation:',
      err
    );

  }
}


async function loadEmbassySlot() {

  try {

    const data = await apiFetch(
      `/cases/${caseDetailsCaseId}/embassy-slot`
    );

    const es = data.embassySlot;

    if (!es) {
      return;
    }

    document.getElementById('es_embassy_vfs_center').value =
      es.embassy_vfs_center || '';

    document.getElementById('es_appointment_date').value =
      es.appointment_date ? String(es.appointment_date).slice(0, 10) : '';

    document.getElementById('es_appointment_time').value =
      es.appointment_time ? String(es.appointment_time).slice(0, 5) : '';

    document.getElementById('es_location').value =
      es.location || '';

    document.getElementById('es_reference_number').value =
      es.reference_number || '';

    document.getElementById('es_appointment_status').value =
      es.appointment_status || 'PENDING';

    document.getElementById('es_notes').value =
      es.notes || '';

  } catch (err) {

    console.error(
      'Failed to load Embassy Slot:',
      err
    );

  }

}
async function saveFinancialDocumentation() {
  try {
    await apiFetch(`/cases/${caseDetailsCaseId}/financial-documentation`, {
      method: 'PUT',
      body: JSON.stringify({
        financial_institution:
          document.getElementById('fd_financial_institution').value,

        funds_amount:
          document.getElementById('fd_funds_amount').value || null,

        currency:
          document.getElementById('fd_currency').value,

        document_type:
          document.getElementById('fd_document_type').value,

        document_date:
          document.getElementById('fd_document_date').value || null,

        verification_status:
          document.getElementById('fd_verification_status').value,

        notes:
          document.getElementById('fd_notes').value
      })
    });

    showToast('Financial Documentation saved.');

  } catch (err) {
    showToast(err.message, true);
  }
}


async function saveEmbassySlot() {
  try {
    await apiFetch(`/cases/${caseDetailsCaseId}/embassy-slot`, {
      method: 'PUT',
      body: JSON.stringify({
        embassy_vfs_center:
          document.getElementById('es_embassy_vfs_center').value,

        appointment_date:
          document.getElementById('es_appointment_date').value || null,

        appointment_time:
          document.getElementById('es_appointment_time').value || null,

        location:
          document.getElementById('es_location').value,

        reference_number:
          document.getElementById('es_reference_number').value,

        appointment_status:
          document.getElementById('es_appointment_status').value,

        notes:
          document.getElementById('es_notes').value
      })
    });

    showToast('Embassy Slot saved.');

  } catch (err) {
    showToast(err.message, true);
  }
}
async function saveAppointment() {
  
  try {
    await apiFetch(`/case-details/${caseDetailsCaseId}/appointment`, {
      method: 'PUT',
      body: JSON.stringify({
        appointment_date: document.getElementById('ap_appointment_date').value || null,
        appointment_time: document.getElementById('ap_appointment_time').value,
        location: document.getElementById('ap_location').value,
        booking_reference: document.getElementById('ap_booking_reference').value,
        is_rescheduled: document.getElementById('ap_is_rescheduled').value === 'true',
        biometrics_date: document.getElementById('ap_biometrics_date').value || null,
        biometrics_completed: document.getElementById('ap_biometrics_completed').value === 'true',
      }),
    });
    showToast('Appointment saved.');
  } catch (err) { showToast(err.message, true); }
}
async function savePreDeparture() {
  try {
    await apiFetch(`/cases/${caseDetailsCaseId}/pre-departure`, {
      method: 'PUT',
      body: JSON.stringify({
        briefing_completed:
          document.getElementById('pd_briefing_completed').value === 'true',

        documents_confirmed:
          document.getElementById('pd_documents_confirmed').value === 'true',

        accommodation_confirmed:
          document.getElementById('pd_accommodation_confirmed').value === 'true',

        travel_guidance_completed:
          document.getElementById('pd_travel_guidance_completed').value === 'true',

        departure_date:
          document.getElementById('pd_departure_date').value || null,

        notes:
          document.getElementById('pd_notes').value
      })
    });

    showToast('Pre-Departure saved successfully.');
  } catch (err) {
    showToast(err.message, true);
  }
}
async function saveTravelArrival() {
  try {
    await apiFetch(`/cases/${caseDetailsCaseId}/travel-arrival`, {
      method: 'PUT',
      body: JSON.stringify({
        flight_number:
          document.getElementById('ta_flight_number').value,

        departure_date:
          document.getElementById('ta_departure_date').value || null,

        arrival_date:
          document.getElementById('ta_arrival_date').value || null,

        departure_city:
          document.getElementById('ta_departure_city').value,

        arrival_city:
          document.getElementById('ta_arrival_city').value,

        travel_confirmed:
          document.getElementById('ta_travel_confirmed').value === 'true',

        arrival_confirmed:
          document.getElementById('ta_arrival_confirmed').value === 'true',

        notes:
          document.getElementById('ta_notes').value
      })
    });

    showToast('Travel / Arrival saved successfully.');
  } catch (err) {
    showToast(err.message, true);
  }
}
async function saveStudentOnboarding() {
  try {
    await apiFetch(`/cases/${caseDetailsCaseId}/student-onboarding`, {
      method: 'PUT',
      body: JSON.stringify({
        student_arrived:
          document.getElementById('so_student_arrived').value === 'true',

        university_joined:
          document.getElementById('so_university_joined').value === 'true',

        accommodation_confirmed:
          document.getElementById('so_accommodation_confirmed').value === 'true',

        onboarding_completed:
          document.getElementById('so_onboarding_completed').value === 'true',

        joining_date:
          document.getElementById('so_joining_date').value || null,

        notes:
          document.getElementById('so_notes').value
      })
    });

    showToast('Student Onboarding saved successfully.');
  } catch (err) {
    showToast(err.message, true);
  }
}
(async () => {
  const isProcessingView =
    new URLSearchParams(window.location.search).get('view') === 'processing';

  CURRENT_USER = await renderSidebar(
    isProcessingView ? 'case-processing' : 'cases'
  );

  if (!CURRENT_USER) return;

 const userWorkProfiles =
  CURRENT_USER.work_profiles || [CURRENT_USER.work_profile];

const canAssign =
  userWorkProfiles.includes('OPS_MANAGER') ||
  userWorkProfiles.includes('MD');
  if (canAssign && !isProcessingView) {
  loadUnassigned();
} else {
  document.getElementById('unassignedSection').style.display = 'none';
}

    loadBoard();

  const caseSearch = document.getElementById('caseSearch');

  if (caseSearch) {
    caseSearch.addEventListener('input', () => {
      casesCurrentPage = 1;
      loadBoard();
    });
  }
  const caseStageFilter =
  document.getElementById('caseStageFilter');

if (caseStageFilter) {
  caseStageFilter.addEventListener('change', () => {
    casesCurrentPage = 1;
    loadBoard();
  });
}

const caseOfficerFilter =
  document.getElementById('caseOfficerFilter');

if (caseOfficerFilter) {
  caseOfficerFilter.addEventListener('change', () => {
    casesCurrentPage = 1;
    loadBoard();
  });
}


const caseDate =
  document.getElementById('caseDate');

if (caseDate) {
  caseDate.addEventListener('change', () => {
    casesCurrentPage = 1;
    loadBoard();
  });
}


})();
function showRejectedDocuments(documents) {
  const modal =
    document.getElementById('rejectedDocumentsModal');

  const body =
    document.getElementById('rejectedDocumentsBody');

  if (!modal || !body) {
    return;
  }

  if (!documents || !documents.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:30px;">
        No rejected documents found.
      </div>
    `;

    modal.style.display = 'flex';
    return;
  }

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${documents.map((doc, index) => `
        <div
          style="
            padding:16px;
            border:1px solid #fecaca;
            border-radius:10px;
            background:#fff7f7;
          "
        >
          <div
            style="
              font-weight:800;
              color:#dc2626;
              margin-bottom:6px;
            "
          >
            ${index + 1}. ${doc.doc_type || 'Document'}
          </div>

          <div
            style="
              font-size:13px;
              color:#6b7280;
            "
          >
            <strong>Rejection Reason:</strong>
            ${doc.rejection_reason || 'No reason provided'}
          </div>

          ${
            doc.rejected_at
              ? `
                <div
                  style="
                    margin-top:6px;
                    font-size:12px;
                    color:#9ca3af;
                  "
                >
                  Rejected on:
                  ${new Date(doc.rejected_at).toLocaleString()}
                </div>
              `
              : ''
          }
        </div>
      `).join('')}
    </div>
  `;

  modal.style.display = 'flex';
}


function closeRejectedDocuments() {
  const modal =
    document.getElementById('rejectedDocumentsModal');

  if (modal) {
    modal.style.display = 'none';
  }
}