"use strict";

/**
 * Source-of-truth definitions for the 20 hard Google/Amazon-style coding
 * problems. Each entry carries:
 *   - metadata (title, tags, statement, examples, constraints)
 *   - paramSpec / outputKind (drives starter-code + harness generation)
 *   - referenceBody (a correct JavaScript solve() body, used ONLY at build
 *     time to compute ground-truth expected outputs for every test case -
 *     it is never shipped to users)
 *   - testCaseValues: typed JS values for visible + hidden test cases
 *
 * This file is consumed by build-problems.js, which turns it into the final
 * apps/desktop/src/coding/problems.js catalog (with generated starter code
 * and computed expected outputs baked in).
 */

const PROBLEMS = [
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    tags: ["Array", "Two Pointers", "Dynamic Programming", "Stack"],
    companies: ["Google", "Amazon"],
    statement:
      "You are given an array of non-negative integers representing an elevation map where the width of each bar is 1. " +
      "Compute how much water it can trap after raining.",
    inputFormat: "Line 1: integer n (length of height). Line 2: n space-separated integers height[i].",
    outputFormat: "A single integer: the total units of trapped water.",
    constraints: ["0 <= n <= 20000", "0 <= height[i] <= 100000"],
    examples: [
      {
        input: "12\n0 1 0 2 1 0 1 3 2 1 2 1",
        output: "6",
        explanation: "The elevation map traps 6 units of water between the bars."
      },
      {
        input: "6\n4 2 0 3 2 5",
        output: "9",
        explanation: "This classic elevation map traps 9 units of water."
      }
    ],
    paramSpec: [{ name: "height", type: "intArray" }],
    outputKind: "int",
    referenceBody: `
  const n = height.length;
  if (n === 0) return 0;
  const left = new Array(n), right = new Array(n);
  left[0] = height[0];
  for (let i = 1; i < n; i++) left[i] = Math.max(left[i - 1], height[i]);
  right[n - 1] = height[n - 1];
  for (let i = n - 2; i >= 0; i--) right[i] = Math.max(right[i + 1], height[i]);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.min(left[i], right[i]) - height[i];
  return total;`,
    testCases: [
      { values: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, visible: true },
      { values: { height: [4, 2, 0, 3, 2, 5] }, visible: true },
      { values: { height: [] } },
      { values: { height: [1, 1, 1, 1] } },
      { values: { height: [5, 4, 3, 2, 1] } },
      { values: { height: [3, 0, 3] } },
      { values: { height: [0, 7, 1, 4, 2, 0, 1, 3, 0, 2, 5, 0, 1, 6, 0] } }
    ]
  },

  {
    id: "trapping-rain-water-ii",
    title: "Trapping Rain Water II",
    tags: ["Heap", "Matrix", "Breadth-First Search"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an m x n integer matrix heightMap representing the height of each unit cell in a 2D elevation map, " +
      "return the volume of water it can trap after raining.",
    inputFormat: "Line 1: rows cols. Next rows lines: cols space-separated integers (one row of the height map each).",
    outputFormat: "A single integer: total trapped water volume.",
    constraints: ["1 <= rows, cols <= 60", "0 <= heightMap[i][j] <= 20000"],
    examples: [
      {
        input: "3 6\n1 4 3 1 3 2\n3 2 1 3 2 4\n2 3 3 2 3 1",
        output: "4",
        explanation: "The interior basin traps a total of 4 units of water."
      },
      {
        input: "5 5\n12 13 1 12 9\n13 4 13 12 13\n13 8 10 12 13\n12 13 12 12 13\n13 13 13 13 13",
        output: "14",
        explanation: "Classic larger example; total trapped volume is 14."
      }
    ],
    paramSpec: [{ name: "heightMap", type: "grid" }],
    outputKind: "int",
    referenceBody: `
  const rows = heightMap.length;
  if (!rows) return 0;
  const cols = heightMap[0].length;
  if (rows < 3 || cols < 3) return 0;
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const heap = [];
  function push(item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }
  function pop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) {
        push([heightMap[r][c], r, c]);
        visited[r][c] = true;
      }
    }
  }
  let water = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (heap.length) {
    const [h, r, c] = pop();
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        visited[nr][nc] = true;
        water += Math.max(0, h - heightMap[nr][nc]);
        push([Math.max(h, heightMap[nr][nc]), nr, nc]);
      }
    }
  }
  return water;`,
    testCases: [
      {
        values: {
          heightMap: [
            [1, 4, 3, 1, 3, 2],
            [3, 2, 1, 3, 2, 4],
            [2, 3, 3, 2, 3, 1]
          ]
        },
        visible: true
      },
      {
        values: {
          heightMap: [
            [12, 13, 1, 12, 9],
            [13, 4, 13, 12, 13],
            [13, 8, 10, 12, 13],
            [12, 13, 12, 12, 13],
            [13, 13, 13, 13, 13]
          ]
        },
        visible: true
      },
      { values: { heightMap: [[3, 3, 3], [3, 1, 3], [3, 3, 3]] } },
      { values: { heightMap: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] } },
      { values: { heightMap: [[5, 5, 5, 5], [5, 1, 1, 5], [5, 1, 1, 5], [5, 5, 5, 5]] } }
    ]
  },

  {
    id: "median-of-two-sorted-arrays",
    title: "Median of Two Sorted Arrays",
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    companies: ["Google", "Amazon"],
    statement:
      "Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays combined.",
    inputFormat: "Line 1: n1 (size of nums1). Line 2: n1 integers. Line 3: n2 (size of nums2). Line 4: n2 integers.",
    outputFormat: "A single floating-point number: the median, printed with 6 decimal places.",
    constraints: ["0 <= n1, n2 <= 2000", "-1e6 <= nums[i] <= 1e6", "nums1 and nums2 are sorted ascending"],
    examples: [
      { input: "2\n1 3\n1\n2", output: "2.000000", explanation: "Merged array is [1,2,3]; median is 2." },
      {
        input: "2\n1 2\n2\n3 4",
        output: "2.500000",
        explanation: "Merged array is [1,2,3,4]; median is the average of 2 and 3."
      }
    ],
    paramSpec: [
      { name: "nums1", type: "intArray" },
      { name: "nums2", type: "intArray" }
    ],
    outputKind: "double",
    referenceBody: `
  const merged = [...nums1, ...nums2].sort((a, b) => a - b);
  const n = merged.length;
  if (n === 0) return 0.0;
  if (n % 2 === 1) return merged[(n - 1) / 2];
  return (merged[n / 2 - 1] + merged[n / 2]) / 2.0;`,
    testCases: [
      { values: { nums1: [1, 3], nums2: [2] }, visible: true },
      { values: { nums1: [1, 2], nums2: [3, 4] }, visible: true },
      { values: { nums1: [], nums2: [1] } },
      { values: { nums1: [], nums2: [] } },
      { values: { nums1: [5, 6, 7, 8, 9], nums2: [1, 2, 3, 4] } },
      { values: { nums1: [-5, -3, -1], nums2: [-4, -2, 0, 2] } }
    ]
  },

  {
    id: "first-missing-positive",
    title: "First Missing Positive",
    tags: ["Array", "Hash Table", "In-place Cyclic Sort"],
    companies: ["Amazon", "Google"],
    statement:
      "Given an unsorted integer array nums, return the smallest missing positive integer. " +
      "Your algorithm should run in O(n) time and use O(1) extra space (beyond the input).",
    inputFormat: "Line 1: integer n. Line 2: n space-separated integers.",
    outputFormat: "A single integer: the smallest missing positive integer.",
    constraints: ["0 <= n <= 100000", "-1000000 <= nums[i] <= 1000000"],
    examples: [
      { input: "3\n1 2 0", output: "3", explanation: "1 and 2 are present, so the answer is 3." },
      { input: "4\n3 4 -1 1", output: "2", explanation: "1 is present but 2 is missing." }
    ],
    paramSpec: [{ name: "nums", type: "intArray" }],
    outputKind: "int",
    referenceBody: `
  const n = nums.length;
  const a = nums.slice();
  for (let i = 0; i < n; i++) {
    while (a[i] > 0 && a[i] <= n && a[a[i] - 1] !== a[i]) {
      const target = a[i] - 1;
      const tmp = a[target];
      a[target] = a[i];
      a[i] = tmp;
    }
  }
  for (let i = 0; i < n; i++) if (a[i] !== i + 1) return i + 1;
  return n + 1;`,
    testCases: [
      { values: { nums: [1, 2, 0] }, visible: true },
      { values: { nums: [3, 4, -1, 1] }, visible: true },
      { values: { nums: [7, 8, 9, 11, 12] } },
      { values: { nums: [] } },
      { values: { nums: [1] } },
      { values: { nums: [1, 2, 3, 4, 5] } },
      { values: { nums: [-1, -2, -3] } }
    ]
  },

  {
    id: "largest-rectangle-histogram",
    title: "Largest Rectangle in Histogram",
    tags: ["Array", "Stack", "Monotonic Stack"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an array of integers heights representing the histogram's bar heights where each bar has width 1, " +
      "return the area of the largest rectangle that can be formed within the histogram.",
    inputFormat: "Line 1: integer n. Line 2: n space-separated integers heights[i].",
    outputFormat: "A single integer: the maximum rectangle area.",
    constraints: ["1 <= n <= 100000", "0 <= heights[i] <= 1000000000"],
    examples: [
      { input: "6\n2 1 5 6 2 3", output: "10", explanation: "The largest rectangle has area 10 (bars of height 5 and 6)." },
      { input: "2\n2 4", output: "4", explanation: "The tallest single bar (height 4) forms the largest rectangle." }
    ],
    paramSpec: [{ name: "heights", type: "intArray" }],
    outputKind: "long",
    referenceBody: `
  const h = heights.concat([0]);
  const stack = [];
  let max = 0;
  for (let i = 0; i < h.length; i++) {
    while (stack.length && h[stack[stack.length - 1]] >= h[i]) {
      const top = stack.pop();
      const height = h[top];
      const width = stack.length ? i - stack[stack.length - 1] - 1 : i;
      max = Math.max(max, height * width);
    }
    stack.push(i);
  }
  return max;`,
    testCases: [
      { values: { heights: [2, 1, 5, 6, 2, 3] }, visible: true },
      { values: { heights: [2, 4] }, visible: true },
      { values: { heights: [0] } },
      { values: { heights: [1, 1, 1, 1, 1] } },
      { values: { heights: [6, 5, 4, 3, 2, 1] } },
      { values: { heights: [1, 2, 3, 4, 5, 6] } }
    ]
  },

  {
    id: "sliding-window-maximum",
    title: "Sliding Window Maximum",
    tags: ["Array", "Deque", "Monotonic Queue", "Sliding Window"],
    companies: ["Google", "Amazon"],
    statement:
      "You are given an array nums and a window size k. A sliding window of size k moves from the left of the array " +
      "to the right, one position at a time. Return the maximum value in each window position.",
    inputFormat: "Line 1: integer n. Line 2: n space-separated integers. Line 3: integer k.",
    outputFormat: "Space-separated integers: the maximum of each window, in order.",
    constraints: ["1 <= k <= n <= 100000", "-1e9 <= nums[i] <= 1e9"],
    examples: [
      {
        input: "8\n1 3 -1 -3 5 3 6 7\n3",
        output: "3 3 5 5 6 7",
        explanation: "Sliding a window of size 3 across the array yields these maximums."
      },
      { input: "1\n1\n1", output: "1", explanation: "A single-element window is just the element itself." }
    ],
    paramSpec: [
      { name: "nums", type: "intArray" },
      { name: "k", type: "int" }
    ],
    outputKind: "intArray",
    referenceBody: `
  const deque = [];
  const res = [];
  for (let i = 0; i < nums.length; i++) {
    while (deque.length && deque[0] <= i - k) deque.shift();
    while (deque.length && nums[deque[deque.length - 1]] <= nums[i]) deque.pop();
    deque.push(i);
    if (i >= k - 1) res.push(nums[deque[0]]);
  }
  return res;`,
    testCases: [
      { values: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 }, visible: true },
      { values: { nums: [1], k: 1 }, visible: true },
      { values: { nums: [9, 8, 7, 6, 5], k: 2 } },
      { values: { nums: [4, 4, 4, 4], k: 2 } },
      { values: { nums: [1, -1, 2, -2, 3, -3, 4, -4], k: 4 } }
    ]
  },

  {
    id: "longest-valid-parentheses",
    title: "Longest Valid Parentheses",
    tags: ["String", "Stack", "Dynamic Programming"],
    companies: ["Amazon", "Google"],
    statement:
      "Given a string s containing only the characters '(' and ')', return the length of the longest valid " +
      "(well-formed) parentheses substring.",
    inputFormat: "Line 1: string s.",
    outputFormat: "A single integer: the length of the longest valid parentheses substring.",
    constraints: ["0 <= s.length <= 30000"],
    examples: [
      { input: "(()", output: "2", explanation: "The longest valid substring is \"()\"." },
      { input: ")()())", output: "4", explanation: "The longest valid substring is \"()()\"." }
    ],
    paramSpec: [{ name: "s", type: "string" }],
    outputKind: "int",
    referenceBody: `
  let max = 0;
  const stack = [-1];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') {
      stack.push(i);
    } else {
      stack.pop();
      if (stack.length === 0) stack.push(i);
      else max = Math.max(max, i - stack[stack.length - 1]);
    }
  }
  return max;`,
    testCases: [
      { values: { s: "(()" }, visible: true },
      { values: { s: ")()())" }, visible: true },
      { values: { s: "" } },
      { values: { s: "()(())" } },
      { values: { s: "((((((" } },
      { values: { s: "()(()" } }
    ]
  },

  {
    id: "word-search-ii",
    title: "Word Search II",
    tags: ["Backtracking", "Trie", "Matrix"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an m x n grid of characters board and a list of strings words, return all words from the list that can " +
      "be constructed from letters of sequentially adjacent cells (horizontally or vertically neighboring), where the " +
      "same cell may not be used more than once in a single word.",
    inputFormat:
      "Line 1: rows cols. Next rows lines: one row of the board each (a string of length cols, no spaces). " +
      "Next line: number of words w. Next w lines: one word each.",
    outputFormat: "First line: the number of words found. Then each found word on its own line, sorted alphabetically.",
    constraints: ["1 <= rows, cols <= 12", "1 <= number of words <= 300", "1 <= word length <= 10"],
    examples: [
      {
        input: "4 4\noaan\netae\nihkr\niflv\n4\noath\npea\neat\nrain",
        output: "2\neat\noath",
        explanation: "\"oath\" and \"eat\" can both be traced through adjacent cells; \"pea\" and \"rain\" cannot."
      },
      {
        input: "2 2\nab\ncd\n1\nabcd",
        output: "0",
        explanation: "No path of adjacent cells spells \"abcd\", so nothing is found."
      }
    ],
    paramSpec: [
      { name: "board", type: "charGrid" },
      { name: "words", type: "stringArray" }
    ],
    outputKind: "stringArray",
    referenceBody: `
  const rows = board.length, cols = rows ? board[0].length : 0;
  function existsFrom(word) {
    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
    function dfs(r, c, idx) {
      if (idx === word.length) return true;
      if (r < 0 || c < 0 || r >= rows || c >= cols || visited[r][c] || board[r][c] !== word[idx]) return false;
      visited[r][c] = true;
      const found = dfs(r + 1, c, idx + 1) || dfs(r - 1, c, idx + 1) || dfs(r, c + 1, idx + 1) || dfs(r, c - 1, idx + 1);
      visited[r][c] = false;
      return found;
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (dfs(r, c, 0)) return true;
    return false;
  }
  const found = [];
  const seen = new Set();
  for (const w of words) {
    if (!seen.has(w) && existsFrom(w)) {
      found.push(w);
      seen.add(w);
    }
  }
  return found;`,
    testCases: [
      {
        values: {
          board: ["oaan", "etae", "ihkr", "iflv"],
          words: ["oath", "pea", "eat", "rain"]
        },
        visible: true
      },
      { values: { board: ["ab", "cd"], words: ["abcd"] }, visible: true },
      { values: { board: ["a"], words: ["a", "b"] } },
      { values: { board: ["abce", "sfcs", "adee"], words: ["abcced", "see", "abcb"] } }
    ]
  },

  {
    id: "word-ladder",
    title: "Word Ladder",
    tags: ["Breadth-First Search", "Graph", "String"],
    companies: ["Google", "Amazon"],
    statement:
      "Given beginWord, endWord, and a wordList, return the number of words in the shortest transformation sequence " +
      "from beginWord to endWord, changing exactly one letter at a time, such that every intermediate word exists in " +
      "wordList. Return 0 if no such sequence exists.",
    inputFormat:
      "Line 1: beginWord. Line 2: endWord. Line 3: integer n (size of wordList). Next n lines: one word each.",
    outputFormat: "A single integer: the length of the shortest transformation sequence (counting both endpoints), or 0.",
    constraints: ["1 <= word length <= 10", "1 <= wordList size <= 5000", "all words consist of lowercase letters"],
    examples: [
      {
        input: "hit\ncog\n6\nhot\ndot\ndog\nlot\nlog\ncog",
        output: "5",
        explanation: "hit -> hot -> dot -> dog -> cog is a shortest sequence of length 5."
      },
      {
        input: "hit\ncog\n5\nhot\ndot\ndog\nlot\nlog",
        output: "0",
        explanation: "cog is not in the word list, so no transformation sequence exists."
      }
    ],
    paramSpec: [
      { name: "beginWord", type: "string" },
      { name: "endWord", type: "string" },
      { name: "wordList", type: "stringArray" }
    ],
    outputKind: "int",
    referenceBody: `
  const words = new Set(wordList);
  if (!words.has(endWord)) return 0;
  words.delete(beginWord);
  let level = 1;
  let frontier = new Set([beginWord]);
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  while (frontier.size) {
    const next = new Set();
    for (const w of frontier) {
      for (let i = 0; i < w.length; i++) {
        for (const c of alphabet) {
          if (c === w[i]) continue;
          const cand = w.slice(0, i) + c + w.slice(i + 1);
          if (cand === endWord) return level + 1;
          if (words.has(cand)) {
            next.add(cand);
            words.delete(cand);
          }
        }
      }
    }
    frontier = next;
    level++;
    if (frontier.size === 0) break;
  }
  return 0;`,
    testCases: [
      {
        values: { beginWord: "hit", endWord: "cog", wordList: ["hot", "dot", "dog", "lot", "log", "cog"] },
        visible: true
      },
      { values: { beginWord: "hit", endWord: "cog", wordList: ["hot", "dot", "dog", "lot", "log"] }, visible: true },
      { values: { beginWord: "a", endWord: "c", wordList: ["a", "b", "c"] } },
      { values: { beginWord: "hot", endWord: "dog", wordList: ["hot", "dog"] } },
      { values: { beginWord: "cat", endWord: "cat", wordList: ["cat"] } }
    ]
  },

  {
    id: "alien-dictionary",
    title: "Alien Dictionary",
    tags: ["Graph", "Topological Sort", "String"],
    companies: ["Amazon", "Google"],
    statement:
      "There is a new alien language that uses the English alphabet, but the order among letters is unknown. You are " +
      "given a list of words from the alien dictionary, sorted lexicographically by the rules of this new language. " +
      "Derive a valid ordering of letters. If there are multiple valid orderings, return the lexicographically " +
      "smallest one (comparing candidate orderings as strings). If no valid ordering exists, return an empty string.",
    inputFormat: "Line 1: integer n (number of words). Next n lines: one word each, already alien-sorted.",
    outputFormat: "A single string: the derived letter order, or an empty line if none exists.",
    constraints: ["1 <= n <= 200", "1 <= word length <= 10", "words contain only lowercase letters"],
    examples: [
      {
        input: "5\nwrt\nwrf\ner\nett\nrftt",
        output: "wertf",
        explanation: "The only (and lexicographically smallest) consistent ordering is w, e, r, t, f."
      },
      {
        input: "3\nabc\nab\nb",
        output: "",
        explanation: "\"abc\" appearing before its own prefix \"ab\" is impossible, so no ordering exists."
      }
    ],
    paramSpec: [{ name: "words", type: "stringArray" }],
    outputKind: "string",
    referenceBody: `
  const nodes = new Set();
  for (const w of words) for (const c of w) nodes.add(c);
  const adj = new Map();
  const indegree = new Map();
  for (const c of nodes) {
    adj.set(c, new Set());
    indegree.set(c, 0);
  }
  let valid = true;
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i], w2 = words[i + 1];
    const minLen = Math.min(w1.length, w2.length);
    let foundDiff = false;
    for (let j = 0; j < minLen; j++) {
      if (w1[j] !== w2[j]) {
        if (!adj.get(w1[j]).has(w2[j])) {
          adj.get(w1[j]).add(w2[j]);
          indegree.set(w2[j], indegree.get(w2[j]) + 1);
        }
        foundDiff = true;
        break;
      }
    }
    if (!foundDiff && w1.length > w2.length) valid = false;
  }
  if (!valid) return "";
  const result = [];
  const remaining = new Set(nodes);
  while (remaining.size) {
    const candidates = [...remaining].filter((c) => indegree.get(c) === 0).sort();
    if (candidates.length === 0) return "";
    const pick = candidates[0];
    result.push(pick);
    remaining.delete(pick);
    for (const nxt of adj.get(pick)) {
      indegree.set(nxt, indegree.get(nxt) - 1);
    }
  }
  return result.join("");`,
    testCases: [
      { values: { words: ["wrt", "wrf", "er", "ett", "rftt"] }, visible: true },
      { values: { words: ["abc", "ab", "b"] }, visible: true },
      { values: { words: ["z", "x"] } },
      { values: { words: ["z", "x", "z"] } },
      { values: { words: ["abc", "abd", "abe"] } }
    ]
  },

  {
    id: "minimum-window-substring",
    title: "Minimum Window Substring",
    tags: ["String", "Sliding Window", "Hash Table"],
    companies: ["Google", "Amazon"],
    statement:
      "Given two strings s and t, return the minimum window substring of s such that every character in t (including " +
      "duplicates) is included in the window. Return an empty string if no such substring exists.",
    inputFormat: "Line 1: string s. Line 2: string t.",
    outputFormat: "A single string: the minimum window, or an empty line if none exists.",
    constraints: ["1 <= s.length, t.length <= 100000"],
    examples: [
      {
        input: "ADOBECODEBANC\nABC",
        output: "BANC",
        explanation: "\"BANC\" is the smallest window in s containing all of A, B, and C."
      },
      { input: "a\naa", output: "", explanation: "s only has one 'a', so it can never contain t = \"aa\"." }
    ],
    paramSpec: [
      { name: "s", type: "string" },
      { name: "t", type: "string" }
    ],
    outputKind: "string",
    referenceBody: `
  if (t.length === 0 || s.length === 0) return "";
  const need = new Map();
  for (const c of t) need.set(c, (need.get(c) || 0) + 1);
  const required = need.size;
  let formed = 0;
  const windowCounts = new Map();
  let l = 0;
  let bestLen = Infinity, bestL = 0, bestR = 0;
  for (let r = 0; r < s.length; r++) {
    const c = s[r];
    windowCounts.set(c, (windowCounts.get(c) || 0) + 1);
    if (need.has(c) && windowCounts.get(c) === need.get(c)) formed++;
    while (l <= r && formed === required) {
      if (r - l + 1 < bestLen) {
        bestLen = r - l + 1;
        bestL = l;
        bestR = r;
      }
      const lc = s[l];
      windowCounts.set(lc, windowCounts.get(lc) - 1);
      if (need.has(lc) && windowCounts.get(lc) < need.get(lc)) formed--;
      l++;
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestL, bestR + 1);`,
    testCases: [
      { values: { s: "ADOBECODEBANC", t: "ABC" }, visible: true },
      { values: { s: "a", t: "aa" }, visible: true },
      { values: { s: "a", t: "a" } },
      { values: { s: "ab", t: "b" } },
      { values: { s: "aaaaaaaaaaaabbbbbcdd", t: "abcdd" } }
    ]
  },

  {
    id: "distinct-subsequences",
    title: "Distinct Subsequences",
    tags: ["String", "Dynamic Programming"],
    companies: ["Google", "Amazon"],
    statement:
      "Given two strings s and t, return the number of distinct subsequences of s which equal t.",
    inputFormat: "Line 1: string s. Line 2: string t.",
    outputFormat: "A single integer: the number of distinct subsequences.",
    constraints: ["0 <= s.length, t.length <= 1000"],
    examples: [
      {
        input: "rabbbit\nrabbit",
        output: "3",
        explanation: "There are 3 ways to pick letters from s that spell out \"rabbit\"."
      },
      { input: "babgbag\nbag", output: "5", explanation: "There are 5 distinct subsequences of s equal to \"bag\"." }
    ],
    paramSpec: [
      { name: "s", type: "string" },
      { name: "t", type: "string" }
    ],
    outputKind: "long",
    referenceBody: `
  const m = s.length, n = t.length;
  if (n === 0) return 1;
  if (m < n) return 0;
  const dp = new Array(n + 1).fill(0);
  dp[0] = 1;
  for (let i = 1; i <= m; i++) {
    for (let j = n; j >= 1; j--) {
      if (s[i - 1] === t[j - 1]) dp[j] += dp[j - 1];
    }
  }
  return dp[n];`,
    testCases: [
      { values: { s: "rabbbit", t: "rabbit" }, visible: true },
      { values: { s: "babgbag", t: "bag" }, visible: true },
      { values: { s: "", t: "" } },
      { values: { s: "abc", t: "" } },
      { values: { s: "aaaaaaaaaa", t: "aaa" } }
    ]
  },

  {
    id: "interleaving-string",
    title: "Interleaving String",
    tags: ["String", "Dynamic Programming"],
    companies: ["Amazon", "Google"],
    statement:
      "Given strings s1, s2, and s3, determine if s3 is formed by an interleaving of s1 and s2 (preserving the " +
      "relative order of characters within each of s1 and s2).",
    inputFormat: "Line 1: string s1. Line 2: string s2. Line 3: string s3.",
    outputFormat: "\"true\" if s3 is a valid interleaving, otherwise \"false\".",
    constraints: ["0 <= s1.length, s2.length <= 100", "0 <= s3.length <= 200"],
    examples: [
      {
        input: "aabcc\ndbbca\naadbbcbcac",
        output: "true",
        explanation: "s3 can be formed by interleaving characters from s1 and s2 in order."
      },
      { input: "aabcc\ndbbca\naadbbbaccc", output: "false", explanation: "No valid interleaving produces this s3." }
    ],
    paramSpec: [
      { name: "s1", type: "string" },
      { name: "s2", type: "string" },
      { name: "s3", type: "string" }
    ],
    outputKind: "bool",
    referenceBody: `
  const m = s1.length, n = s2.length;
  if (m + n !== s3.length) return false;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(false));
  dp[0][0] = true;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i > 0 && dp[i - 1][j] && s1[i - 1] === s3[i + j - 1]) dp[i][j] = true;
      if (j > 0 && dp[i][j - 1] && s2[j - 1] === s3[i + j - 1]) dp[i][j] = true;
    }
  }
  return dp[m][n];`,
    testCases: [
      { values: { s1: "aabcc", s2: "dbbca", s3: "aadbbcbcac" }, visible: true },
      { values: { s1: "aabcc", s2: "dbbca", s3: "aadbbbaccc" }, visible: true },
      { values: { s1: "", s2: "", s3: "" } },
      { values: { s1: "abc", s2: "", s3: "abc" } },
      { values: { s1: "abc", s2: "def", s3: "abdcef" } }
    ]
  },

  {
    id: "regular-expression-matching",
    title: "Regular Expression Matching",
    tags: ["String", "Dynamic Programming", "Recursion"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an input string s and a pattern p, implement regular expression matching supporting '.' (matches any " +
      "single character) and '*' (matches zero or more of the preceding element). The match must cover the entire " +
      "input string.",
    inputFormat: "Line 1: string s. Line 2: pattern p.",
    outputFormat: "\"true\" if the pattern matches the entire string, otherwise \"false\".",
    constraints: ["0 <= s.length <= 20", "0 <= p.length <= 30", "p is a valid pattern for this problem"],
    examples: [
      { input: "aa\na", output: "false", explanation: "\"a\" does not match the whole of \"aa\"." },
      { input: "aa\na*", output: "true", explanation: "'*' means zero or more of the preceding 'a', matching \"aa\"." }
    ],
    paramSpec: [
      { name: "s", type: "string" },
      { name: "p", type: "string" }
    ],
    outputKind: "bool",
    referenceBody: `
  const m = s.length, n = p.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(false));
  dp[0][0] = true;
  for (let j = 1; j <= n; j++) if (p[j - 1] === "*") dp[0][j] = dp[0][j - 2];
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (p[j - 1] === "*") {
        dp[i][j] = dp[i][j - 2] || ((p[j - 2] === "." || p[j - 2] === s[i - 1]) && dp[i - 1][j]);
      } else if (p[j - 1] === "." || p[j - 1] === s[i - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      }
    }
  }
  return dp[m][n];`,
    testCases: [
      { values: { s: "aa", p: "a" }, visible: true },
      { values: { s: "aa", p: "a*" }, visible: true },
      { values: { s: "ab", p: ".*" } },
      { values: { s: "mississippi", p: "mis*is*p*." } },
      { values: { s: "", p: "a*b*c*" } },
      { values: { s: "aab", p: "c*a*b" } }
    ]
  },

  {
    id: "wildcard-matching",
    title: "Wildcard Matching",
    tags: ["String", "Dynamic Programming", "Greedy"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an input string s and a pattern p, implement wildcard pattern matching supporting '?' (matches any " +
      "single character) and '*' (matches any sequence of characters, including the empty sequence). The match must " +
      "cover the entire input string.",
    inputFormat: "Line 1: string s. Line 2: pattern p.",
    outputFormat: "\"true\" if the pattern matches the entire string, otherwise \"false\".",
    constraints: ["0 <= s.length <= 2000", "0 <= p.length <= 2000"],
    examples: [
      { input: "aa\na", output: "false", explanation: "\"a\" does not match the whole of \"aa\"." },
      { input: "aa\n*", output: "true", explanation: "'*' matches any sequence, including \"aa\"." }
    ],
    paramSpec: [
      { name: "s", type: "string" },
      { name: "p", type: "string" }
    ],
    outputKind: "bool",
    referenceBody: `
  const m = s.length, n = p.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(false));
  dp[0][0] = true;
  for (let j = 1; j <= n; j++) if (p[j - 1] === "*") dp[0][j] = dp[0][j - 1];
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (p[j - 1] === "*") dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
      else if (p[j - 1] === "?" || p[j - 1] === s[i - 1]) dp[i][j] = dp[i - 1][j - 1];
    }
  }
  return dp[m][n];`,
    testCases: [
      { values: { s: "aa", p: "a" }, visible: true },
      { values: { s: "aa", p: "*" }, visible: true },
      { values: { s: "cb", p: "?a" } },
      { values: { s: "adceb", p: "*a*b*" } },
      { values: { s: "acdcb", p: "a*c?b" } },
      { values: { s: "", p: "*" } }
    ]
  },

  {
    id: "n-queens-ii",
    title: "N-Queens II",
    tags: ["Backtracking", "Bit Manipulation"],
    companies: ["Amazon", "Google"],
    statement:
      "The n-queens puzzle is the problem of placing n queens on an n x n chessboard such that no two queens attack " +
      "each other. Given an integer n, return the number of distinct solutions to the n-queens puzzle.",
    inputFormat: "Line 1: integer n.",
    outputFormat: "A single integer: the number of distinct solutions.",
    constraints: ["1 <= n <= 9"],
    examples: [
      { input: "4", output: "2", explanation: "There are exactly 2 distinct solutions for a 4x4 board." },
      { input: "1", output: "1", explanation: "A single queen trivially solves the 1x1 board." }
    ],
    paramSpec: [{ name: "n", type: "int" }],
    outputKind: "int",
    referenceBody: `
  let count = 0;
  const cols = new Set(), diag1 = new Set(), diag2 = new Set();
  function backtrack(row) {
    if (row === n) {
      count++;
      return;
    }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) continue;
      cols.add(col);
      diag1.add(row - col);
      diag2.add(row + col);
      backtrack(row + 1);
      cols.delete(col);
      diag1.delete(row - col);
      diag2.delete(row + col);
    }
  }
  backtrack(0);
  return count;`,
    testCases: [
      { values: { n: 4 }, visible: true },
      { values: { n: 1 }, visible: true },
      { values: { n: 2 } },
      { values: { n: 6 } },
      { values: { n: 8 } }
    ]
  },

  {
    id: "basic-calculator",
    title: "Basic Calculator",
    tags: ["String", "Stack", "Math"],
    companies: ["Amazon", "Google"],
    statement:
      "Given a string s representing a valid mathematical expression, implement a basic calculator to evaluate it and " +
      "return the result. The expression may contain '+', '-', parentheses '(' ')', digits, and spaces (no " +
      "multiplication or division).",
    inputFormat: "Line 1: the expression string s (may contain spaces).",
    outputFormat: "A single integer: the evaluated result.",
    constraints: ["1 <= s.length <= 30000", "s is a valid expression"],
    examples: [
      { input: "1 + 1", output: "2", explanation: "1 + 1 evaluates to 2." },
      { input: "(1+(4+5+2)-3)+(6+8)", output: "23", explanation: "Evaluating the nested parentheses gives 23." }
    ],
    paramSpec: [{ name: "s", type: "string" }],
    outputKind: "long",
    referenceBody: `
  let result = 0, sign = 1, num = 0;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= "0" && c <= "9") {
      num = num * 10 + (c.charCodeAt(0) - 48);
    } else if (c === "+") {
      result += sign * num;
      num = 0;
      sign = 1;
    } else if (c === "-") {
      result += sign * num;
      num = 0;
      sign = -1;
    } else if (c === "(") {
      stack.push(result);
      stack.push(sign);
      result = 0;
      sign = 1;
    } else if (c === ")") {
      result += sign * num;
      num = 0;
      const signBeforeParen = stack.pop();
      const resultBeforeParen = stack.pop();
      result = resultBeforeParen + signBeforeParen * result;
      sign = 1;
    }
  }
  result += sign * num;
  return result;`,
    testCases: [
      { values: { s: "1 + 1" }, visible: true },
      { values: { s: "(1+(4+5+2)-3)+(6+8)" }, visible: true },
      { values: { s: " 2-1 + 2 " } },
      { values: { s: "-(2+3)" } },
      { values: { s: "((10))" } }
    ]
  },

  {
    id: "longest-increasing-path-matrix",
    title: "Longest Increasing Path in a Matrix",
    tags: ["Matrix", "Depth-First Search", "Dynamic Programming", "Memoization"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an m x n integer matrix, return the length of the longest strictly increasing path, where you may move " +
      "in any of the four cardinal directions (no wrapping).",
    inputFormat: "Line 1: rows cols. Next rows lines: cols space-separated integers each.",
    outputFormat: "A single integer: the length of the longest increasing path.",
    constraints: ["1 <= rows, cols <= 200", "0 <= matrix[i][j] <= 2^31 - 1"],
    examples: [
      {
        input: "3 3\n9 9 4\n6 6 8\n2 1 1",
        output: "4",
        explanation: "The path 1 -> 2 -> 6 -> 9 has length 4."
      },
      {
        input: "3 3\n3 4 5\n3 2 6\n2 2 1",
        output: "4",
        explanation: "The path 3 -> 4 -> 5 -> 6 has length 4."
      }
    ],
    paramSpec: [{ name: "matrix", type: "grid" }],
    outputKind: "int",
    referenceBody: `
  const rows = matrix.length;
  if (!rows) return 0;
  const cols = matrix[0].length;
  if (!cols) return 0;
  const memo = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function dfs(r, c) {
    if (memo[r][c]) return memo[r][c];
    let best = 1;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && matrix[nr][nc] > matrix[r][c]) {
        best = Math.max(best, 1 + dfs(nr, nc));
      }
    }
    memo[r][c] = best;
    return best;
  }
  let ans = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ans = Math.max(ans, dfs(r, c));
  return ans;`,
    testCases: [
      { values: { matrix: [[9, 9, 4], [6, 6, 8], [2, 1, 1]] }, visible: true },
      { values: { matrix: [[3, 4, 5], [3, 2, 6], [2, 2, 1]] }, visible: true },
      { values: { matrix: [[1]] } },
      { values: { matrix: [[1, 2, 3, 4, 5]] } },
      { values: { matrix: [[7, 7, 7], [7, 7, 7]] } }
    ]
  },

  {
    id: "merge-k-sorted-arrays",
    title: "Merge k Sorted Arrays",
    tags: ["Heap", "Divide and Conquer", "Merge"],
    companies: ["Google", "Amazon"],
    statement:
      "You are given k sorted integer arrays. Merge all the arrays into one sorted array and return it. " +
      "(This is the array-based variant of the classic Merge k Sorted Lists problem.)",
    inputFormat:
      "Line 1: integer k. Then for each of the k arrays: a line with its size, followed by a line with its " +
      "space-separated elements (omitted if size is 0).",
    outputFormat: "Space-separated integers: all elements merged into a single sorted sequence.",
    constraints: ["0 <= k <= 10000", "0 <= total elements <= 100000"],
    examples: [
      {
        input: "3\n3\n1 4 5\n3\n1 3 4\n2\n2 6",
        output: "1 1 2 3 4 4 5 6",
        explanation: "Merging [1,4,5], [1,3,4], and [2,6] yields this fully sorted sequence."
      },
      { input: "0", output: "", explanation: "There are no arrays to merge, so the result is empty." }
    ],
    paramSpec: [{ name: "arrays", type: "intArrayList" }],
    outputKind: "intArray",
    referenceBody: `
  const merged = [];
  for (const a of arrays) for (const x of a) merged.push(x);
  merged.sort((a, b) => a - b);
  return merged;`,
    testCases: [
      { values: { arrays: [[1, 4, 5], [1, 3, 4], [2, 6]] }, visible: true },
      { values: { arrays: [] }, visible: true },
      { values: { arrays: [[]] } },
      { values: { arrays: [[3, 4, 5]] } },
      { values: { arrays: [[1, 2], [], [0, 0, 3], [-1]] } }
    ]
  },

  {
    id: "find-median-data-stream",
    title: "Find Median from Data Stream",
    tags: ["Heap", "Design", "Two Heaps"],
    companies: ["Google", "Amazon"],
    statement:
      "You are given a stream of integers arriving one at a time. After each integer is added to the running " +
      "collection, report the median of all integers seen so far.",
    inputFormat: "Line 1: integer n (size of the stream). Line 2: n space-separated integers, in arrival order.",
    outputFormat: "n lines, each with the median (formatted with 6 decimal places) after that integer is added.",
    constraints: ["1 <= n <= 20000", "-1e5 <= value <= 1e5"],
    examples: [
      {
        input: "3\n5 15 1",
        output: "5.000000\n10.000000\n5.000000",
        explanation: "Medians after each insertion: 5, then (5+15)/2=10, then 5 (middle of [1,5,15])."
      },
      {
        input: "1\n42",
        output: "42.000000",
        explanation: "With a single value, the median is that value."
      }
    ],
    paramSpec: [{ name: "stream", type: "intArray" }],
    outputKind: "doubleArray",
    referenceBody: `
  const sorted = [];
  const res = [];
  for (const x of stream) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    sorted.splice(lo, 0, x);
    const n = sorted.length;
    res.push(n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2);
  }
  return res;`,
    testCases: [
      { values: { stream: [5, 15, 1] }, visible: true },
      { values: { stream: [42] }, visible: true },
      { values: { stream: [5, 15, 1, 3, 8] } },
      { values: { stream: [-5, -1, -3, -2, -4] } },
      { values: { stream: [1, 1, 1, 1] } }
    ]
  },

  {
    id: "word-break-ii",
    title: "Word Break II",
    tags: ["String", "Dynamic Programming", "Backtracking", "Memoization"],
    companies: ["Google", "Amazon"],
    statement:
      "Given a string s and a dictionary of strings wordDict, add spaces in s to construct every possible sentence " +
      "where each word is a valid dictionary word. Return all such sentences.",
    inputFormat: "Line 1: string s. Line 2: integer n (size of wordDict). Next n lines: one dictionary word each.",
    outputFormat:
      "First line: the number of valid sentences. Then each sentence on its own line (words separated by single " +
      "spaces), sorted alphabetically.",
    constraints: ["1 <= s.length <= 20", "1 <= wordDict size <= 1000", "all strings are lowercase letters"],
    examples: [
      {
        input: "catsanddog\n5\ncat\ncats\nand\nsand\ndog",
        output: "2\ncat sand dog\ncats and dog",
        explanation: "Both \"cat sand dog\" and \"cats and dog\" can be built entirely from dictionary words."
      },
      {
        input: "catsandog\n5\ncats\ndog\nsand\nand\ncat",
        output: "0",
        explanation: "No combination of dictionary words can spell out the full string, so there are no sentences."
      }
    ],
    paramSpec: [
      { name: "s", type: "string" },
      { name: "wordDict", type: "stringArray" }
    ],
    outputKind: "stringArray",
    referenceBody: `
  const dict = new Set(wordDict);
  const memo = new Map();
  function backtrack(start) {
    if (memo.has(start)) return memo.get(start);
    if (start === s.length) return [""];
    const sentences = [];
    for (let end = start + 1; end <= s.length; end++) {
      const word = s.slice(start, end);
      if (dict.has(word)) {
        const rest = backtrack(end);
        for (const r of rest) {
          sentences.push(word + (r ? " " + r : ""));
        }
      }
    }
    memo.set(start, sentences);
    return sentences;
  }
  return backtrack(0);`,
    testCases: [
      { values: { s: "catsanddog", wordDict: ["cat", "cats", "and", "sand", "dog"] }, visible: true },
      { values: { s: "catsandog", wordDict: ["cats", "dog", "sand", "and", "cat"] }, visible: true },
      {
        values: {
          s: "pineapplepenapple",
          wordDict: ["apple", "pen", "applepen", "pine", "pineapple"]
        }
      },
      { values: { s: "a", wordDict: ["a"] } },
      { values: { s: "abcd", wordDict: ["a", "b", "c", "d"] } }
    ]
  },

  {
    id: "maximal-rectangle",
    title: "Maximal Rectangle",
    tags: ["Matrix", "Stack", "Dynamic Programming", "Monotonic Stack"],
    companies: ["Google", "Amazon"],
    statement:
      "Given a rows x cols binary matrix filled with '0' and '1', find the area of the largest rectangle containing " +
      "only 1's.",
    inputFormat: "Line 1: rows cols. Next rows lines: one row each, a string of '0'/'1' characters of length cols.",
    outputFormat: "A single integer: the area of the largest all-1s rectangle.",
    constraints: ["1 <= rows, cols <= 200"],
    examples: [
      {
        input: "4 5\n10100\n10111\n11111\n10010",
        output: "6",
        explanation: "The largest all-1s rectangle (rows 1-2, columns 2-4) has area 6."
      },
      { input: "1 1\n0", output: "0", explanation: "There are no 1's, so the largest rectangle has area 0." }
    ],
    paramSpec: [{ name: "grid", type: "charGrid" }],
    outputKind: "int",
    referenceBody: `
  const rows = grid.length;
  if (!rows) return 0;
  const cols = grid[0].length;
  const heights = new Array(cols).fill(0);
  let maxArea = 0;
  function largestRectangleArea(h) {
    const stack = [];
    let max = 0;
    const hh = h.concat([0]);
    for (let i = 0; i < hh.length; i++) {
      while (stack.length && hh[stack[stack.length - 1]] >= hh[i]) {
        const top = stack.pop();
        const height = hh[top];
        const width = stack.length ? i - stack[stack.length - 1] - 1 : i;
        max = Math.max(max, height * width);
      }
      stack.push(i);
    }
    return max;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heights[c] = grid[r][c] === "1" ? heights[c] + 1 : 0;
    }
    maxArea = Math.max(maxArea, largestRectangleArea(heights.slice()));
  }
  return maxArea;`,
    testCases: [
      { values: { grid: ["10100", "10111", "11111", "10010"] }, visible: true },
      { values: { grid: ["0"] }, visible: true },
      { values: { grid: ["1"] } },
      { values: { grid: ["11", "11"] } },
      { values: { grid: ["000", "000", "000"] } }
    ]
  },

  {
    id: "count-of-smaller-numbers-after-self",
    title: "Count of Smaller Numbers After Self",
    tags: ["Array", "Binary Indexed Tree", "Merge Sort", "Divide and Conquer"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an integer array nums, return an array counts where counts[i] is the number of elements to the right of " +
      "index i that are smaller than nums[i].",
    inputFormat: "Line 1: integer n. Line 2: n space-separated integers nums[i].",
    outputFormat: "Space-separated integers: counts[i] for each index, in order.",
    constraints: ["0 <= n <= 5000", "-10000 <= nums[i] <= 10000"],
    examples: [
      {
        input: "4\n5 2 6 1",
        output: "2 1 1 0",
        explanation: "To the right of 5 there are two smaller values (2, 1); to the right of 6 there is one (1)."
      },
      { input: "3\n-1 -1 -1", output: "0 0 0", explanation: "No element has a strictly smaller value to its right." }
    ],
    paramSpec: [{ name: "nums", type: "intArray" }],
    outputKind: "intArray",
    referenceBody: `
  const n = nums.length;
  const res = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let j = i + 1; j < n; j++) if (nums[j] < nums[i]) count++;
    res[i] = count;
  }
  return res;`,
    testCases: [
      { values: { nums: [5, 2, 6, 1] }, visible: true },
      { values: { nums: [-1, -1, -1] }, visible: true },
      { values: { nums: [] } },
      { values: { nums: [1] } },
      { values: { nums: [5, 4, 3, 2, 1] } }
    ]
  },

  {
    id: "palindrome-pairs",
    title: "Palindrome Pairs",
    tags: ["String", "Hash Table", "Trie"],
    companies: ["Google", "Amazon"],
    statement:
      "Given a list of unique words, return all pairs of distinct indices (i, j) such that concatenating " +
      "words[i] + words[j] forms a palindrome.",
    inputFormat: "Line 1: integer n. Next n lines: one word each.",
    outputFormat:
      "First line: the number of valid pairs. Then each pair as \"i j\" on its own line (indices are 0-based), " +
      "sorted alphabetically as strings.",
    constraints: ["1 <= n <= 300", "0 <= word length <= 100", "all words are lowercase letters, possibly empty"],
    examples: [
      {
        input: "5\nabcd\ndcba\nlls\ns\nsssll",
        output: "4\n0 1\n1 0\n2 4\n3 2",
        explanation: "abcd+dcba, dcba+abcd, lls+sssll, and s+lls are all palindromes."
      },
      {
        input: "3\nbat\ntab\ncat",
        output: "2\n0 1\n1 0",
        explanation: "bat+tab and tab+bat are palindromes; cat pairs with nothing."
      }
    ],
    paramSpec: [{ name: "words", type: "stringArray" }],
    outputKind: "stringArray",
    referenceBody: `
  function isPalindrome(str) {
    let l = 0, r = str.length - 1;
    while (l < r) {
      if (str[l] !== str[r]) return false;
      l++;
      r--;
    }
    return true;
  }
  const res = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = 0; j < words.length; j++) {
      if (i === j) continue;
      if (isPalindrome(words[i] + words[j])) res.push(i + " " + j);
    }
  }
  return res;`,
    testCases: [
      { values: { words: ["abcd", "dcba", "lls", "s", "sssll"] }, visible: true },
      { values: { words: ["bat", "tab", "cat"] }, visible: true },
      { values: { words: ["a", ""] } },
      { values: { words: ["ab", "ba"] } },
      { values: { words: ["abc", "cba", "xyz"] } }
    ]
  },

  {
    id: "shortest-path-visiting-all-nodes",
    title: "Shortest Path Visiting All Nodes",
    tags: ["Graph", "Breadth-First Search", "Bitmask Dynamic Programming"],
    companies: ["Google", "Amazon"],
    statement:
      "You are given an undirected connected graph of n nodes given as an adjacency list. Return the length of the " +
      "shortest path that visits every node at least once, starting from any node and ending at any node.",
    inputFormat: "Line 1: integer n (number of nodes). Next n lines: each node's adjacency list (size, then neighbors).",
    outputFormat: "A single integer: the length of the shortest path visiting every node.",
    constraints: ["1 <= n <= 12", "the graph is always connected"],
    examples: [
      {
        input: "4\n3\n1 2 3\n1\n0\n1\n0\n1\n0",
        output: "4",
        explanation: "Starting at node 1, the path 1 -> 0 -> 2 -> 0 -> 3 visits every node in 4 moves."
      },
      {
        input: "5\n1\n1\n3\n0 2 4\n1\n1\n1\n2\n2\n1 2",
        output: "4",
        explanation: "A path such as 0 -> 1 -> 4 -> 2 -> 3 visits every node in 4 moves."
      }
    ],
    paramSpec: [{ name: "graph", type: "intArrayList" }],
    outputKind: "int",
    referenceBody: `
  const n = graph.length;
  if (n === 1) return 0;
  const target = (1 << n) - 1;
  const visited = new Set();
  let queue = [];
  for (let i = 0; i < n; i++) {
    queue.push([i, 1 << i, 0]);
    visited.add(i + "," + (1 << i));
  }
  while (queue.length) {
    const next = [];
    for (const [node, mask, steps] of queue) {
      if (mask === target) return steps;
      for (const nei of graph[node]) {
        const nmask = mask | (1 << nei);
        const key = nei + "," + nmask;
        if (!visited.has(key)) {
          visited.add(key);
          next.push([nei, nmask, steps + 1]);
        }
      }
    }
    queue = next;
  }
  return -1;`,
    testCases: [
      { values: { graph: [[1, 2, 3], [0], [0], [0]] }, visible: true },
      { values: { graph: [[1], [0, 2, 4], [1, 3, 4], [2], [1, 2]] }, visible: true },
      { values: { graph: [[]] } },
      { values: { graph: [[1], [0]] } },
      { values: { graph: [[1, 2], [0, 2], [0, 1]] } }
    ]
  },

  {
    id: "race-car",
    title: "Race Car",
    tags: ["Breadth-First Search", "Dynamic Programming"],
    companies: ["Google"],
    statement:
      "Your car starts at position 0 with speed +1 on an infinite number line. The car can accelerate (position += " +
      "speed, speed *= 2) or reverse (speed becomes -1 if positive, or 1 if negative, position unchanged). Given a " +
      "target position, return the minimum number of instructions to reach it.",
    inputFormat: "Line 1: integer target.",
    outputFormat: "A single integer: the minimum number of instructions needed to reach target.",
    constraints: ["1 <= target <= 10000"],
    examples: [
      {
        input: "3",
        output: "2",
        explanation: "Accelerate twice: position goes 0 -> 1 -> 3 (speed 1 then 2), reaching the target in 2 moves."
      },
      {
        input: "6",
        output: "5",
        explanation: "The shortest known instruction sequence for target 6 takes 5 moves."
      }
    ],
    paramSpec: [{ name: "target", type: "int" }],
    outputKind: "int",
    referenceBody: `
  const visited = new Set(["0,1"]);
  let queue = [[0, 1]];
  let steps = 0;
  const limit = 2 * Math.abs(target) + 1;
  while (queue.length) {
    const next = [];
    for (const [pos, speed] of queue) {
      if (pos === target) return steps;
      const p1 = pos + speed, s1 = speed * 2;
      if (Math.abs(p1) <= limit) {
        const key1 = p1 + "," + s1;
        if (!visited.has(key1)) {
          visited.add(key1);
          next.push([p1, s1]);
        }
      }
      const s2 = speed > 0 ? -1 : 1;
      const key2 = pos + "," + s2;
      if (!visited.has(key2)) {
        visited.add(key2);
        next.push([pos, s2]);
      }
    }
    queue = next;
    steps++;
  }
  return -1;`,
    testCases: [
      { values: { target: 3 }, visible: true },
      { values: { target: 6 }, visible: true },
      { values: { target: 1 } },
      { values: { target: 2 } },
      { values: { target: 11 } }
    ]
  },

  {
    id: "bus-routes",
    title: "Bus Routes",
    tags: ["Graph", "Breadth-First Search", "Hash Table"],
    companies: ["Google", "Amazon"],
    statement:
      "Given a list of bus routes (each a list of stops it visits, in order of operation, and any stop can be boarded " +
      "in any order along the route) and a source and target stop, return the minimum number of buses a rider must " +
      "take to reach target from source. Return -1 if it is not possible.",
    inputFormat:
      "Line 1: integer k (number of routes). For each route: a line with its stop count, then a line with its " +
      "space-separated stops. Final two lines: source and target.",
    outputFormat: "A single integer: the minimum number of buses needed, or -1 if unreachable.",
    constraints: ["1 <= k <= 500", "0 <= stops per route <= 100000", "all stop ids fit in a 32-bit integer"],
    examples: [
      {
        input: "2\n3\n1 2 7\n3\n3 6 7\n1\n6",
        output: "2",
        explanation: "Take the first route from stop 1 to stop 7, then the second route from stop 7 to stop 6."
      },
      {
        input: "2\n2\n7 12\n3\n4 5 15\n15\n12",
        output: "-1",
        explanation: "No sequence of routes connects stop 15 to stop 12."
      }
    ],
    paramSpec: [
      { name: "routes", type: "intArrayList" },
      { name: "source", type: "int" },
      { name: "target", type: "int" }
    ],
    outputKind: "int",
    referenceBody: `
  if (source === target) return 0;
  const stopToRoutes = new Map();
  for (let r = 0; r < routes.length; r++) {
    for (const stop of routes[r]) {
      if (!stopToRoutes.has(stop)) stopToRoutes.set(stop, []);
      stopToRoutes.get(stop).push(r);
    }
  }
  const visitedRoutes = new Set();
  const visitedStops = new Set([source]);
  let queue = [source];
  let buses = 0;
  while (queue.length) {
    const next = [];
    for (const stop of queue) {
      if (stop === target) return buses;
      const routesHere = stopToRoutes.get(stop) || [];
      for (const r of routesHere) {
        if (visitedRoutes.has(r)) continue;
        visitedRoutes.add(r);
        for (const s of routes[r]) {
          if (!visitedStops.has(s)) {
            visitedStops.add(s);
            next.push(s);
          }
        }
      }
    }
    queue = next;
    buses++;
  }
  return -1;`,
    testCases: [
      { values: { routes: [[1, 2, 7], [3, 6, 7]], source: 1, target: 6 }, visible: true },
      { values: { routes: [[7, 12], [4, 5, 15]], source: 15, target: 12 }, visible: true },
      { values: { routes: [[1, 2, 3]], source: 1, target: 1 } },
      { values: { routes: [[1, 2, 3]], source: 1, target: 5 } },
      { values: { routes: [[1, 5], [5, 9], [9, 12]], source: 1, target: 12 } }
    ]
  },

  {
    id: "split-array-largest-sum",
    title: "Split Array Largest Sum",
    tags: ["Array", "Binary Search", "Greedy", "Dynamic Programming"],
    companies: ["Google", "Amazon"],
    statement:
      "Given an integer array nums and an integer m, split nums into m non-empty contiguous subarrays so that the " +
      "largest sum among these subarrays is minimized. Return that minimized largest sum.",
    inputFormat: "Line 1: integer n. Line 2: n space-separated integers nums[i]. Line 3: integer m.",
    outputFormat: "A single integer: the minimized largest subarray sum.",
    constraints: ["1 <= n <= 1000", "0 <= nums[i] <= 1000000", "1 <= m <= min(50, n)"],
    examples: [
      {
        input: "5\n7 2 5 10 8\n2",
        output: "18",
        explanation: "Splitting into [7,2,5] and [10,8] gives the smallest possible largest sum, 18."
      },
      {
        input: "5\n1 2 3 4 5\n2",
        output: "9",
        explanation: "Splitting into [1,2,3,4] and [5] (sums 10 and 5) is worse than [1,2,3] and [4,5] (sums 6 and 9)."
      }
    ],
    paramSpec: [
      { name: "nums", type: "intArray" },
      { name: "m", type: "int" }
    ],
    outputKind: "long",
    referenceBody: `
  let lo = Math.max(...nums, 0);
  let hi = nums.reduce((a, b) => a + b, 0);
  function canSplit(maxSum) {
    let pieces = 1, curSum = 0;
    for (const x of nums) {
      if (curSum + x > maxSum) {
        pieces++;
        curSum = x;
        if (pieces > m) return false;
      } else {
        curSum += x;
      }
    }
    return pieces <= m;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (canSplit(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;`,
    testCases: [
      { values: { nums: [7, 2, 5, 10, 8], m: 2 }, visible: true },
      { values: { nums: [1, 2, 3, 4, 5], m: 2 }, visible: true },
      { values: { nums: [1, 4, 4], m: 3 } },
      { values: { nums: [10], m: 1 } },
      { values: { nums: [2, 3, 1, 1, 1, 1, 1], m: 3 } }
    ]
  }
];

module.exports = { PROBLEMS };
