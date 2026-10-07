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

  function getAvatarClass(index) {
    const classes = [
      'avatar-blue',
      'avatar-purple',
      'avatar-green',
      'avatar-orange',
      'avatar-pink',
    ];

    return classes[index % classes.length];
  }

  function getRoleClass(role) {
    const value = (role || '').toLowerCase();

    if (value === 'employee') return 'role-employee';
    if (value === 'manager') return 'role-manager';
    if (value === 'mis-executive') return 'role-mis';

    if (
      value.includes('consultant') ||
      value.includes('process')
    ) {
      return 'role-consultant';
    }

    return 'role-default';
  }

  function getWorkClass(workProfile) {
    const value = (workProfile || '').toLowerCase();

    if (value === 'counselor') return 'work-counselor';
    if (value === 'case_officer') return 'work-case';
    if (value === 'auditor') return 'work-auditor';
    if (value === 'ops_manager') return 'work-manager';

    return 'work-default';
  }

  function formatValue(value) {
    if (!value) return '—';

    return value.replaceAll('_', ' ');
  }

  function renderEmployees(employees) {

    const rows = employees.map((e, index) => `

      <tr>

        <td class="serial-number">
          ${index + 1}
        </td>

        <td>

          <div class="employee-info">

            <div
              class="employee-avatar"
              style="
                background:
                  ${[
                    '#e8ddff',
                    '#ffe1eb',
                    '#dcecff',
                    '#d9f6ea',
                    '#ffe8d1'
                  ][index % 5]};
                color:
                  ${[
                    '#7b4ed1',
                    '#d94d82',
                    '#3578d4',
                    '#15966a',
                    '#df7a1b'
                  ][index % 5]};
              "
            >
              ${getInitial(e.name)}
            </div>

            <div class="employee-name">
              ${e.name}
            </div>

          </div>

        </td>

        <td>
          <span class="employee-email">
            ${e.email}
          </span>
        </td>

        <td>
          <span class="password-value">
            ${e.display_password || '—'}
          </span>
        </td>

        <td>

          <span class="role-badge ${getRoleClass(e.role)}">
            ${formatValue(e.role)}
          </span>

        </td>

        <td>

          <span class="work-badge ${getWorkClass(e.work_profile)}">
            ${formatValue(e.work_profile)}
          </span>

        </td>

        <td>
          ${e.branch_name || '—'}
        </td>

        <td>

          <span
            class="status-badge ${
              e.is_active ? 'active' : 'inactive'
            }"
          >

            <span class="status-dot"></span>

            ${e.is_active ? 'Active' : 'Inactive'}

          </span>

        </td>

        <td>

          <div class="action-wrap">

            <button
              type="button"
              class="employee-edit-btn"
              data-edit="${e.id}"
            >
              ✎ Edit
            </button>

            <button
  type="button"
  class="employee-more-btn"
  title="More options"
  data-id="${e.id}"
>
  ⋮
</button>

          </div>

        </td>

      </tr>

    `).join('');

    document.getElementById('employeesBody').innerHTML =
      rows ||
      `
        <tr>
          <td colspan="9" class="empty-state">
            No employees found.
          </td>
        </tr>
      `;

    document.getElementById('employeeCountText').textContent =
      `Showing ${employees.length} employee${employees.length === 1 ? '' : 's'}`;

    document.querySelectorAll('[data-edit]').forEach((btn) => {

      btn.addEventListener('click', () => {

        const employee = allEmployees.find(
          (e) => e.id === btn.dataset.edit
        );

        openEditModal(employee);

      });

    });
    document.querySelectorAll('.employee-more-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const employee = allEmployees.find(
      (e) => e.id === btn.dataset.id
    );

    if (!employee) return;

    const action = employee.is_active
      ? 'Set this employee as inactive?'
      : 'Set this employee as active?';

    if (!confirm(action)) return;

    try {
      await apiFetch(`/employees/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: !employee.is_active
        })
      });

      showToast(
        employee.is_active
          ? 'Employee set to inactive'
          : 'Employee set to active'
      );

      loadEmployees();

    } catch (err) {
      showToast(err.message, true);
    }
  });
});
  }


  async function loadEmployees() {

    try {

      const { employees } = await apiFetch('/employees');

      allEmployees = employees;

document.getElementById('employeeSearch').value = '';
document.getElementById('employeeStatusFilter').value = 'all';

const active =
  employees.filter((e) => e.is_active).length;
      const inactive =
        employees.length - active;

      document.getElementById('employeeStatGrid').innerHTML = `

        <div class="stat-card">

          <div class="label">
            Total Employees
          </div>

          <div class="value">
            ${employees.length}
          </div>

        </div>

        <div class="stat-card green">

          <div class="label">
            Active
          </div>

          <div class="value">
            ${active}
          </div>

        </div>

        <div class="stat-card red">

          <div class="label">
            Inactive
          </div>

          <div class="value">
            ${inactive}
          </div>

        </div>

      `;

      renderEmployees(employees);

    } catch (err) {

      showToast(err.message, true);

    }

  }


  // SEARCH + STATUS FILTER

  function applyFilters() {

    const search =
      document
        .getElementById('employeeSearch')
        .value
        .trim()
        .toLowerCase();

    const status =
      document.getElementById('employeeStatusFilter').value;

    const filtered = allEmployees.filter((e) => {

      const matchesSearch =
        !search ||
        (e.name || '').toLowerCase().includes(search) ||
        (e.email || '').toLowerCase().includes(search) ||
        (e.role || '').toLowerCase().includes(search) ||
        (e.work_profile || '').toLowerCase().includes(search) ||
        (e.branch_name || '').toLowerCase().includes(search);

      const matchesStatus =
        status === 'all' ||
        (status === 'active' && e.is_active) ||
        (status === 'inactive' && !e.is_active);

      return matchesSearch && matchesStatus;

    });

    renderEmployees(filtered);
  }


document.querySelectorAll('.page-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('employeeSearch').value = '';
    document.getElementById('employeeStatusFilter').value = 'all';

    renderEmployees(allEmployees);
  });
});

  document
    .getElementById('employeeSearch')
    .addEventListener('input', applyFilters);

 


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
            }>
              ${r.replaceAll('_', ' ')}
            </option>`
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
            }>
              ${b.branch_name} (${b.city})
            </option>`
        )
        .join('');

    document.getElementById('editName').value =
      employee.name;

    document.getElementById('editSpecialty').value =
      employee.specialty || '';

    document.getElementById('editActive').value =
      String(employee.is_active);

    document.getElementById('editPassword').value = '';
const editWorkProfiles =
  employee.work_profiles || [employee.work_profile];

document
  .querySelectorAll(
    'input[name="edit_work_profile"]'
  )
  .forEach(input => {

    input.checked =
      editWorkProfiles.includes(input.value);

    input
      .closest('.work-profile-card')
      ?.classList.toggle(
        'selected',
        input.checked
      );

  });
    document.getElementById('editError').innerHTML = '';

    document.getElementById('editEmployeeModal').style.display =
      'flex';
  }


  document
    .getElementById('closeEditBtn')
    .addEventListener('click', () => {

      document.getElementById(
        'editEmployeeModal'
      ).style.display = 'none';

    });


  document
    .getElementById('saveEditBtn')
    .addEventListener('click', async () => {

      const errorBox =
        document.getElementById('editError');

      errorBox.innerHTML = '';
const workProfiles =
  [...document.querySelectorAll(
    'input[name="edit_work_profile"]:checked'
  )].map(input => input.value);
      const payload = {

        name:
          document
            .getElementById('editName')
            .value
            .trim(),

        role:
          document.getElementById('editRole').value,
        work_profiles: workProfiles,
        specialty:
          document
            .getElementById('editSpecialty')
            .value
            .trim() || null,

        branch_id:
          document.getElementById('editBranch').value || null,

        is_active:
          document
            .getElementById('editActive')
            .value === 'true',

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

        document.getElementById(
          'editEmployeeModal'
        ).style.display = 'none';

        showToast('Employee updated');

        loadEmployees();

      } catch (err) {

        errorBox.innerHTML =
          `<div class="error-msg">${err.message}</div>`;

      }

    });


  loadEmployees();

})();