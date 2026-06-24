const fs = require('fs');
const path = require('path');
const { assignTopics, REGULAR_TOPICS } = require('../lib/assign');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function writeCsv(filename, rows) {
  const bom = '\uFEFF';
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), bom + toCsv(rows), 'utf-8');
}

const rng = seededRng(20260623);

const submissions = Array.from({ length: 30 }, (_, i) => ({
  name: String(i + 1),
  preferences: shuffle(REGULAR_TOPICS, rng),
}));

const assignment = assignTopics(submissions);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 志愿表
const prefHeader = ['姓名', ...REGULAR_TOPICS.map((_, i) => `第${i + 1}志愿`)];
const prefRows = [
  prefHeader,
  ...submissions.map((s) => [s.name, ...s.preferences]),
];
writeCsv('preferences.csv', prefRows);

// 分配结果
const assignHeader = [
  '姓名',
  '分配课题',
  '满足志愿顺位',
  '第1志愿',
  '第2志愿',
  '第3志愿',
  '第4志愿',
  '第5志愿',
  '第6志愿',
];
const assignRows = [
  assignHeader,
  ...assignment.results
    .sort((a, b) => Number(a.name) - Number(b.name))
    .map((r) => [
      r.name,
      r.assignedTopic,
      r.assignedRank,
      ...r.preferences,
    ]),
];
writeCsv('assignment.csv', assignRows);

// 各课题统计
const topicHeader = ['课题', '人数', '成员', '第1志愿人数', '第2志愿人数', '第3志愿人数', '第4志愿人数', '第5志愿人数', '第6志愿人数'];
const topicRows = [
  topicHeader,
  ...assignment.topicStats.map((t) => [
    t.topic,
    t.count,
    t.members.sort((a, b) => Number(a) - Number(b)).join('、'),
    ...t.rankCounts,
  ]),
];
writeCsv('topic_stats.csv', topicRows);

// 满足统计
const summaryRows = [
  ['志愿顺位', '人数'],
  ['第1志愿', assignment.summary.firstChoice],
  ['第2志愿', assignment.summary.secondChoice],
  ['第3志愿', assignment.summary.thirdChoice],
  ['第4志愿', assignment.summary.fourthChoice],
  ['第5志愿', assignment.summary.fifthChoice],
  ['第6志愿', assignment.summary.sixthChoice],
];
writeCsv('summary.csv', summaryRows);

console.log('CSV 已输出到 output/ 目录：');
console.log('  preferences.csv   - 30 人志愿表');
console.log('  assignment.csv    - 分配结果');
console.log('  topic_stats.csv   - 各课题统计');
console.log('  summary.csv       - 志愿满足统计');
