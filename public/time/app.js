const API = '/api/time';

let config = { slots: [], anyChoice: '随便', maxUsers: 12 };
let currentPreferences = [];

const els = {
  filledCount: document.getElementById('filledCount'),
  maxCount: document.getElementById('maxCount'),
  progressFill: document.getElementById('progressFill'),
  progressHint: document.getElementById('progressHint'),
  formTitle: document.getElementById('formTitle'),
  userName: document.getElementById('userName'),
  preferenceList: document.getElementById('preferenceList'),
  submitBtn: document.getElementById('submitBtn'),
  loadBtn: document.getElementById('loadBtn'),
  formMessage: document.getElementById('formMessage'),
  nameList: document.getElementById('nameList'),
  resultCard: document.getElementById('resultCard'),
  resultBody: document.getElementById('resultBody'),
  slotStats: document.getElementById('slotStats'),
  formCard: document.querySelector('.form-card'),
  adminToggle: document.getElementById('adminToggle'),
  adminContent: document.getElementById('adminContent'),
  resetBtn: document.getElementById('resetBtn'),
  forceAssignBtn: document.getElementById('forceAssignBtn'),
  adminMessage: document.getElementById('adminMessage'),
};

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function showMessage(text, type = 'info') {
  els.formMessage.textContent = text;
  els.formMessage.className = `form-message show ${type}`;
}

function clearMessage() {
  els.formMessage.className = 'form-message';
}

function showAdminMessage(text, type = 'info') {
  els.adminMessage.textContent = text;
  els.adminMessage.className = `form-message show ${type}`;
}

function getAnyIndex() {
  return currentPreferences.indexOf(config.anyChoice);
}

function buildPreferenceRows(selected = []) {
  els.preferenceList.innerHTML = '';
  currentPreferences = [];

  const anyIdx = selected.indexOf(config.anyChoice);

  for (let i = 0; i < config.slots.length; i++) {
    const row = document.createElement('div');
    row.className = 'preference-row';

    const rankLabel = document.createElement('span');
    rankLabel.className = `pref-rank rank-${Math.min(i + 1, 2)}`;
    rankLabel.textContent = `第 ${i + 1} 志愿`;

    const select = document.createElement('select');
    select.dataset.rank = i;

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— 请选择 —';
    select.appendChild(emptyOpt);

    config.slots.forEach((slot) => {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = slot;
      select.appendChild(opt);
    });

    const anyOpt = document.createElement('option');
    anyOpt.value = config.anyChoice;
    anyOpt.textContent = config.anyChoice;
    select.appendChild(anyOpt);

    if (anyIdx >= 0 && i > anyIdx) {
      select.disabled = true;
    } else if (selected[i]) {
      select.value = selected[i];
      currentPreferences[i] = selected[i];
    }

    select.addEventListener('change', () => {
      currentPreferences[i] = select.value;
      const anyAt = getAnyIndex();
      applyAnyMode(anyAt);
      updateSelectOptions();
    });

    row.appendChild(rankLabel);
    row.appendChild(select);
    els.preferenceList.appendChild(row);
  }

  if (anyIdx >= 0) {
    applyAnyMode(anyIdx);
  }
  updateSelectOptions();
}

function applyAnyMode(anyIndex) {
  const rows = els.preferenceList.querySelectorAll('.preference-row');
  rows.forEach((row, idx) => {
    const select = row.querySelector('select');
    if (anyIndex >= 0 && idx > anyIndex) {
      select.disabled = true;
      select.value = '';
      currentPreferences[idx] = '';
    } else {
      select.disabled = false;
    }
  });
}

function updateSelectOptions() {
  const anyAt = getAnyIndex();
  const selects = els.preferenceList.querySelectorAll('select:not([disabled])');
  const used = new Set(
    currentPreferences.filter((p) => p && p !== config.anyChoice)
  );

  selects.forEach((select) => {
    const currentVal = select.value;
    Array.from(select.options).forEach((opt) => {
      if (!opt.value || opt.value === config.anyChoice) return;
      const takenByOther = used.has(opt.value) && opt.value !== currentVal;
      opt.disabled = takenByOther;
    });
  });
}

function getPreferencesFromForm() {
  const selects = els.preferenceList.querySelectorAll('select');
  const prefs = [];
  for (const select of selects) {
    if (!select.value) break;
    prefs.push(select.value);
    if (select.value === config.anyChoice) break;
  }
  return prefs;
}

