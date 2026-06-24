function pad2(n) {
  return String(n).padStart(2, '0');
}

function generateTimeSlots() {
  const slots = [];
  let hour = 2;
  let minute = 0;
  for (let i = 0; i < 12; i++) {
    const sh = hour;
    const sm = minute;
    minute += 10;
    if (minute >= 60) {
      hour += 1;
      minute -= 60;
    }
    slots.push(`${sh}:${pad2(sm)}-${hour}:${pad2(minute)}`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();
const ANY_CHOICE = '随便';
const MAX_TIME_USERS = 12;
const RANK_COST_BASE = 100;
const TIE_BREAK_EPSILON = 0.999;

function hasAnyChoice(preferences) {
  return preferences.includes(ANY_CHOICE);
}

function buildPrefRank(preferences) {
  const anyIdx = preferences.indexOf(ANY_CHOICE);
  const explicit = anyIdx >= 0 ? preferences.slice(0, anyIdx) : preferences;
  const ranks = {};
  explicit.forEach((slot, idx) => {
    ranks[slot] = idx + 1;
  });
  const fallbackRank = anyIdx >= 0 ? anyIdx + 1 : TIME_SLOTS.length + 1;
  return { ranks, fallbackRank };
}

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

function balancedCapacities(total, slotCount) {
  const base = Math.floor(total / slotCount);
  const extra = total % slotCount;
  return Array.from({ length: slotCount }, (_, i) => base + (i < extra ? 1 : 0));
}

function runMinCostFlow(submissions, capacities, rng) {
  const n = submissions.length;
  if (n === 0) return [];

  const m = TIME_SLOTS.length;
  const personOrder = shuffle([...Array(n).keys()], rng);
  const slotOrder = shuffle([...Array(m).keys()], rng);
  const orderedSubs = personOrder.map((i) => submissions[i]);

  const prefMeta = orderedSubs.map((s) => buildPrefRank(s.preferences));

  const edgeNoise = Array.from({ length: n }, () =>
    Array.from({ length: m }, () => rng() * TIE_BREAK_EPSILON)
  );

  const cost = (personIdx, slotIdx) => {
    const slot = TIME_SLOTS[slotIdx];
    const { ranks, fallbackRank } = prefMeta[personIdx];
    const rank = ranks[slot] || fallbackRank;
    const noise = edgeNoise[personIdx][slotIdx];
    return Math.pow(RANK_COST_BASE, rank - 1) + noise;
  };

  const source = 0;
  const personStart = 1;
  const slotStart = personStart + n;
  const sink = slotStart + m;
  const nodeCount = sink + 1;

  const graph = Array.from({ length: nodeCount }, () => []);

  function addEdge(from, to, cap, c) {
    graph[from].push({ to, rev: graph[to].length, cap, cost: c });
    graph[to].push({ from, rev: graph[from].length - 1, cap: 0, cost: -c });
  }

  for (let i = 0; i < n; i++) {
    addEdge(source, personStart + i, 1, 0);
    for (const j of slotOrder) {
      if (capacities[j] > 0) {
        addEdge(personStart + i, slotStart + j, 1, cost(i, j));
      }
    }
    graph[personStart + i].sort((a, b) => a.cost - b.cost || rng() - 0.5);
  }

  for (let j = 0; j < m; j++) {
    if (capacities[j] > 0) {
      addEdge(slotStart + j, sink, capacities[j], 0);
    }
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
  while (flow < n) {
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

  if (flow !== n) {
    throw new Error('无法完成分配，请检查志愿数据');
  }

  return orderedSubs.map((s, i) => {
    let assignedSlot = null;
    let assignedRank = null;
    const { ranks, fallbackRank } = prefMeta[i];

    for (let j = 0; j < m; j++) {
      const personNode = personStart + i;
      const slotNode = slotStart + j;
      for (const e of graph[personNode]) {
        if (e.to === slotNode && e.cap === 0) {
          assignedSlot = TIME_SLOTS[j];
          assignedRank = ranks[assignedSlot] || fallbackRank;
          break;
        }
      }
      if (assignedSlot) break;
    }

    return {
      name: s.name,
      assignedSlot,
      assignedRank,
      preferences: s.preferences,
    };
  });
}

function assignTimeSlots(submissions, options = {}) {
  const { force = false } = options;
  const n = submissions.length;

  if (n === 0) {
    throw new Error('没有可分配的数据');
  }
  if (!force && n !== MAX_TIME_USERS) {
    throw new Error(`需要恰好 ${MAX_TIME_USERS} 名用户才能分配，当前 ${n} 名`);
  }

  const tieBreakSeed =
    options.seed != null ? options.seed >>> 0 : (Math.random() * 0x100000000) >>> 0;
  const rng = seededRng(tieBreakSeed);

  const specificSubs = submissions.filter((s) => !hasAnyChoice(s.preferences));
  const flexSubs = submissions.filter((s) => hasAnyChoice(s.preferences));

  const totalCapacities = balancedCapacities(n, TIME_SLOTS.length);
  const specificCapacities = balancedCapacities(specificSubs.length, TIME_SLOTS.length);

  const specificResults =
    specificSubs.length > 0 ? runMinCostFlow(specificSubs, specificCapacities, rng) : [];

  const usedPerSlot = Array(TIME_SLOTS.length).fill(0);
  specificResults.forEach((r) => {
    const idx = TIME_SLOTS.indexOf(r.assignedSlot);
    if (idx >= 0) usedPerSlot[idx]++;
  });

  const remainingCapacities = totalCapacities.map((cap, i) => cap - usedPerSlot[i]);

  const flexResults =
    flexSubs.length > 0 ? runMinCostFlow(flexSubs, remainingCapacities, rng) : [];

  const resultByName = Object.fromEntries(
    [...specificResults, ...flexResults].map((r) => [r.name, r])
  );
  const results = submissions.map((s) => resultByName[s.name]);

  const slotStats = TIME_SLOTS.map((slot) => {
    const members = results.filter((r) => r.assignedSlot === slot);
    return { slot, count: members.length, members: members.map((m) => m.name) };
  });

  return {
    results,
    slotStats,
    tieBreakSeed,
    assignedAt: new Date().toISOString(),
    forced: !!force,
  };
}

module.exports = {
  TIME_SLOTS,
  ANY_CHOICE,
  MAX_TIME_USERS,
  hasAnyChoice,
  assignTimeSlots,
};
