const express = require('express');
const fs = require('fs');
const path = require('path');
const { assignTopics, TOPICS, MAX_USERS, PEOPLE_PER_TOPIC } = require('./lib/assign');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'submissions.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function validateSubmission(name, preferences) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return '请输入姓名';
  }
  if (!Array.isArray(preferences) || preferences.length !== TOPICS.length) {
    return `请选择全部 ${TOPICS.length} 个课题志愿`;
  }
  const unique = new Set(preferences);
  if (unique.size !== TOPICS.length) {
    return '志愿不能重复，请确保每个课题只选一次';
  }
  for (const p of preferences) {
    if (!TOPICS.includes(p)) {
      return '包含无效的课题名称';
    }
  }
  return null;
}

function tryAutoAssign(data) {
  if (data.submissions.length === MAX_USERS && !data.assignment) {
    try {
      data.assignment = assignTopics(data.submissions);
    } catch (err) {
      console.error('自动分配失败:', err.message);
    }
  }
}

app.get('/api/config', (_req, res) => {
  res.json({ topics: TOPICS, maxUsers: MAX_USERS, peoplePerTopic: PEOPLE_PER_TOPIC });
});

app.get('/api/status', (_req, res) => {
  const data = readData();
  res.json({
    count: data.submissions.length,
    maxUsers: MAX_USERS,
    isFull: data.submissions.length >= MAX_USERS,
    hasAssignment: !!data.assignment,
    names: data.submissions.map((s) => s.name),
  });
});

app.get('/api/submission/:name', (req, res) => {
  const data = readData();
  const name = decodeURIComponent(req.params.name).trim();
  const submission = data.submissions.find((s) => s.name === name);
  if (!submission) {
    return res.status(404).json({ error: '未找到该用户的志愿，您可以新建提交' });
  }
  res.json(submission);
});

app.post('/api/submission', (req, res) => {
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

  if (existingIdx >= 0) {
    data.submissions[existingIdx] = {
      name: trimmedName,
      preferences: [...preferences],
      updatedAt: now,
    };
  } else {
    if (data.submissions.length >= MAX_USERS) {
      return res.status(403).json({ error: `名额已满（${MAX_USERS} 人），无法新增` });
    }
    data.submissions.push({
      name: trimmedName,
      preferences: [...preferences],
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

app.get('/api/assignment', (_req, res) => {
  const data = readData();
  if (!data.assignment) {
    return res.status(404).json({
      error: data.submissions.length < MAX_USERS
        ? `还需 ${MAX_USERS - data.submissions.length} 人填写完毕才能分配`
        : '分配尚未完成',
    });
  }
  res.json(data.assignment);
});

app.post('/api/reset', (_req, res) => {
  writeData({ submissions: [], assignment: null });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`课题志愿系统运行在 http://localhost:${PORT}`);
});