function updateProgress(status) {
  els.filledCount.textContent = status.count;
  els.maxCount.textContent = status.maxUsers;
  const pct = (status.count / status.maxUsers) * 100;
  els.progressFill.style.width = `${pct}%`;

  if (status.hasAssignment) {
    els.progressHint.textContent = '分配已完成，志愿已锁定';
    els.progressHint.style.color = 'var(--success)';
  } else if (status.isFull) {
    els.progressHint.textContent = '人数已满，正在分配…';
  } else {
    els.progressHint.textContent = `还需 ${status.maxUsers - status.count} 人填写完毕后将自动分配`;
    els.progressHint.style.color = '';
  }

  els.nameList.innerHTML = '';
  if (status.names.length === 0) {
    els.nameList.innerHTML = '<li class="empty-hint">暂无提交</li>';
  } else {
    status.names.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = name;
      li.title = '点击加载该用户志愿';
      li.addEventListener('click', () => {
        els.userName.value = name;
        loadSubmission(name);
      });
      els.nameList.appendChild(li);
    });
  }

  if (status.hasAssignment) {
    els.formCard.classList.add('locked-overlay');
    els.submitBtn.disabled = true;
    els.forceAssignBtn.disabled = true;
  } else {
    els.formCard.classList.remove('locked-overlay');
    els.submitBtn.disabled = false;
    els.forceAssignBtn.disabled = status.count === 0;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAssignment(assignment) {
  els.resultCard.classList.remove('hidden');

  els.resultBody.innerHTML = assignment.results.map((r) => {
    return `<tr>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${escapeHtml(r.assignedSlot)}</td>
    </tr>`;
  }).join('');

  els.slotStats.innerHTML = `
    <h3>时间分布名单</h3>
    <div class="topic-stat-grid">
      ${assignment.slotStats.map((s) => `
        <div class="topic-stat-item">
          <div class="topic-name">${escapeHtml(s.slot)}</div>
          <div class="members">${escapeHtml(s.members.join('、') || '—')}</div>
        </div>
      `).join('')}
    </div>`;
}

async function loadSubmission(name) {
  clearMessage();
  const trimmed = (name || els.userName.value).trim();
  if (!trimmed) {
    showMessage('请先输入姓名', 'error');
    return;
  }

  try {
    const data = await fetchJSON(`${API}/submission/${encodeURIComponent(trimmed)}`);
    els.userName.value = data.name;
    buildPreferenceRows(data.preferences);
    els.formTitle.textContent = '修改志愿';
    showMessage(`已加载 ${data.name} 的志愿，修改后重新提交即可`, 'info');
  } catch (err) {
    buildPreferenceRows();
    els.formTitle.textContent = '填写志愿';
    showMessage(err.message, 'info');
  }
}

async function submitForm() {
  clearMessage();
  const name = els.userName.value.trim();
  const preferences = getPreferencesFromForm();

  try {
    const result = await fetchJSON(`${API}/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, preferences }),
    });

    const action = result.isUpdate ? '更新' : '提交';
    showMessage(`${action}成功！当前已有 ${result.count} / ${config.maxUsers} 人填写`, 'success');
    els.formTitle.textContent = '修改志愿';

    await refreshStatus();

    if (result.hasAssignment) {
      await loadAssignment();
    }
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function refreshStatus() {
  const status = await fetchJSON(`${API}/status`);
  updateProgress(status);
  return status;
}

async function loadAssignment() {
  try {
    const assignment = await fetchJSON(`${API}/assignment`);
    renderAssignment(assignment);
  } catch {
    els.resultCard.classList.add('hidden');
  }
}

async function resetAll() {
  if (!confirm('确定重置？所有志愿与分配结果将被清空。')) return;

  try {
    await fetchJSON(`${API}/reset`, { method: 'POST' });
    els.userName.value = '';
    buildPreferenceRows();
    els.formTitle.textContent = '填写志愿';
    clearMessage();
    showAdminMessage('已重置，所有数据已清空', 'success');
    els.resultCard.classList.add('hidden');
    await refreshStatus();
  } catch (err) {
    showAdminMessage(err.message, 'error');
  }
}

async function forceAssign() {
  if (!confirm('确定强制分配？将按当前已提交人数立即分配，此操作不可撤销。')) return;

  try {
    await fetchJSON(`${API}/assign`, { method: 'POST' });
    showAdminMessage('强制分配完成', 'success');
    await refreshStatus();
    await loadAssignment();
  } catch (err) {
    showAdminMessage(err.message, 'error');
  }
}

async function init() {
  config = await fetchJSON(`${API}/config`);
  buildPreferenceRows();

  const status = await refreshStatus();
  if (status.hasAssignment) {
    await loadAssignment();
  }

  els.submitBtn.addEventListener('click', submitForm);
  els.loadBtn.addEventListener('click', () => loadSubmission());
  els.resetBtn.addEventListener('click', resetAll);
  els.forceAssignBtn.addEventListener('click', forceAssign);

  els.adminToggle.addEventListener('click', () => {
    const open = els.adminContent.classList.toggle('open');
    els.adminToggle.setAttribute('aria-expanded', open);
    els.adminToggle.querySelector('.admin-chevron').textContent = open ? '▲' : '▼';
  });

  els.userName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadSubmission();
  });
}

init();
