const TOPICS = ['课题一', '课题二', '课题三', '课题四', '课题五', '课题六'];
const MAX_USERS = 30;
const PEOPLE_PER_TOPIC = 5;

/**
 * 使用最小费用最大流进行分配。
 * 费用采用指数权重，使系统优先满足第一志愿，其次第二志愿，以此类推。
 */
function assignTopics(submissions) {
  if (submissions.length !== MAX_USERS) {
    throw new Error(`需要恰好 ${MAX_USERS} 名用户才能分配，当前 ${submissions.length} 名`);
  }

  const n = submissions.length;
  const m = TOPICS.length;

  const prefRank = submissions.map((s) => {
    const ranks = {};
    s.preferences.forEach((topic, idx) => {
      ranks[topic] = idx + 1;
    });
    return ranks;
  });

  const cost = (personIdx, topicIdx) => {
    const topic = TOPICS[topicIdx];
    const rank = prefRank[personIdx][topic];
    if (!rank) return Math.pow(100, 6);
    return Math.pow(100, 6 - rank);
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
    for (let j = 0; j < m; j++) {
      addEdge(personStart + i, topicStart + j, 1, cost(i, j));
    }
  }

  for (let j = 0; j < m; j++) {
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

      for (let i = 0; i < graph[u].length; i++) {
        const e = graph[u][i];
        if (e.cap <= 0) continue;
        if (dist[u] + e.cost < dist[e.to]) {
          dist[e.to] = dist[u] + e.cost;
          prev[e.to] = u;
          prevEdge[e.to] = i;
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

  const results = submissions.map((s, i) => {
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

  const topicStats = TOPICS.map((topic) => {
    const members = results.filter((r) => r.assignedTopic === topic);
    const rankCounts = [0, 0, 0, 0, 0, 0];
    members.forEach((m) => {
      if (m.assignedRank) rankCounts[m.assignedRank - 1]++;
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

  return { results, topicStats, summary, assignedAt: new Date().toISOString() };
}

module.exports = { assignTopics, TOPICS, MAX_USERS, PEOPLE_PER_TOPIC };
