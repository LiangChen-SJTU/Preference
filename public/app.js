let config = { topics: [], otherTopic: '其他', maxUsers: 30, peoplePerTopic: 5 };
let currentPreferences = [];
let hasAssignment = false;

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
  resultName: document.getElementById('resultName'),
  viewResultBtn: document.getElementById('viewResultBtn'),
  myResult: document.getElementById('myResult'),
  myAssignedTopic: document.getElementById('myAssignedTopic'),
  myTeammates: document.getElementById('myTeammates'),
  resultMessage: document.getElementById('resultMessage'),
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

function showResultMessage(text, type = 'info') {
  els.resultMessage.textContent = text;
  els.resultMessage.className = `form-message show ${type}`;
}

function clearResultMessage() {
  els.resultMessage.className = 'form-message';
}

function showAdminMessage(text, type = 'info') {
  els.adminMessage.textContent = text;
  els.adminMessage.className = `form-message show ${type}`;
}

function isOtherSelected() {
  return currentPreferences[0] === config.otherTopic;
}

function buildPreferenceRows(selected = []) {
  els.preferenceList.innerHTML = '';
  currentPreferences = [];

  const otherSelected = selected[0] === config.otherTopic;

  for (let i = 0; i < config.topics.length; i++) {
    const row = document.createElement('div');
    row.className = 'preference-row';
    row.dataset.rank = i;

    const rankLabel = document.createElement('span');
    rankLabel.className = `pref-rank rank-${Math.min(i + 1, 2)}`;
    rankLabel.textContent = `第 ${i + 1} 志愿`;

    const select = document.createElement('select');
    select.dataset.rank = i;

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— 请选择 —';
    select.appendChild(emptyOpt);

    const options = i === 0 ? [...config.topics, config.otherTopic] : config.topics;
    options.forEach((topic) => {
      const opt = document.createElement('option');
      opt.value = topic;
      opt.textContent = topic;
      select.appendChild(opt);
    });

    if (otherSelected && i > 0) {
      select.disabled = true;
    } else if (selected[i]) {
      select.value = selected[i];
      currentPreferences[i] = selected[i];
    }

    select.addEventListener('change', () => {
      currentPreferences[i] = select.value;
      if (i === 0) {
        applyOtherMode(select.value === config.otherTopic);
      }
      updateSelectOptions();
    });

    row.appendChild(rankLabel);
    row.appendChild(select);
    els.preferenceList.appendChild(row);
  }

  if (otherSelected) {
    applyOtherMode(true);
  }
  updateSelectOptions();
}

function applyOtherMode(enabled) {
  const rows = els.preferenceList.querySelectorAll('.preference-row');
  rows.forEach((row, idx) => {
    if (idx === 0) return;
    const select = row.querySelector('select');
    select.disabled = enabled;
    if (enabled) {
      select.value = '';
      currentPreferences[idx] = '';
    }
  });
}

function updateSelectOptions() {
  if (isOtherSelected()) return;

  const selects = els.preferenceList.querySelectorAll('select:not([disabled])');
  const used = new Set(currentPreferences.filter(Boolean));

  selects.forEach((select) => {
    const currentVal = select.value;
    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      const takenByOther = used.has(opt.value) && opt.value !== currentVal;
      opt.disabled = takenByOther;
    });
  });
}

function getPreferencesFromForm() {
  if (isOtherSelected()) {
    return [config.otherTopic];
  }
  const selects = els.preferenceList.querySelectorAll('select');
  return Array.from(selects).map((s) => s.value);
}

