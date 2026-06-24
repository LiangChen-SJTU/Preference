const TOPICS = [
  'AIGC文字生成_文献阅读与科研探索',
  'Prompt_Memory_RAG优化',
  'wan2.1vace 数据集复现',
  '剪辑功能驱动的局部重生成与续生成一致性',
  '局部缺陷修复小参数图像模型课题',
  '通用推理任务_多模型效果评估与成本预算分配工具',
];
const MAX_USERS = 30;
const PEOPLE_PER_TOPIC = 5;
const RANK_COST_BASE = 100;
const TIE_BREAK_EPSILON = 0.999;

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 最小费用最大流分配。
 * 费用 = 100^(志愿顺位-1) + 随机微扰(0~0.999)，在不改变志愿优先级的前提下，
 * 多个等价最优解之间随机选取；可通过 seed 复现某次结果。
 */
function assignTopics(submissions, options = {}) {
  if (submissions.length !== MAX_USERS) {
    throw new Error(`需要恰好 ${MAX_USERS} 名用户才能分配，当前 ${submissions.length} 名`);
  }

  const tieBreakSeed =
    options.seed != null ? options.seed >>> 0 : (Math.random() * 0x100000000) >>> 0;
  const rng = seededRng(tieBreakSeed);

  const n = submissions.length;
  const m = TOPICS.length;

  const personOrder = shuffle([...Array(n).keys()], rng);
  const topicOrder = shuffle([...Array(m).keys()], rng);
  const orderedSubs = personOrder.map((i) => submissions[i]);

  const prefRank = orderedSubs.map((s) => {
    const ranks = {};
    s.preferences.forEach((topic, idx) => {
      ranks[topic] = idx + 1;
    });
    return ranks;
  });

  const edgeNoise = Array.from({ length: n }, () =>
    Array.from({ length: m }, () => rng() * TIE_BREAK_EPSILON)
  );

  const cost = (personIdx, topicIdx) => {
    const topic = TOPICS[topicIdx];
    const rank = prefRank[personIdx][topic];
    const noise = edgeNoise[personIdx][topicIdx];
    if (!rank) return Math.pow(RANK_COST_BASE, 6) + noise;
    return Math.pow(RANK_COST_BASE, rank - 1) + noise;
  };

  const source = 0;
  const personStart = 1;
  const topicStart = personStart + n;
  const sink = topicStart + m;
  const nodeCount = sink + 1;

  const graph = Array.from({ length: nodeCount }, () => []);

  function addEdge(from, to, cap, c) {
    graph[from].push({ to, rev: graph[to].length, cap, cost: c });
    graph[to].push({ from, rev: graph[from].length - 1, cap: 0, cost: -c });
  }

  for (let i = 0; i < n; i++) {
    addEdge(source, personStart + i, 1, 0);
    for (const j of topicOrder) {
      addEdge(personStart + i, topicStart + j, 1, cost(i, j));
    }
    graph[personStart + i].sort((a, b) => a.cost - b.cost || rng() - 0.5);
  }

  for (const j of topicOrder) {
    addEdge(topicStart + j, sink, PEOPLE_PER_TOPIC, 0);
  }

  const dist = new Array(nodeCount).fill(Infinity);
  const prev = new Array(nodeCount).fill(-1);
  const prevEdge = new Array(nodeCount).fill(-1);
  const inQueue = new Array(nodeCount).fill(false);
  const queue = [];

  function spfa() {
    dist.fill(Infinity);
    prev.fill(-1);
    prevEdge.fill(-1);
    inQueue.fill(false);
    queue.length = 0;

    dist[source] = 0;
    queue.push(source);
    inQueue[source] = true;

    while (queue.length) {
      const u = queue.shift();
      inQueue[u] = false;

      const edges = graph[u].slice().sort((a, b) => a.cost - b.cost || rng() - 0.5);
      for (const e of edges) {
        if (e.cap <= 0) continue;
        if (dist[u] + e.cost < dist[e.to]) {
          dist[e.to] = dist[u] + e.cost;
          prev[e.to] = u;
          prevEdge[e.to] = graph[u].indexOf(e);
          if (!inQueue[e.to]) {
            queue.push(e.to);
            inQueue[e.to] = true;
          }
        }
      }
    }

    return dist[sink] !== Infinity;
  }

  let flow = 0;
  const maxFlow = n;

  while (flow < maxFlow) {
    if (!spfa()) break;

    let push = Infinity;
    for (let v = sink; v !== source; v = prev[v]) {
      const e = graph[prev[v]][prevEdge[v]];
      push = Math.min(push, e.cap);
    }

    for (let v = sink; v !== source; v = prev[v]) {
      const e = graph[prev[v]][prevEdge[v]];
      e.cap -= push;
      graph[v][e.rev].cap += push;
    }

    flow += push;
  }

  if (flow !== maxFlow) {
    throw new Error('无法完成分配，请检查志愿数据');
  }

  const orderedResults = orderedSubs.map((s, i) => {
    let assignedTopic = null;
    let assignedRank = null;

    for (let j = 0; j < m; j++) {
      const personNode = personStart + i;
      const topicNode = topicStart + j;
      for (const e of graph[personNode]) {
        if (e.to === topicNode && e.cap === 0) {
          assignedTopic = TOPICS[j];
          assignedRank = prefRank[i][assignedTopic];
          break;
        }
      }
      if (assignedTopic) break;
    }

    return {
      name: s.name,
      assignedTopic,
      assignedRank,
      preferences: s.preferences,
    };
  });

  const resultByName = Object.fromEntries(orderedResults.map((r) => [r.name, r]));
  const results = submissions.map((s) => resultByName[s.name]);

  const topicStats = TOPICS.map((topic) => {
    const members = results.filter((r) => r.assignedTopic === topic);
    const rankCounts = [0, 0, 0, 0, 0, 0];
    members.forEach((member) => {
      if (member.assignedRank) rankCounts[member.assignedRank - 1]++;
    });
    return { topic, count: members.length, rankCounts, members: members.map((m) => m.name) };
  });

  const summary = {
    firstChoice: results.filter((r) => r.assignedRank === 1).length,
    secondChoice: results.filter((r) => r.assignedRank === 2).length,
    thirdChoice: results.filter((r) => r.assignedRank === 3).length,
    fourthChoice: results.filter((r) => r.assignedRank === 4).length,
    fifthChoice: results.filter((r) => r.assignedRank === 5).length,
    sixthChoice: results.filter((r) => r.assignedRank === 6).length,
  };

  return {
    results,
    topicStats,
    summary,
    tieBreakSeed,
    assignedAt: new Date().toISOString(),
  };
}

module.exports = { assignTopics, TOPICS, MAX_USERS, PEOPLE_PER_TOPIC, seededRng };
