const fs = require('fs');
const path = require('path');
const { assignTimeSlots, TIME_SLOTS, ANY_CHOICE, MAX_TIME_USERS, hasAnyChoice } = require('./time');

const DATA_FILE = path.join(__dirname, '..', 'data', 'time-submissions.json');

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizePreferences(preferences) {
  if (!hasAnyChoice(preferences)) return [...preferences];
  const anyIdx = preferences.indexOf(ANY_CHOICE);
  return preferences.slice(0, anyIdx + 1);
}

function validateSubmission(name, preferences) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return '请输入姓名';
  }
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return '请填写志愿';
  }

  const anyIdx = preferences.indexOf(ANY_CHOICE);
  if (anyIdx >= 0) {
    if (preferences.length !== anyIdx + 1) {
      return '选择「随便」后无需填写后续志愿';
    }
    const explicit = preferences.slice(0, anyIdx);
    const unique = new Set(explicit);
    if (unique.size !== explicit.length) {
      return '志愿不能重复，请确保每个时段只选一次';
    }
    for (const p of explicit) {
      if (!TIME_SLOTS.includes(p)) {
        return '包含无效的时段';
      }
    }
    return null;
  }

  if (preferences.length !== TIME_SLOTS.length) {
    return `请选择全部 ${TIME_SLOTS.length} 个时段志愿，或在某一志愿选择「随便」`;
  }
  const unique = new Set(preferences);
  if (unique.size !== TIME_SLOTS.length) {
    return '志愿不能重复，请确保每个时段只选一次';
  }
  for (const p of preferences) {
    if (!TIME_SLOTS.includes(p)) {
      return '包含无效的时段';
    }
  }
  return null;
}

function tryAutoAssign(data) {
  if (data.submissions.length === MAX_TIME_USERS && !data.assignment) {
    try {
      data.assignment = assignTimeSlots(data.submissions);
    } catch (err) {
      console.error('[time] 自动分配失败:', err.message);
    }
  }
}

function registerTimeRoutes(app) {
  app.get('/api/time/config', (_req, res) => {
    res.json({
      slots: TIME_SLOTS,
      anyChoice: ANY_CHOICE,
      maxUsers: MAX_TIME_USERS,
    });
  });

  app.get('/api/time/status', (_req, res) => {
    const data = readData();
    res.json({
      count: data.submissions.length,
      maxUsers: MAX_TIME_USERS,
      isFull: data.submissions.length >= MAX_TIME_USERS,
      hasAssignment: !!data.assignment,
      names: data.submissions.map((s) => s.name),
    });
  });

  app.get('/api/time/submission/:name', (req, res) => {
    const data = readData();
    const name = decodeURIComponent(req.params.name).trim();
    const submission = data.submissions.find((s) => s.name === name);
    if (!submission) {
      return res.status(404).json({ error: '未找到该用户的志愿，您可以新建提交' });
    }
    res.json(submission);
  });

  app.post('/api/time/submission', (req, res) => {
    const { name, preferences } = req.body;
    const trimmedName = (name || '').trim();
    const error = validateSubmission(trimmedName, preferences);
    if (error) {
      return res.status(400).json({ error });
    }

    const data = readData();

    if (data.assignment) {
      return res.status(403).json({ error: '分配已完成，无法修改志愿' });
    }

    const existingIdx = data.submissions.findIndex((s) => s.name === trimmedName);
    const now = new Date().toISOString();

    const normalizedPrefs = normalizePreferences(preferences);

    if (existingIdx >= 0) {
      data.submissions[existingIdx] = {
        name: trimmedName,
        preferences: normalizedPrefs,
        updatedAt: now,
      };
    } else {
      if (data.submissions.length >= MAX_TIME_USERS) {
        return res.status(403).json({ error: `名额已满（${MAX_TIME_USERS} 人），无法新增` });
      }
      data.submissions.push({
        name: trimmedName,
        preferences: normalizedPrefs,
        updatedAt: now,
      });
    }

    tryAutoAssign(data);
    writeData(data);

    res.json({
      success: true,
      isUpdate: existingIdx >= 0,
      count: data.submissions.length,
      hasAssignment: !!data.assignment,
    });
  });

  app.get('/api/time/assignment', (_req, res) => {
    const data = readData();
    if (!data.assignment) {
      return res.status(404).json({
        error: data.submissions.length < MAX_TIME_USERS
          ? `还需 ${MAX_TIME_USERS - data.submissions.length} 人填写完毕才能分配，或使用强制分配`
          : '分配尚未完成',
      });
    }
    res.json(data.assignment);
  });

  app.post('/api/time/reset', (_req, res) => {
    writeData({ submissions: [], assignment: null });
    res.json({ success: true });
  });

  app.post('/api/time/assign', (_req, res) => {
    const data = readData();

    if (data.assignment) {
      return res.status(403).json({ error: '分配已完成，请先重置' });
    }
    if (data.submissions.length === 0) {
      return res.status(400).json({ error: '暂无提交数据，无法分配' });
    }

    try {
      data.assignment = assignTimeSlots(data.submissions, { force: true });
      writeData(data);
      res.json({ success: true, assignment: data.assignment });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}

module.exports = { registerTimeRoutes };
