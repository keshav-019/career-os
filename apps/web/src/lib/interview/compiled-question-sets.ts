export type CompiledDifficulty = "easy" | "medium" | "hard";

export type CompiledCodingQuestionRef = {
  category: string;
  difficulty: CompiledDifficulty;
  id: string;
  source: "leetcode" | "geeksforgeeks" | "codingninjas";
  sourceCollectionUrl: string;
  title: string;
};

export type CompiledAptitudeQuestionRef = {
  category: string;
  correctOptionId: "a" | "b" | "c" | "d";
  difficulty: "easy" | "medium";
  explanation: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  options: [string, string, string, string];
  prompt: string;
  source: "indiabix" | "learntheta";
  sourceCollectionUrl: string;
};

type CodingSeed = {
  category: string;
  difficulty: CompiledDifficulty;
  title: string;
};

const LEETCODE_SOURCE_URL = "https://leetcode.com/studyplan/top-interview-150/";
const GFG_SOURCE_URL = "https://www.geeksforgeeks.org/must-do-coding-questions-for-product-based-companies/";
const CODING_NINJAS_SOURCE_URL = "https://www.naukri.com/code360/problem-lists/top-interview-questions?source=youtube&campaign=codestudio_toplists";

const LEETCODE_SEEDS: CodingSeed[] = [
  { title: "Two Sum", category: "Arrays", difficulty: "easy" },
  { title: "Best Time to Buy and Sell Stock", category: "Arrays", difficulty: "easy" },
  { title: "Contains Duplicate", category: "Arrays", difficulty: "easy" },
  { title: "Product of Array Except Self", category: "Arrays", difficulty: "medium" },
  { title: "Maximum Subarray", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Maximum Product Subarray", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Find Minimum in Rotated Sorted Array", category: "Binary Search", difficulty: "medium" },
  { title: "Search in Rotated Sorted Array", category: "Binary Search", difficulty: "medium" },
  { title: "3Sum", category: "Two Pointers", difficulty: "medium" },
  { title: "Container With Most Water", category: "Two Pointers", difficulty: "medium" },
  { title: "Trapping Rain Water", category: "Two Pointers", difficulty: "hard" },
  { title: "Longest Consecutive Sequence", category: "Hashing", difficulty: "medium" },
  { title: "Set Matrix Zeroes", category: "Matrices", difficulty: "medium" },
  { title: "Spiral Matrix", category: "Matrices", difficulty: "medium" },
  { title: "Rotate Image", category: "Matrices", difficulty: "medium" },
  { title: "Merge Intervals", category: "Intervals", difficulty: "medium" },
  { title: "Insert Interval", category: "Intervals", difficulty: "medium" },
  { title: "Non-overlapping Intervals", category: "Intervals", difficulty: "medium" },
  { title: "Meeting Rooms II", category: "Intervals", difficulty: "medium" },
  { title: "Valid Anagram", category: "Strings", difficulty: "easy" },
  { title: "Group Anagrams", category: "Strings", difficulty: "medium" },
  { title: "Valid Parentheses", category: "Stack", difficulty: "easy" },
  { title: "Generate Parentheses", category: "Backtracking", difficulty: "medium" },
  { title: "Longest Substring Without Repeating Characters", category: "Sliding Window", difficulty: "medium" },
  { title: "Longest Repeating Character Replacement", category: "Sliding Window", difficulty: "medium" },
  { title: "Minimum Window Substring", category: "Sliding Window", difficulty: "hard" },
  { title: "Valid Palindrome", category: "Two Pointers", difficulty: "easy" },
  { title: "Longest Palindromic Substring", category: "Strings", difficulty: "medium" },
  { title: "Palindromic Substrings", category: "Strings", difficulty: "medium" },
  { title: "Find All Anagrams in a String", category: "Sliding Window", difficulty: "medium" },
  { title: "Reverse Linked List", category: "Linked List", difficulty: "easy" },
  { title: "Linked List Cycle", category: "Linked List", difficulty: "easy" },
  { title: "Merge Two Sorted Lists", category: "Linked List", difficulty: "easy" },
  { title: "Remove Nth Node From End of List", category: "Linked List", difficulty: "medium" },
  { title: "Reorder List", category: "Linked List", difficulty: "medium" },
  { title: "Add Two Numbers", category: "Linked List", difficulty: "medium" },
  { title: "Copy List with Random Pointer", category: "Linked List", difficulty: "medium" },
  { title: "LRU Cache", category: "Design", difficulty: "hard" },
  { title: "Maximum Depth of Binary Tree", category: "Trees", difficulty: "easy" },
  { title: "Same Tree", category: "Trees", difficulty: "easy" },
  { title: "Invert Binary Tree", category: "Trees", difficulty: "easy" },
  { title: "Binary Tree Level Order Traversal", category: "Trees", difficulty: "medium" },
  { title: "Serialize and Deserialize Binary Tree", category: "Trees", difficulty: "hard" },
  { title: "Subtree of Another Tree", category: "Trees", difficulty: "easy" },
  { title: "Construct Binary Tree from Preorder and Inorder Traversal", category: "Trees", difficulty: "medium" },
  { title: "Validate Binary Search Tree", category: "Trees", difficulty: "medium" },
  { title: "Kth Smallest Element in a BST", category: "Trees", difficulty: "medium" },
  { title: "Lowest Common Ancestor of a Binary Search Tree", category: "Trees", difficulty: "medium" },
  { title: "Lowest Common Ancestor of a Binary Tree", category: "Trees", difficulty: "medium" },
  { title: "Diameter of Binary Tree", category: "Trees", difficulty: "easy" },
  { title: "Balanced Binary Tree", category: "Trees", difficulty: "easy" },
  { title: "Binary Tree Right Side View", category: "Trees", difficulty: "medium" },
  { title: "Kth Largest Element in an Array", category: "Heaps", difficulty: "medium" },
  { title: "Top K Frequent Elements", category: "Heaps", difficulty: "medium" },
  { title: "Find Median from Data Stream", category: "Heaps", difficulty: "hard" },
  { title: "Merge k Sorted Lists", category: "Heaps", difficulty: "hard" },
  { title: "Task Scheduler", category: "Greedy", difficulty: "medium" },
  { title: "Number of Islands", category: "Graphs", difficulty: "medium" },
  { title: "Clone Graph", category: "Graphs", difficulty: "medium" },
  { title: "Pacific Atlantic Water Flow", category: "Graphs", difficulty: "medium" },
  { title: "Course Schedule", category: "Graphs", difficulty: "medium" },
  { title: "Course Schedule II", category: "Graphs", difficulty: "medium" },
  { title: "Graph Valid Tree", category: "Graphs", difficulty: "medium" },
  { title: "Number of Connected Components in an Undirected Graph", category: "Graphs", difficulty: "medium" },
  { title: "Redundant Connection", category: "Graphs", difficulty: "medium" },
  { title: "Word Ladder", category: "Graphs", difficulty: "hard" },
  { title: "Climbing Stairs", category: "Dynamic Programming", difficulty: "easy" },
  { title: "House Robber", category: "Dynamic Programming", difficulty: "medium" },
  { title: "House Robber II", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Coin Change", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Longest Increasing Subsequence", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Longest Common Subsequence", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Word Break", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Combination Sum IV", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Partition Equal Subset Sum", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Decode Ways", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Unique Paths", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Minimum Path Sum", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Edit Distance", category: "Dynamic Programming", difficulty: "hard" },
  { title: "Interleaving String", category: "Dynamic Programming", difficulty: "hard" },
  { title: "Target Sum", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Subsets", category: "Backtracking", difficulty: "medium" },
  { title: "Combination Sum", category: "Backtracking", difficulty: "medium" },
  { title: "Permutations", category: "Backtracking", difficulty: "medium" },
  { title: "Word Search", category: "Backtracking", difficulty: "medium" },
  { title: "N-Queens", category: "Backtracking", difficulty: "hard" },
  { title: "Letter Combinations of a Phone Number", category: "Backtracking", difficulty: "medium" },
  { title: "Binary Search", category: "Binary Search", difficulty: "easy" },
  { title: "Search a 2D Matrix", category: "Binary Search", difficulty: "medium" },
  { title: "Time Based Key-Value Store", category: "Binary Search", difficulty: "medium" },
  { title: "Koko Eating Bananas", category: "Binary Search", difficulty: "medium" },
  { title: "Median of Two Sorted Arrays", category: "Binary Search", difficulty: "hard" },
  { title: "Jump Game", category: "Greedy", difficulty: "medium" },
  { title: "Jump Game II", category: "Greedy", difficulty: "medium" },
  { title: "Gas Station", category: "Greedy", difficulty: "medium" },
  { title: "Hand of Straights", category: "Greedy", difficulty: "medium" },
  { title: "Merge Triplets to Form Target Triplet", category: "Greedy", difficulty: "medium" },
  { title: "Partition Labels", category: "Greedy", difficulty: "medium" },
  { title: "Valid Parenthesis String", category: "Greedy", difficulty: "medium" },
  { title: "Number of 1 Bits", category: "Bit Manipulation", difficulty: "easy" },
  { title: "Counting Bits", category: "Bit Manipulation", difficulty: "easy" },
  { title: "Reverse Bits", category: "Bit Manipulation", difficulty: "easy" },
  { title: "Missing Number", category: "Bit Manipulation", difficulty: "easy" },
  { title: "Sum of Two Integers", category: "Bit Manipulation", difficulty: "medium" }
];

const GFG_SEEDS: CodingSeed[] = [
  { title: "Rabin Karp Algorithm for Pattern Searching", category: "Strings", difficulty: "medium" },
  { title: "KMP Pattern Searching", category: "Strings", difficulty: "hard" },
  { title: "Reverse Words in a Given String", category: "Strings", difficulty: "easy" },
  { title: "Check for Palindrome String", category: "Strings", difficulty: "easy" },
  { title: "Detect Loop in Linked List", category: "Linked List", difficulty: "easy" },
  { title: "Intersection Point in Y Shaped Linked Lists", category: "Linked List", difficulty: "medium" },
  { title: "Nth Node from End of Linked List", category: "Linked List", difficulty: "easy" },
  { title: "BFS Traversal of Graph", category: "Graphs", difficulty: "easy" },
  { title: "DFS Traversal of Graph", category: "Graphs", difficulty: "easy" },
  { title: "Topological Sort", category: "Graphs", difficulty: "medium" },
  { title: "Dijkstra Algorithm", category: "Graphs", difficulty: "medium" },
  { title: "Disjoint Set Union", category: "Graphs", difficulty: "medium" },
  { title: "Minimum Spanning Tree", category: "Graphs", difficulty: "medium" },
  { title: "Kadane Algorithm", category: "Dynamic Programming", difficulty: "easy" },
  { title: "0-1 Knapsack", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Matrix Chain Multiplication", category: "Dynamic Programming", difficulty: "hard" },
  { title: "Longest Common Subsequence", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Longest Palindromic Subsequence", category: "Dynamic Programming", difficulty: "medium" },
  { title: "Allocate Minimum Number of Pages", category: "Binary Search", difficulty: "hard" },
  { title: "Aggressive Cows", category: "Binary Search", difficulty: "medium" },
  { title: "Chocolate Distribution Problem", category: "Greedy", difficulty: "easy" },
  { title: "Job Sequencing Problem", category: "Greedy", difficulty: "medium" },
  { title: "Fractional Knapsack", category: "Greedy", difficulty: "easy" },
  { title: "Merge Two Binary Max Heaps", category: "Heaps", difficulty: "medium" },
  { title: "Median in a Stream", category: "Heaps", difficulty: "hard" }
];

const CODING_NINJAS_SEEDS: CodingSeed[] = [
  { title: "Subset Sum Equal To K", category: "Dynamic Programming", difficulty: "medium" },
  { title: "First Missing Positive", category: "Arrays", difficulty: "hard" },
  { title: "Next Smaller Element", category: "Stack", difficulty: "medium" },
  { title: "Pair Sum in Array", category: "Two Pointers", difficulty: "easy" },
  { title: "Longest Path in a Tree", category: "Trees", difficulty: "hard" },
  { title: "LCA of Three Nodes", category: "Trees", difficulty: "hard" },
  { title: "Maximum Sum Subarray", category: "Dynamic Programming", difficulty: "easy" },
  { title: "Reverse the Array", category: "Arrays", difficulty: "easy" },
  { title: "Sort 0 1 2", category: "Arrays", difficulty: "easy" },
  { title: "Rotate Array by K", category: "Arrays", difficulty: "easy" },
  { title: "Majority Element", category: "Arrays", difficulty: "easy" },
  { title: "Count Inversions", category: "Divide and Conquer", difficulty: "hard" },
  { title: "Longest Subarray with Sum K", category: "Hashing", difficulty: "medium" },
  { title: "Maximum Meetings in One Room", category: "Greedy", difficulty: "easy" },
  { title: "N Meetings in One Room", category: "Greedy", difficulty: "easy" },
  { title: "Painters Partition", category: "Binary Search", difficulty: "hard" },
  { title: "Kth Largest in Stream", category: "Heaps", difficulty: "medium" },
  { title: "Sum of Infinite Array", category: "Prefix Sum", difficulty: "easy" },
  { title: "Implement Queue using Stacks", category: "Stack", difficulty: "easy" },
  { title: "Implement Stack using Queues", category: "Queue", difficulty: "easy" }
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildCodingRefs(
  source: CompiledCodingQuestionRef["source"],
  sourceCollectionUrl: string,
  seeds: CodingSeed[]
): CompiledCodingQuestionRef[] {
  return seeds.map((seed) => ({
    id: `${source}_${slugify(seed.title)}`,
    title: seed.title,
    category: seed.category,
    difficulty: seed.difficulty,
    source,
    sourceCollectionUrl
  }));
}

function dedupeCodingRefs(refs: CompiledCodingQuestionRef[]): CompiledCodingQuestionRef[] {
  const seen = new Set<string>();
  const deduped: CompiledCodingQuestionRef[] = [];

  refs.forEach((ref) => {
    const signature = slugify(ref.title);
    if (seen.has(signature)) {
      return;
    }

    seen.add(signature);
    deduped.push(ref);
  });

  return deduped;
}

const rawCodingRefs = [
  ...buildCodingRefs("leetcode", LEETCODE_SOURCE_URL, LEETCODE_SEEDS),
  ...buildCodingRefs("geeksforgeeks", GFG_SOURCE_URL, GFG_SEEDS),
  ...buildCodingRefs("codingninjas", CODING_NINJAS_SOURCE_URL, CODING_NINJAS_SEEDS)
];

export const compiledCodingQuestionRefs = dedupeCodingRefs(rawCodingRefs);

const INDIABIX_SOURCE_URL = "https://www.indiabix.com/aptitude/";
const LEARNTHETA_SOURCE_URL = "https://www.learntheta.com/maths-aptitude-questions-and-answers/";

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function buildDistinctOptions(primaryOption: string, distractors: string[]): [string, string, string, string] {
  const uniqueOptions: string[] = [];

  const pushOption = (value: string) => {
    const normalized = value.trim();
    if (!normalized || uniqueOptions.includes(normalized)) {
      return;
    }
    uniqueOptions.push(normalized);
  };

  pushOption(primaryOption);
  distractors.forEach((value) => pushOption(value));

  let fallbackIndex = 1;
  while (uniqueOptions.length < 4) {
    pushOption(`${primaryOption} (alt ${fallbackIndex})`);
    fallbackIndex += 1;
  }

  return [uniqueOptions[0], uniqueOptions[1], uniqueOptions[2], uniqueOptions[3]];
}

function rotateOptions(
  options: [string, string, string, string],
  correctIndex: number,
  rotateBy: number
): { correctOptionId: "a" | "b" | "c" | "d"; options: [string, string, string, string] } {
  const ids: Array<"a" | "b" | "c" | "d"> = ["a", "b", "c", "d"];
  const normalizedShift = ((rotateBy % 4) + 4) % 4;
  const rotated = options.map((_, index) => options[(index - normalizedShift + 4) % 4]) as [string, string, string, string];
  const newCorrect = (correctIndex + normalizedShift) % 4;

  return {
    options: rotated,
    correctOptionId: ids[newCorrect]
  };
}

function makeNumericQuestion(input: {
  baseId: string;
  category: string;
  difficulty: "easy" | "medium";
  distractors: number[];
  explanation: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  prompt: string;
  answer: number;
  index: number;
  source: "indiabix" | "learntheta";
  sourceCollectionUrl: string;
  suffix?: string;
}): CompiledAptitudeQuestionRef {
  const optionsRaw = [input.answer, ...input.distractors]
    .map((value) => `${formatNumber(value)}${input.suffix ?? ""}`)
    .slice(0, 4);

  const [primaryOption, ...distractorOptions] = optionsRaw;
  const safePrimaryOption = primaryOption ?? `${formatNumber(input.answer)}${input.suffix ?? ""}`;
  const normalizedOptions = buildDistinctOptions(safePrimaryOption, distractorOptions);

  const rotated = rotateOptions(normalizedOptions, 0, input.index % 4);

  const image = resolveAptitudeImage(input.category, input.index);

  return {
    id: `${input.baseId}_${String(input.index + 1).padStart(3, "0")}`,
    category: input.category,
    difficulty: input.difficulty,
    prompt: input.prompt,
    options: rotated.options,
    correctOptionId: rotated.correctOptionId,
    explanation: input.explanation,
    source: input.source,
    sourceCollectionUrl: input.sourceCollectionUrl,
    imageUrl: input.imageUrl ?? image.imageUrl,
    imageAlt: input.imageAlt ?? image.imageAlt,
    imageSourceUrl: input.imageSourceUrl
  };
}

function resolveAptitudeImage(category: string, index: number): { imageAlt: string; imageUrl: string } {
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory.includes("train")) {
    return {
      imageUrl: "/aptitude-media/trains.svg",
      imageAlt: "Train length and crossing-time visual aid"
    };
  }

  if (normalizedCategory.includes("probability")) {
    return {
      imageUrl: "/aptitude-media/probability-bag.svg",
      imageAlt: "Probability bag visual aid"
    };
  }

  if (normalizedCategory.includes("set")) {
    return {
      imageUrl: "/aptitude-media/venn.svg",
      imageAlt: "Set relation Venn-style visual aid"
    };
  }

  if (normalizedCategory.includes("speed") || normalizedCategory.includes("distance")) {
    return {
      imageUrl: "/aptitude-media/speed-distance.svg",
      imageAlt: "Speed-distance visual aid"
    };
  }

  if (normalizedCategory.includes("ratio")) {
    return {
      imageUrl: "/aptitude-media/ratio-bars.svg",
      imageAlt: "Ratio comparison bar visual aid"
    };
  }

  return {
    imageUrl: index % 2 === 0 ? "/aptitude-media/arithmetic-grid.svg" : "/aptitude-media/number-line.svg",
    imageAlt: `${category} supporting visual aid`
  };
}

function buildGeneratedAptitudeRefs(): CompiledAptitudeQuestionRef[] {
  const output: CompiledAptitudeQuestionRef[] = [];

  for (let index = 0; index < 18; index += 1) {
    const base = 200 + index * 40;
    const increase = 5 + (index % 6) * 5;
    const answer = increase;

    output.push(
      makeNumericQuestion({
        baseId: "apt_percent_change",
        index,
        category: "Percentages",
        difficulty: "easy",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `A value increases from ${base} to ${base + (base * increase) / 100}. What is the percentage increase?`,
        answer,
        distractors: [increase - 2, increase + 3, increase + 8],
        explanation: `Percentage increase = ((new - old) / old) * 100 = ${increase}.`,
        suffix: "%"
      })
    );
  }

  for (let index = 0; index < 14; index += 1) {
    const ratioA = 2 + (index % 5);
    const ratioB = 3 + (index % 4);
    const multiplier = 8 + index;
    const total = (ratioA + ratioB) * multiplier;
    const answer = ratioA * multiplier;

    output.push(
      makeNumericQuestion({
        baseId: "apt_ratio_find_part",
        index,
        category: "Ratio and Proportion",
        difficulty: "easy",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `The ratio of boys to girls is ${ratioA}:${ratioB}. If total students are ${total}, how many boys are there?`,
        answer,
        distractors: [answer - multiplier, answer + multiplier, total / 2],
        explanation: `Total parts = ${ratioA + ratioB}. Each part = ${multiplier}. Boys = ${ratioA} * ${multiplier} = ${answer}.`
      })
    );
  }

  for (let index = 0; index < 14; index += 1) {
    const first = 12 + index;
    const second = 18 + index;
    const third = 24 + index;
    const fourth = 30 + index;
    const answer = (first + second + third + fourth) / 4;

    output.push(
      makeNumericQuestion({
        baseId: "apt_average_four",
        index,
        category: "Averages",
        difficulty: "easy",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `Find the average of ${first}, ${second}, ${third}, and ${fourth}.`,
        answer,
        distractors: [answer - 1, answer + 1, answer + 2],
        explanation: `Average = (sum of values) / 4 = ${answer}.`
      })
    );
  }

  for (let index = 0; index < 14; index += 1) {
    const cp = 400 + index * 50;
    const margin = 10 + (index % 5) * 5;
    const sp = cp + (cp * margin) / 100;
    const answer = margin;

    output.push(
      makeNumericQuestion({
        baseId: "apt_profit_margin",
        index,
        category: "Profit and Loss",
        difficulty: "easy",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `An item with cost price ${cp} is sold for ${sp}. What is the profit percentage?`,
        answer,
        distractors: [margin - 2, margin + 3, margin + 6],
        explanation: `Profit% = ((SP - CP) / CP) * 100 = ${margin}.`,
        suffix: "%"
      })
    );
  }

  for (let index = 0; index < 12; index += 1) {
    const principal = 3000 + index * 500;
    const rate = 5 + (index % 5) * 2;
    const years = 2 + (index % 3);
    const answer = (principal * rate * years) / 100;

    output.push(
      makeNumericQuestion({
        baseId: "apt_simple_interest",
        index,
        category: "Simple Interest",
        difficulty: "easy",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `Find simple interest on ${principal} at ${rate}% per annum for ${years} years.`,
        answer,
        distractors: [answer - principal * 0.02, answer + principal * 0.01, answer + principal * 0.03],
        explanation: `SI = (P * R * T) / 100 = ${formatNumber(answer)}.`,
        suffix: ""
      })
    );
  }

  for (let index = 0; index < 12; index += 1) {
    const personA = 6 + (index % 5);
    const personB = 8 + (index % 6);
    const answer = (personA * personB) / (personA + personB);

    output.push(
      makeNumericQuestion({
        baseId: "apt_time_work_together",
        index,
        category: "Time and Work",
        difficulty: "medium",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `A can finish a job in ${personA} days and B can finish in ${personB} days. In how many days can they finish together?`,
        answer,
        distractors: [answer + 1, answer + 2, answer - 1],
        explanation: `Combined rate = 1/${personA} + 1/${personB}. Time = 1 / combined rate = ${formatNumber(answer)} days.`,
        suffix: " days"
      })
    );
  }

  for (let index = 0; index < 14; index += 1) {
    const distance = 120 + index * 15;
    const timeHours = 2 + (index % 4);
    const answer = distance / timeHours;

    output.push(
      makeNumericQuestion({
        baseId: "apt_speed_distance",
        index,
        category: "Speed and Time",
        difficulty: "easy",
        source: "indiabix",
        sourceCollectionUrl: INDIABIX_SOURCE_URL,
        prompt: `A vehicle covers ${distance} km in ${timeHours} hours. What is its speed?`,
        answer,
        distractors: [answer - 5, answer + 7, answer + 12],
        explanation: `Speed = Distance / Time = ${distance} / ${timeHours} = ${formatNumber(answer)} km/h.`,
        suffix: " km/h"
      })
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const trainLength = 120 + index * 20;
    const poleTime = 8 + (index % 4);
    const answer = trainLength / poleTime;

    output.push(
      makeNumericQuestion({
        baseId: "apt_trains",
        index,
        category: "Problems on Trains",
        difficulty: "medium",
        source: "indiabix",
        sourceCollectionUrl: "https://www.indiabix.com/aptitude/problems-on-trains/",
        prompt: `A train of length ${trainLength} m crosses a pole in ${poleTime} seconds. What is the train speed?`,
        answer,
        distractors: [answer - 2, answer + 3, answer + 5],
        explanation: `Speed = length / time = ${trainLength}/${poleTime} = ${formatNumber(answer)} m/s.`,
        suffix: " m/s"
      })
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const totalBalls = 10 + index;
    const redBalls = 3 + (index % 4);
    const answer = redBalls / totalBalls;

    output.push(
      makeNumericQuestion({
        baseId: "apt_probability",
        index,
        category: "Probability",
        difficulty: "easy",
        source: "learntheta",
        sourceCollectionUrl: LEARNTHETA_SOURCE_URL,
        prompt: `A bag has ${redBalls} red balls and ${totalBalls - redBalls} blue balls. What is the probability of drawing a red ball?`,
        answer,
        distractors: [
          (redBalls + 1) / totalBalls,
          redBalls / (totalBalls + 1),
          (totalBalls - redBalls) / totalBalls
        ],
        explanation: `Probability = favorable / total = ${redBalls}/${totalBalls} = ${formatNumber(answer)}.`
      })
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const n = 6 + index;
    const r = 2 + (index % 3);

    let numerator = 1;
    let denominator = 1;
    for (let value = 0; value < r; value += 1) {
      numerator *= n - value;
      denominator *= value + 1;
    }
    const answer = numerator / denominator;

    output.push(
      makeNumericQuestion({
        baseId: "apt_combination",
        index,
        category: "Permutations and Combinations",
        difficulty: "medium",
        source: "learntheta",
        sourceCollectionUrl: LEARNTHETA_SOURCE_URL,
        prompt: `How many ways can ${r} members be selected from ${n} people?`,
        answer,
        distractors: [answer - (index % 4 + 1), answer + (index % 5 + 2), answer + (index % 6 + 4)],
        explanation: `Combination count is nCr. Here ${n}C${r} = ${formatNumber(answer)}.`
      })
    );
  }

  return output;
}

export const compiledAptitudeQuestionRefs = buildGeneratedAptitudeRefs();