function updateProgress(status) {
  hasAssignment = status.hasAssignment;
  els.filledCount.textContent = status.count;
  els.maxCount.textContent = status.maxUsers;
  const pct = (status.count / status.maxUsers) * 100;
  els.progressFill.style.width = `${pct}%`;

  if (status.hasAssignment) {
    els.progressHint.textContent = '分配已完成，志愿已锁定';
    els.progressHint.style.color = 'var(--success)';
    els.loadBtn.textContent = '查看我的分配';
  } else {
    els.progressHint.textContent = status.isFull
      ? '人数已满，正在分配…'
      : `还需 ${status.maxUsers - status.count} 人填写完毕后将自动分配`;
    els.progressHint.style.color = '';
    els.loadBtn.textContent = '加载我的志愿';
  }

  els.nameList.innerHTML = '';
  if (status.names.length === 0) {
    els.nameList.innerHTML = '<li class="empty-hint">暂无提交</li>';
  } else {
    status.names.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = name;
      li.title = status.hasAssignment ? '点击查看分配结果' : '点击加载该用户志愿';
      li.addEventListener('click', () => {
        els.userName.value = name;
        els.resultName.value = name;
        if (status.hasAssignment) {
          showMyAssignment(name);
        } else {
          loadSubmission(name);
        }
      });
      els.nameList.appendChild(li);
    });
  }

  if (status.hasAssignment) {
    els.formCard.classList.add('locked-overlay');
    els.submitBtn.disabled = true;
    els.forceAssignBtn.disabled = true;
    els.resultCard.classList.remove('hidden');
  } else {
    els.formCard.classList.remove('locked-overlay');
    els.submitBtn.disabled = false;
    els.forceAssignBtn.disabled = status.count === 0;
    els.resultCard.classList.add('hidden');
    els.myResult.classList.add('hidden');
    clearResultMessage();
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function showMyAssignment(name) {
  clearResultMessage();
  const trimmed = (name || els.resultName.value || els.userName.value).trim();
  if (!trimmed) {
    showResultMessage('请输入姓名', 'error');
    return;
  }

  els.resultName.value = trimmed;

  try {
    const data = await fetchJSON(`/api/assignment/${encodeURIComponent(trimmed)}`);
    els.myAssignedTopic.textContent = data.assignedTopic;
    els.myTeammates.textContent = data.teammates.length
      ? data.teammates.join('、')
      : '无';
    els.myResult.classList.remove('hidden');
  } catch (err) {
    els.myResult.classList.add('hidden');
    showResultMessage(err.message, 'error');
  }
}

async function loadSubmission(name) {
  clearMessage();
  const trimmed = (name || els.userName.value).trim();
  if (!trimmed) {
    showMessage('请先输入姓名', 'error');
    return;
  }

  if (hasAssignment) {
    els.resultName.value = trimmed;
    await showMyAssignment(trimmed);
    return;
  }

  try {
    const data = await fetchJSON(`/api/submission/${encodeURIComponent(trimmed)}`);
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
    const result = await fetchJSON('/api/submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, preferences }),
    });

    const action = result.isUpdate ? '更新' : '提交';
    showMessage(`${action}成功！当前已有 ${result.count} / ${config.maxUsers} 人填写`, 'success');
    els.formTitle.textContent = '修改志愿';
    els.resultName.value = name;

    await refreshStatus();

    if (result.hasAssignment) {
      await showMyAssignment(name);
    }
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function refreshStatus() {
  const status = await fetchJSON('/api/status');
  updateProgress(status);
  return status;
}

async function resetAll() {
  if (!confirm('确定重置？所有志愿与分配结果将被清空。')) return;

  try {
    await fetchJSON('/api/reset', { method: 'POST' });
    els.userName.value = '';
    els.resultName.value = '';
    buildPreferenceRows();
    els.formTitle.textContent = '填写志愿';
    clearMessage();
    showAdminMessage('已重置，所有数据已清空', 'success');
    els.myResult.classList.add('hidden');
    clearResultMessage();
    await refreshStatus();
  } catch (err) {
    showAdminMessage(err.message, 'error');
  }
}

async function forceAssign() {
  if (!confirm('确定强制分配？将按当前已提交人数立即分配，此操作不可撤销。')) return;

  try {
    await fetchJSON('/api/assign', { method: 'POST' });
    showAdminMessage('强制分配完成', 'success');
    await refreshStatus();
    const name = els.resultName.value.trim() || els.userName.value.trim();
    if (name) await showMyAssignment(name);
  } catch (err) {
    showAdminMessage(err.message, 'error');
  }
}

async function init() {
  config = await fetchJSON('/api/config');
  buildPreferenceRows();

  const status = await refreshStatus();
  if (status.hasAssignment) {
    const name = els.userName.value.trim();
    if (name) await showMyAssignment(name);
  }

  els.submitBtn.addEventListener('click', submitForm);
  els.loadBtn.addEventListener('click', () => loadSubmission());
  els.viewResultBtn.addEventListener('click', () => showMyAssignment());
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

  els.resultName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') showMyAssignment();
  });
}

init();
