(async () => {
  await renderSidebar('employees');

  let metaCache = null;
  let currentEditId = null;
  let allEmployees = [];

  async function loadMeta() {
    if (!metaCache) {
      metaCache = await apiFetch('/employees/meta');
    }
    return metaCache;
  }

  function getInitial(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  function formatValue(value) {
    return value
      ? value.replaceAll('_', ' ')
      : '—';
  }

  function renderEmployees(employees) {
    const rows = employees.map((e) => `
      <tr>

        <td>
          <div class="employee-info">
            <div class="employee-avatar">
              ${getInitial(e.name)}
            </div>

            <div>
              <div class="employee-name">
                ${e.name}
              </div>
            </div>
          </div>
        </td>

        <td>
          <div class="employee-email">
            ${e.email}
          </div>
        </td>

        <td>
          <span class="password-value">
            ${e.display_password || '—'}
          </span>
        </td>

        <td>
          <span class="role-badge">
            ${formatValue(e.role)}
          </span>
        </td>

        <td>
          <span class="work-badge">
            ${formatValue(e.work_profile)}
          </span>
        </td>

        <td>
          ${e.branch_name || '—'}
        </td>

        <td>
          <span class="status-badge ${e.is_active ? 'active' : 'inactive'}">
            <span class="status-dot"></span>
            ${e.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>

        <td>
          <button
            type="button"
            class="employee-action"
            data-edit="${e.id}"
          >
            Edit
          </button>
        </td>

      </tr>
    `).join('');

    document.getElementById('employeesBody').innerHTML =
      rows ||
      '<tr><td colspan="8" class="empty-state">No employees found.</td></tr>';

    document.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const employee = allEmployees.find(
          (e) => e.id === btn.dataset.edit
        );

        openEditModal(employee);
      });
    });
  }

  async function loadEmployees() {
    try {
      const { employees } = await apiFetch('/employees');

      allEmployees = employees;

      const active = employees.filter((e) => e.is_active).length;
      const inactive = employees.length - active;

      document.getElementById('employeeStatGrid').innerHTML = `
        <div class="stat-card">
          <div class="label">Total Employees</div>
          <div class="value">${employees.length}</div>
        </div>

        <div class="stat-card green">
          <div class="label">Active</div>
          <div class="value">${active}</div>
        </div>

        <div class="stat-card red">
          <div class="label">Inactive</div>
          <div class="value">${inactive}</div>
        </div>
      `;

      renderEmployees(employees);

    } catch (err) {
      showToast(err.message, true);
    }
  }


  // SEARCH
  document.getElementById('employeeSearch').addEventListener('input', (event) => {
    const search = event.target.value.trim().toLowerCase();

    if (!search) {
      renderEmployees(allEmployees);
      return;
    }

    const filtered = allEmployees.filter((e) =>
      (e.name || '').toLowerCase().includes(search) ||
      (e.email || '').toLowerCase().includes(search) ||
      (e.role || '').toLowerCase().includes(search) ||
      (e.work_profile || '').toLowerCase().includes(search) ||
      (e.branch_name || '').toLowerCase().includes(search)
    );

    renderEmployees(filtered);
  });


  async function openEditModal(employee) {
    if (!employee) return;

    currentEditId = employee.id;

    const meta = await loadMeta();

    document.getElementById('editRole').innerHTML =
      meta.roles
        .map(
          (r) =>
            `<option value="${r}" ${
              r === employee.role ? 'selected' : ''
            }>${r.replaceAll('_', ' ')}</option>`
        )
        .join('');

    document.getElementById('editBranch').innerHTML =
      '<option value="">— No branch —</option>' +
      meta.branches
        .map(
          (b) =>
            `<option value="${b.id}" ${
              b.branch_name === employee.branch_name
                ? 'selected'
                : ''
            }>${b.branch_name} (${b.city})</option>`
        )
        .join('');

    document.getElementById('editName').value =
      employee.name;

    document.getElementById('editSpecialty').value =
      employee.specialty || '';

    document.getElementById('editActive').value =
      String(employee.is_active);

    document.getElementById('editPassword').value = '';

    document.getElementById('editError').innerHTML = '';

    document.getElementById('editEmployeeModal').style.display =
      'flex';
  }


  document.getElementById('closeEditBtn').addEventListener('click', () => {
    document.getElementById('editEmployeeModal').style.display =
      'none';
  });


  document.getElementById('saveEditBtn').addEventListener('click', async () => {

    const errorBox = document.getElementById('editError');

    errorBox.innerHTML = '';

    const payload = {
      name: document.getElementById('editName').value.trim(),
      role: document.getElementById('editRole').value,
      specialty:
        document.getElementById('editSpecialty').value.trim() || null,
      branch_id:
        document.getElementById('editBranch').value || null,
      is_active:
        document.getElementById('editActive').value === 'true',
    };

    const newPassword =
      document.getElementById('editPassword').value;

    if (newPassword) {
      payload.password = newPassword;
    }

    try {

      await apiFetch(
        `/employees/${currentEditId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      document.getElementById('editEmployeeModal').style.display =
        'none';

      showToast('Employee updated');

      loadEmployees();

    } catch (err) {

      errorBox.innerHTML =
        `<div class="error-msg">${err.message}</div>`;

    }
  });


  loadEmployees();

})();