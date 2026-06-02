import {
  compiledAptitudeQuestionRefs,
  compiledCodingQuestionRefs
} from "@/lib/interview/compiled-question-sets";
import {
  externalAiQuestions,
  externalAiRoles,
  hasExternalAiRoleBank,
  type ExternalAiRoleDefinition
} from "@/lib/interview/ai-role-bank";
import {
  externalComputerScienceQuestions,
  externalComputerScienceTests,
  hasExternalComputerScienceBank
} from "@/lib/interview/computer-science-bank";

export type InterviewTestType = "coding" | "aptitude" | "computer-science" | "ai";

export type InterviewQuestionDifficulty = "easy" | "medium" | "hard";

export type InterviewQuestionKind = "mcq" | "coding";

export type PracticeAttemptMode = "mcq" | "coding";

export type PracticeAttemptStatus = "ready" | "in_progress" | "submitted" | "timed_out";

export type McqOptionId = "a" | "b" | "c" | "d";

export type McqOption = {
  id: McqOptionId;
  text: string;
};

export type BaseQuestion = {
  category: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  kind: InterviewQuestionKind;
  prompt: string;
};

export type McqQuestion = BaseQuestion & {
  correctOptionId: McqOptionId;
  difficulty?: InterviewQuestionDifficulty;
  explanation: string;
  kind: "mcq";
  options: McqOption[];
};

export type CodingQuestion = BaseQuestion & {
  constraints: string[];
  difficulty: InterviewQuestionDifficulty;
  hints: string[];
  inputFormat: string;
  kind: "coding";
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
};

export type PracticeMcqQuestion = Omit<McqQuestion, "correctOptionId" | "explanation">;

export type PracticeQuestion = PracticeMcqQuestion | CodingQuestion;

export type InterviewTrackDefinition = {
  description: string;
  durationMinutes: number;
  id: InterviewTestType;
  mode: PracticeAttemptMode;
  questionCount: number;
  subtitle: string;
  title: string;
};

export type InterviewTestTemplate = {
  categoryFocus: string[];
  durationMinutes: number;
  id: string;
  index: number;
  mode: PracticeAttemptMode;
  questionCount: number;
  roleId?: string;
  roleName?: string;
  subtitle: string;
  summary: string;
  testType: InterviewTestType;
  title: string;
};

export type AiInterviewRole = ExternalAiRoleDefinition;

export type PracticeAttemptSeed = {
  answerKeyVersion: string;
  categories: string[];
  questions: PracticeQuestion[];
  template?: InterviewTestTemplate;
  track: InterviewTrackDefinition;
};

export type PracticeScore = {
  answered: number;
  correct: number;
  percentage: number;
  total: number;
};

const QUESTION_BANK_VERSION = "2026.06.war-room.v2";

function createMcqQuestion(input: {
  category: string;
  correctOptionId: McqOptionId;
  difficulty?: InterviewQuestionDifficulty;
  explanation: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  options: [string, string, string, string];
  prompt: string;
}): McqQuestion {
  return {
    id: input.id,
    kind: "mcq",
    category: input.category,
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    imageSourceUrl: input.imageSourceUrl,
    options: [
      { id: "a", text: input.options[0] },
      { id: "b", text: input.options[1] },
      { id: "c", text: input.options[2] },
      { id: "d", text: input.options[3] }
    ],
    correctOptionId: input.correctOptionId,
    explanation: input.explanation,
    difficulty: input.difficulty
  };
}

const BASE_CODING_QUESTION_BANK: CodingQuestion[] = [
  {
    id: "code_easy_array_sum",
    kind: "coding",
    category: "Arrays",
    difficulty: "easy",
    prompt:
      "Given an integer array, return the sum of all even numbers present in the array. If no even numbers exist, return 0.",
    inputFormat: "First line: integer n. Second line: n space-separated integers.",
    outputFormat: "Single integer representing the sum of all even values.",
    constraints: ["1 <= n <= 10^5", "-10^9 <= arr[i] <= 10^9"],
    sampleInput: "6\n1 2 3 4 9 10",
    sampleOutput: "16",
    hints: ["Traverse once and add only values where value % 2 === 0."]
  },
  {
    id: "code_easy_valid_palindrome",
    kind: "coding",
    category: "Strings",
    difficulty: "easy",
    prompt:
      "Given a string, determine whether it is a palindrome after removing non-alphanumeric characters and ignoring letter case.",
    inputFormat: "Single string s.",
    outputFormat: "Return true if palindrome, else false.",
    constraints: ["1 <= s.length <= 2 * 10^5"],
    sampleInput: "A man, a plan, a canal: Panama",
    sampleOutput: "true",
    hints: ["Two-pointer scan from left and right after normalizing checks."]
  },
  {
    id: "code_easy_sorted_two_sum",
    kind: "coding",
    category: "Two Pointers",
    difficulty: "easy",
    prompt:
      "Given a 1-indexed sorted integer array and a target, return indices of the two numbers that add up to target. Exactly one solution exists.",
    inputFormat: "First line: n and target. Second line: n sorted integers.",
    outputFormat: "Two space-separated 1-indexed positions i j.",
    constraints: ["2 <= n <= 10^5", "-10^9 <= numbers[i], target <= 10^9"],
    sampleInput: "4 9\n2 3 4 5",
    sampleOutput: "2 4",
    hints: ["Use left and right pointers and move based on current sum."]
  },
  {
    id: "code_medium_longest_substring",
    kind: "coding",
    category: "Sliding Window",
    difficulty: "medium",
    prompt:
      "Given a string s, return the length of the longest substring without repeating characters.",
    inputFormat: "Single string s.",
    outputFormat: "Single integer representing the max length.",
    constraints: ["0 <= s.length <= 10^5"],
    sampleInput: "pwwkew",
    sampleOutput: "3",
    hints: ["Track last seen positions and adjust the left window boundary quickly."]
  },
  {
    id: "code_medium_merge_intervals",
    kind: "coding",
    category: "Intervals",
    difficulty: "medium",
    prompt:
      "Given a list of intervals where intervals[i] = [start, end], merge all overlapping intervals and return non-overlapping intervals covering all input intervals.",
    inputFormat: "First line: integer n. Next n lines: start end.",
    outputFormat: "Merged intervals in sorted order by start.",
    constraints: ["1 <= n <= 10^5", "0 <= start <= end <= 10^9"],
    sampleInput: "4\n1 3\n2 6\n8 10\n15 18",
    sampleOutput: "1 6\n8 10\n15 18",
    hints: ["Sort by start time first, then merge greedily."]
  },
  {
    id: "code_medium_kth_largest",
    kind: "coding",
    category: "Heaps",
    difficulty: "medium",
    prompt: "Return the kth largest element in an unsorted array.",
    inputFormat: "First line: n and k. Second line: n integers.",
    outputFormat: "Single integer representing kth largest value.",
    constraints: ["1 <= k <= n <= 2 * 10^5"],
    sampleInput: "6 2\n3 2 1 5 6 4",
    sampleOutput: "5",
    hints: ["Maintain a min heap of size k or use quickselect."]
  },
  {
    id: "code_hard_lru_cache",
    kind: "coding",
    category: "Design",
    difficulty: "hard",
    prompt:
      "Design an LRU (Least Recently Used) cache supporting get(key) and put(key, value) in O(1) average time.",
    inputFormat:
      "Sequence of operations get/put with keys and values. Capacity is provided in the first line.",
    outputFormat: "For each get operation output the returned value.",
    constraints: ["1 <= capacity <= 10^5", "Up to 2 * 10^5 operations"],
    sampleInput: "2\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2",
    sampleOutput: "1\n-1",
    hints: ["Use hashmap + doubly linked list for O(1) access and eviction."]
  },
  {
    id: "code_hard_min_window_substring",
    kind: "coding",
    category: "Sliding Window",
    difficulty: "hard",
    prompt:
      "Given strings s and t, return the minimum window substring of s that contains every character of t (including multiplicity).",
    inputFormat: "Two lines: s and t.",
    outputFormat: "Smallest valid substring or empty string if none exists.",
    constraints: ["1 <= s.length, t.length <= 10^5"],
    sampleInput: "ADOBECODEBANC\nABC",
    sampleOutput: "BANC",
    hints: ["Track required counts and formed counts while expanding and shrinking window."]
  },
  {
    id: "code_hard_word_ladder",
    kind: "coding",
    category: "Graphs",
    difficulty: "hard",
    prompt:
      "Given beginWord, endWord and a dictionary, return the length of shortest transformation sequence such that only one letter changes each step and every intermediate word is in dictionary.",
    inputFormat: "beginWord, endWord, then list size n and n dictionary words.",
    outputFormat: "Single integer shortest path length, or 0 if impossible.",
    constraints: ["1 <= word length <= 10", "1 <= dictionary size <= 5000"],
    sampleInput: "hit\ncog\n6\nhot\ndot\ndog\nlot\nlog\ncog",
    sampleOutput: "5",
    hints: ["Model as shortest path in implicit graph and solve with BFS."]
  }
];

const BASE_APTITUDE_QUESTION_BANK: McqQuestion[] = [
  createMcqQuestion({
    id: "apt_001",
    category: "Percentages",
    prompt: "A salary is increased by 20% and then decreased by 10%. What is the net percentage change?",
    options: ["8% increase", "8% decrease", "10% increase", "No change"],
    correctOptionId: "a",
    explanation: "1.2 x 0.9 = 1.08, so net increase is 8%."
  }),
  createMcqQuestion({
    id: "apt_002",
    category: "Percentages",
    prompt: "If x is 25% of y, then y is what percent of x?",
    options: ["200%", "300%", "400%", "500%"],
    correctOptionId: "c",
    explanation: "x = 0.25y => y = 4x = 400% of x."
  }),
  createMcqQuestion({
    id: "apt_003",
    category: "Ratio and Proportion",
    prompt: "The ratio of boys to girls in a class is 7:5. If there are 48 students total, how many boys are there?",
    options: ["28", "30", "26", "32"],
    correctOptionId: "a",
    explanation: "Total parts = 12, each part = 4, boys = 7 x 4 = 28."
  }),
  createMcqQuestion({
    id: "apt_004",
    category: "Ratio and Proportion",
    prompt: "If a:b = 3:4 and b:c = 5:6, then a:c is",
    options: ["5:8", "15:24", "9:10", "3:8"],
    correctOptionId: "a",
    explanation: "a:b = 15:20 and b:c = 20:24, so a:c = 15:24 = 5:8."
  }),
  createMcqQuestion({
    id: "apt_005",
    category: "Averages",
    prompt: "Average of 5 numbers is 24. If one number is removed, average becomes 20. Removed number is",
    options: ["36", "40", "44", "48"],
    correctOptionId: "b",
    explanation: "Sum of 5 = 120, sum of remaining 4 = 80, removed = 40."
  }),
  createMcqQuestion({
    id: "apt_006",
    category: "Averages",
    prompt: "Average of first 10 natural numbers is",
    options: ["5", "5.5", "6", "4.5"],
    correctOptionId: "b",
    explanation: "(1 + 10)/2 = 5.5."
  }),
  createMcqQuestion({
    id: "apt_007",
    category: "Profit and Loss",
    prompt: "An item is sold for 960 at a loss of 20%. What is its cost price?",
    options: ["1000", "1100", "1200", "1250"],
    correctOptionId: "c",
    explanation: "SP = 80% of CP => CP = 960 / 0.8 = 1200."
  }),
  createMcqQuestion({
    id: "apt_008",
    category: "Profit and Loss",
    prompt: "A trader marks goods 25% above cost and gives 10% discount. Profit percentage is",
    options: ["12.5%", "11.5%", "10%", "15%"],
    correctOptionId: "a",
    explanation: "1.25 x 0.9 = 1.125, so profit = 12.5%."
  }),
  createMcqQuestion({
    id: "apt_009",
    category: "Simple Interest",
    prompt: "Simple interest on 5000 at 8% per annum for 3 years is",
    options: ["1000", "1200", "1500", "1800"],
    correctOptionId: "b",
    explanation: "SI = PRT/100 = 5000 x 8 x 3 / 100 = 1200."
  }),
  createMcqQuestion({
    id: "apt_010",
    category: "Simple Interest",
    prompt: "At what annual rate will 4000 amount to 5200 in 3 years under simple interest?",
    options: ["8%", "9%", "10%", "12%"],
    correctOptionId: "c",
    explanation: "Interest = 1200. Rate = (1200 x 100)/(4000 x 3) = 10%."
  }),
  createMcqQuestion({
    id: "apt_011",
    category: "Compound Interest",
    prompt: "Compound interest on 10000 at 10% per annum for 2 years is",
    options: ["2000", "2100", "2200", "2400"],
    correctOptionId: "b",
    explanation: "Amount = 10000 x 1.1 x 1.1 = 12100, CI = 2100."
  }),
  createMcqQuestion({
    id: "apt_012",
    category: "Time and Work",
    prompt: "A can do a job in 12 days and B in 18 days. Working together they finish in",
    options: ["7.2 days", "6 days", "8 days", "9 days"],
    correctOptionId: "a",
    explanation: "Combined rate = 1/12 + 1/18 = 5/36. Time = 36/5 = 7.2 days."
  }),
  createMcqQuestion({
    id: "apt_013",
    category: "Time and Work",
    prompt: "If 8 workers complete a task in 15 days, how many workers are needed to finish it in 10 days?",
    options: ["10", "12", "14", "16"],
    correctOptionId: "b",
    explanation: "Workers x days constant => 8 x 15 = 120 worker-days. 120/10 = 12 workers."
  }),
  createMcqQuestion({
    id: "apt_014",
    category: "Speed and Time",
    prompt: "A car travels 150 km in 3 hours. Its speed is",
    options: ["40 km/h", "45 km/h", "50 km/h", "60 km/h"],
    correctOptionId: "c",
    explanation: "Speed = distance/time = 150/3 = 50 km/h."
  }),
  createMcqQuestion({
    id: "apt_015",
    category: "Speed and Time",
    prompt: "A train 180 m long passes a pole in 9 seconds. Speed is",
    options: ["18 m/s", "20 m/s", "22 m/s", "24 m/s"],
    correctOptionId: "b",
    explanation: "Speed = 180/9 = 20 m/s."
  }),
  createMcqQuestion({
    id: "apt_016",
    category: "Boats and Streams",
    prompt: "Boat speed in still water is 12 km/h and stream speed is 3 km/h. Downstream speed is",
    options: ["9 km/h", "12 km/h", "15 km/h", "18 km/h"],
    correctOptionId: "c",
    explanation: "Downstream = 12 + 3 = 15 km/h."
  }),
  createMcqQuestion({
    id: "apt_017",
    category: "Boats and Streams",
    prompt: "Boat speed downstream is 14 km/h and upstream is 8 km/h. Speed in still water is",
    options: ["10 km/h", "11 km/h", "12 km/h", "13 km/h"],
    correctOptionId: "b",
    explanation: "Still speed = (14 + 8)/2 = 11 km/h."
  }),
  createMcqQuestion({
    id: "apt_018",
    category: "Mixtures",
    prompt: "A solution has milk and water in ratio 3:2. If 10 liters of water are added, ratio becomes 3:4. Original quantity of solution is",
    options: ["40 L", "50 L", "60 L", "70 L"],
    correctOptionId: "b",
    explanation: "Let original total = 5x. Milk=3x, water=2x. (3x)/(2x+10)=3/4 => x=10 => total=50L."
  }),
  createMcqQuestion({
    id: "apt_019",
    category: "Mixtures",
    prompt: "A 20 L mixture contains 30% alcohol. How much pure alcohol must be added to make it 40%?",
    options: ["2 L", "3 L", "4 L", "5 L"],
    correctOptionId: "c",
    explanation: "Alcohol initially = 6. Let add x. (6+x)/(20+x)=0.4 => x=4."
  }),
  createMcqQuestion({
    id: "apt_020",
    category: "Probability",
    prompt: "A fair coin is tossed twice. Probability of getting exactly one head is",
    options: ["1/4", "1/2", "3/4", "2/3"],
    correctOptionId: "b",
    explanation: "Outcomes: HH, HT, TH, TT. Exactly one head in HT and TH => 2/4 = 1/2."
  }),
  createMcqQuestion({
    id: "apt_021",
    category: "Probability",
    prompt: "A die is rolled once. Probability of getting a number greater than 4 is",
    options: ["1/6", "1/3", "1/2", "2/3"],
    correctOptionId: "b",
    explanation: "Favorable outcomes: 5, 6 => 2/6 = 1/3."
  }),
  createMcqQuestion({
    id: "apt_022",
    category: "Permutation and Combination",
    prompt: "Number of ways to arrange 5 distinct books on a shelf is",
    options: ["25", "60", "100", "120"],
    correctOptionId: "d",
    explanation: "5! = 120."
  }),
  createMcqQuestion({
    id: "apt_023",
    category: "Permutation and Combination",
    prompt: "How many 3-member committees can be formed from 8 people?",
    options: ["24", "48", "56", "64"],
    correctOptionId: "c",
    explanation: "8C3 = 56."
  }),
  createMcqQuestion({
    id: "apt_024",
    category: "Number System",
    prompt: "The smallest number divisible by 12, 15 and 20 is",
    options: ["40", "50", "60", "120"],
    correctOptionId: "c",
    explanation: "LCM(12, 15, 20) = 60."
  }),
  createMcqQuestion({
    id: "apt_025",
    category: "Number System",
    prompt: "Remainder when 2^10 is divided by 7 is",
    options: ["1", "2", "3", "4"],
    correctOptionId: "b",
    explanation: "2^3 = 8 is congruent to 1 (mod 7). 2^9 is congruent to 1, so 2^10 is congruent to 2."
  }),
  createMcqQuestion({
    id: "apt_026",
    category: "Algebra",
    prompt: "If x + 1/x = 5, then x^2 + 1/x^2 equals",
    options: ["21", "23", "25", "27"],
    correctOptionId: "b",
    explanation: "(x + 1/x)^2 = x^2 + 1/x^2 + 2 => 25 = value + 2 => 23."
  }),
  createMcqQuestion({
    id: "apt_027",
    category: "Algebra",
    prompt: "Solve for x: 3x - 7 = 2x + 5",
    options: ["10", "11", "12", "13"],
    correctOptionId: "c",
    explanation: "x = 12."
  }),
  createMcqQuestion({
    id: "apt_028",
    category: "Data Interpretation",
    prompt: "A company had revenues 50, 60, 70, 90 in four years. Average yearly revenue is",
    options: ["65", "67.5", "70", "72.5"],
    correctOptionId: "b",
    explanation: "Total 270 over 4 years = 67.5."
  }),
  createMcqQuestion({
    id: "apt_029",
    category: "Data Interpretation",
    prompt: "If sales increase from 200 to 260 units, percentage increase is",
    options: ["20%", "25%", "30%", "35%"],
    correctOptionId: "c",
    explanation: "Increase = 60. 60/200 = 30%."
  }),
  createMcqQuestion({
    id: "apt_030",
    category: "Clock",
    prompt: "At what time between 3 and 4 o'clock are the clock hands together?",
    options: ["3:16 4/11", "3:15", "3:18", "3:20"],
    correctOptionId: "a",
    explanation: "Standard formula gives 16 4/11 minutes past 3."
  }),
  createMcqQuestion({
    id: "apt_031",
    category: "Calendar",
    prompt: "A non-leap year has how many odd days?",
    options: ["0", "1", "2", "3"],
    correctOptionId: "b",
    explanation: "365 = 52 weeks + 1 day => 1 odd day."
  }),
  createMcqQuestion({
    id: "apt_032",
    category: "Partnership",
    prompt: "A invests 6000 for 6 months, B invests 4000 for 12 months. Profit ratio A:B is",
    options: ["3:4", "4:3", "9:8", "8:9"],
    correctOptionId: "a",
    explanation: "A share = 6000x6=36000, B share=4000x12=48000 => 3:4."
  }),
  createMcqQuestion({
    id: "apt_033",
    category: "Time and Distance",
    prompt: "A person walks at 5 km/h and is 30 minutes late. At 6 km/h, he is 10 minutes early. Distance is",
    options: ["10 km", "12 km", "15 km", "20 km"],
    correctOptionId: "d",
    explanation: "Time difference is 40 min = 2/3 hour. D(1/5 - 1/6) = D/30 = 2/3, so D = 20 km."
  }),
  createMcqQuestion({
    id: "apt_034",
    category: "Pipes and Cisterns",
    prompt: "Pipe A fills a tank in 6 hours and Pipe B in 12 hours. Together, they fill in",
    options: ["3 hours", "4 hours", "4.5 hours", "5 hours"],
    correctOptionId: "b",
    explanation: "Rate = 1/6 + 1/12 = 1/4 tank per hour => 4 hours."
  }),
  createMcqQuestion({
    id: "apt_035",
    category: "Probability",
    prompt: "From a deck of 52 cards, probability of drawing a king or a queen is",
    options: ["1/13", "2/13", "1/26", "4/13"],
    correctOptionId: "b",
    explanation: "4 kings + 4 queens = 8 favorable => 8/52 = 2/13."
  }),
  createMcqQuestion({
    id: "apt_036",
    category: "Geometry",
    prompt: "Area of a triangle with base 10 and height 8 is",
    options: ["20", "30", "40", "80"],
    correctOptionId: "c",
    explanation: "Area = 1/2 x 10 x 8 = 40."
  }),
  createMcqQuestion({
    id: "apt_037",
    category: "Geometry",
    prompt: "Circumference of a circle with radius 7 is (use pi = 22/7)",
    options: ["22", "44", "66", "77"],
    correctOptionId: "b",
    explanation: "2pi r = 2 x 22/7 x 7 = 44."
  }),
  createMcqQuestion({
    id: "apt_038",
    category: "Number Series",
    prompt: "Find next number: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "46"],
    correctOptionId: "b",
    explanation: "Pattern n(n+1): 1x2,2x3,3x4... next 6x7 = 42."
  }),
  createMcqQuestion({
    id: "apt_039",
    category: "Number Series",
    prompt: "Find next number: 3, 9, 27, 81, ?",
    options: ["162", "243", "324", "729"],
    correctOptionId: "b",
    explanation: "Multiply by 3 each step."
  }),
  createMcqQuestion({
    id: "apt_040",
    category: "Inequalities",
    prompt: "If x > y and y > z, which is always true?",
    options: ["x < z", "x = z", "x > z", "z > y"],
    correctOptionId: "c",
    explanation: "Transitive relation for greater-than."
  }),
  createMcqQuestion({
    id: "apt_041",
    category: "Percentages",
    prompt: "Population of a town decreases by 20% and then increases by 25%. Net effect is",
    options: ["0%", "5% increase", "5% decrease", "10% decrease"],
    correctOptionId: "a",
    explanation: "0.8 x 1.25 = 1.0, so no net change."
  }),
  createMcqQuestion({
    id: "apt_042",
    category: "Speed and Time",
    prompt: "Average speed for equal distances at 40 km/h and 60 km/h is",
    options: ["48 km/h", "50 km/h", "52 km/h", "55 km/h"],
    correctOptionId: "a",
    explanation: "Harmonic mean = 2ab/(a+b) = 2x40x60/100 = 48."
  }),
  createMcqQuestion({
    id: "apt_043",
    category: "Age",
    prompt: "Father is 3 times son's age. After 10 years, he will be 2 times son's age. Present son's age is",
    options: ["8", "10", "12", "15"],
    correctOptionId: "b",
    explanation: "Let son = x, father = 3x. 3x+10 = 2(x+10) => x=10."
  }),
  createMcqQuestion({
    id: "apt_044",
    category: "HCF and LCM",
    prompt: "HCF of 48 and 180 is",
    options: ["6", "8", "10", "12"],
    correctOptionId: "d",
    explanation: "Prime factors give common product 2^2 x 3 = 12."
  }),
  createMcqQuestion({
    id: "apt_045",
    category: "Set Theory",
    prompt: "In a class, 30 like Math, 25 like Science and 10 like both. Number who like at least one is",
    options: ["45", "55", "65", "35"],
    correctOptionId: "a",
    explanation: "|M union S| = |M| + |S| - |M and S| = 30 + 25 - 10 = 45."
  }),
  createMcqQuestion({
    id: "apt_046",
    category: "Linear Equations",
    prompt: "Solve: 2x + 3y = 18 and x - y = 3. Value of x is",
    options: ["3", "4", "5", "6"],
    correctOptionId: "c",
    explanation: "x = y + 3. Substitute => 2(y+3)+3y=18 => y=2, x=5."
  }),
  createMcqQuestion({
    id: "apt_047",
    category: "Quadratic Equations",
    prompt: "If roots of x^2 - 5x + 6 = 0 are a and b, then a+b is",
    options: ["3", "5", "6", "11"],
    correctOptionId: "b",
    explanation: "For x^2 - sx + p = 0, sum of roots = s = 5."
  }),
  createMcqQuestion({
    id: "apt_048",
    category: "Data Sufficiency",
    prompt: "Statement: Is n divisible by 6? (1) n divisible by 2. (2) n divisible by 3.",
    options: [
      "Only statement 1 sufficient",
      "Only statement 2 sufficient",
      "Both together sufficient",
      "Either one alone sufficient"
    ],
    correctOptionId: "c",
    explanation: "Divisibility by 6 needs both 2 and 3."
  }),
  createMcqQuestion({
    id: "apt_049",
    category: "Logarithms",
    prompt: "log10(1000) equals",
    options: ["2", "3", "10", "100"],
    correctOptionId: "b",
    explanation: "10^3 = 1000, so log10(1000) = 3."
  }),
  createMcqQuestion({
    id: "apt_050",
    category: "Progressions",
    prompt: "Sum of first 10 natural numbers is",
    options: ["45", "50", "55", "60"],
    correctOptionId: "c",
    explanation: "n(n+1)/2 = 10x11/2 = 55."
  })
];

function mapCompiledCodingRefToQuestion(ref: (typeof compiledCodingQuestionRefs)[number]): CodingQuestion {
  return {
    id: ref.id,
    kind: "coding",
    category: ref.category,
    difficulty: ref.difficulty,
    prompt:
      `Solve the interview problem: "${ref.title}". ` +
      `Use an optimized approach and be ready to explain complexity tradeoffs.`,
    inputFormat:
      "Follow standard interview input conventions based on the original problem statement.",
    outputFormat:
      "Return or print the expected output exactly as required by the source problem statement.",
    constraints: [
      "Respect source constraints and edge cases.",
      "Aim for optimal time and space complexity for this pattern."
    ],
    sampleInput: "Refer source statement for canonical sample input.",
    sampleOutput: "Refer source statement for canonical sample output.",
    hints: [
      `Pattern focus: ${ref.category}.`,
      `Original source: ${ref.source} (${ref.sourceCollectionUrl}).`
    ]
  };
}

function mapCompiledAptitudeRefToQuestion(ref: (typeof compiledAptitudeQuestionRefs)[number]): McqQuestion {
  return createMcqQuestion({
    id: ref.id,
    category: ref.category,
    difficulty: ref.difficulty,
    prompt: ref.prompt,
    imageUrl: ref.imageUrl,
    imageAlt: ref.imageAlt,
    imageSourceUrl: ref.imageSourceUrl,
    options: ref.options,
    correctOptionId: ref.correctOptionId,
    explanation: `${ref.explanation} Source reference: ${ref.sourceCollectionUrl}`
  });
}

const CODING_QUESTION_BANK: CodingQuestion[] = [
  ...BASE_CODING_QUESTION_BANK,
  ...compiledCodingQuestionRefs.map((ref) => mapCompiledCodingRefToQuestion(ref))
];

const APTITUDE_QUESTION_BANK: McqQuestion[] = [
  ...BASE_APTITUDE_QUESTION_BANK,
  ...compiledAptitudeQuestionRefs.map((ref) => mapCompiledAptitudeRefToQuestion(ref))
];

const LEGACY_CS_QUESTION_BANK: McqQuestion[] = [
  createMcqQuestion({
    id: "cs_001",
    category: "Operating Systems",
    prompt: "Which scheduler picks the process that has the smallest next CPU burst time?",
    options: ["Round Robin", "First Come First Serve", "Shortest Job First", "Priority Scheduling"],
    correctOptionId: "c",
    explanation: "SJF minimizes average waiting time by choosing shortest next burst."
  }),
  createMcqQuestion({
    id: "cs_002",
    category: "Operating Systems",
    prompt: "A deadlock can occur only if which condition set holds simultaneously?",
    options: ["Mutual exclusion only", "Hold and wait only", "All Coffman conditions", "No preemption only"],
    correctOptionId: "c",
    explanation: "Deadlock requires all four Coffman conditions."
  }),
  createMcqQuestion({
    id: "cs_003",
    category: "Operating Systems",
    prompt: "Thrashing in OS is primarily caused by",
    options: ["Excessive context switching", "Too many page faults", "CPU overheating", "Disk fragmentation"],
    correctOptionId: "b",
    explanation: "Thrashing means system spends most time paging due to high page fault rate."
  }),
  createMcqQuestion({
    id: "cs_004",
    category: "DBMS",
    prompt: "Which normal form removes transitive dependency?",
    options: ["1NF", "2NF", "3NF", "BCNF"],
    correctOptionId: "c",
    explanation: "3NF removes transitive dependencies of non-key attributes."
  }),
  createMcqQuestion({
    id: "cs_005",
    category: "DBMS",
    prompt: "ACID property that ensures completed transactions persist after crash is",
    options: ["Atomicity", "Consistency", "Isolation", "Durability"],
    correctOptionId: "d",
    explanation: "Durability guarantees permanence of committed data."
  }),
  createMcqQuestion({
    id: "cs_006",
    category: "DBMS",
    prompt: "A clustered index in a relational table determines",
    options: ["Physical row order", "Number of rows", "Foreign keys", "Query cache size"],
    correctOptionId: "a",
    explanation: "Clustered index defines physical ordering of rows on disk."
  }),
  createMcqQuestion({
    id: "cs_007",
    category: "Computer Networks",
    prompt: "TCP uses which mechanism for reliable ordered delivery?",
    options: ["CSMA/CD", "Sliding window with ACKs", "Flooding", "Token passing"],
    correctOptionId: "b",
    explanation: "TCP ensures reliability via sequence numbers, ACKs, retransmits and windows."
  }),
  createMcqQuestion({
    id: "cs_008",
    category: "Computer Networks",
    prompt: "Which protocol translates a domain name into an IP address?",
    options: ["ARP", "HTTP", "DNS", "DHCP"],
    correctOptionId: "c",
    explanation: "DNS resolves hostnames to IP addresses."
  }),
  createMcqQuestion({
    id: "cs_009",
    category: "Computer Networks",
    prompt: "CIDR notation /24 means subnet mask",
    options: ["255.255.0.0", "255.255.255.0", "255.255.255.255", "255.0.0.0"],
    correctOptionId: "b",
    explanation: "24 leading ones -> 255.255.255.0."
  }),
  createMcqQuestion({
    id: "cs_010",
    category: "Data Structures",
    prompt: "Average time complexity of search in a balanced BST is",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctOptionId: "b",
    explanation: "Balanced BST height is O(log n), so search is O(log n)."
  }),
  createMcqQuestion({
    id: "cs_011",
    category: "Data Structures",
    prompt: "Which data structure is used for BFS traversal?",
    options: ["Stack", "Queue", "Heap", "Hash map"],
    correctOptionId: "b",
    explanation: "BFS explores level by level using queue."
  }),
  createMcqQuestion({
    id: "cs_012",
    category: "Data Structures",
    prompt: "In a max heap, the largest element is always at",
    options: ["Leaf node", "Root", "Middle level", "Any position"],
    correctOptionId: "b",
    explanation: "Heap property keeps max key at root in max heap."
  }),
  createMcqQuestion({
    id: "cs_013",
    category: "Algorithms",
    prompt: "Average time complexity of quicksort is",
    options: ["O(n)", "O(n log n)", "O(log n)", "O(n^2)"],
    correctOptionId: "b",
    explanation: "Average partitioning leads to O(n log n)."
  }),
  createMcqQuestion({
    id: "cs_014",
    category: "Algorithms",
    prompt: "Dijkstra's algorithm fails with",
    options: ["Dense graphs", "Sparse graphs", "Negative edge weights", "Directed graphs"],
    correctOptionId: "c",
    explanation: "Dijkstra assumes non-negative edge weights."
  }),
  createMcqQuestion({
    id: "cs_015",
    category: "Algorithms",
    prompt: "KMP algorithm is used for",
    options: ["Sorting", "String pattern matching", "Graph coloring", "Matrix multiplication"],
    correctOptionId: "b",
    explanation: "KMP finds pattern occurrences efficiently in linear time."
  }),
  createMcqQuestion({
    id: "cs_016",
    category: "Object-Oriented Programming",
    prompt: "Which concept allows same method name with different parameter lists?",
    options: ["Inheritance", "Polymorphism (overloading)", "Encapsulation", "Abstraction"],
    correctOptionId: "b",
    explanation: "Method overloading is compile-time polymorphism."
  }),
  createMcqQuestion({
    id: "cs_017",
    category: "Object-Oriented Programming",
    prompt: "A class inheriting behavior from another class demonstrates",
    options: ["Encapsulation", "Polymorphism", "Inheritance", "Composition"],
    correctOptionId: "c",
    explanation: "Inheritance captures an is-a relationship."
  }),
  createMcqQuestion({
    id: "cs_018",
    category: "Object-Oriented Programming",
    prompt: "Private members in a class are accessible",
    options: ["Only within same class", "In all subclasses", "In same package", "Everywhere"],
    correctOptionId: "a",
    explanation: "Private visibility restricts to defining class."
  }),
  createMcqQuestion({
    id: "cs_019",
    category: "Concurrency",
    prompt: "Which primitive is typically used to control access to a finite number of resources?",
    options: ["Semaphore", "Pointer", "Callback", "Hash table"],
    correctOptionId: "a",
    explanation: "Semaphores track permits for concurrent access."
  }),
  createMcqQuestion({
    id: "cs_020",
    category: "Concurrency",
    prompt: "Race condition occurs when",
    options: [
      "Single thread modifies data",
      "Program has syntax error",
      "Multiple threads access shared data without proper synchronization",
      "Network packet loss occurs"
    ],
    correctOptionId: "c",
    explanation: "Unsynchronized shared-state access can lead to nondeterministic behavior."
  }),
  createMcqQuestion({
    id: "cs_021",
    category: "Compiler Design",
    prompt: "Lexical analysis phase converts",
    options: ["Tokens into parse tree", "Source code into tokens", "IR into machine code", "AST into bytecode"],
    correctOptionId: "b",
    explanation: "Lexer scans characters and produces tokens."
  }),
  createMcqQuestion({
    id: "cs_022",
    category: "Compiler Design",
    prompt: "Which parser is bottom-up?",
    options: ["LL(1)", "Recursive descent", "LR parser", "Predictive parser"],
    correctOptionId: "c",
    explanation: "LR family constructs parse from leaves to root."
  }),
  createMcqQuestion({
    id: "cs_023",
    category: "Computer Architecture",
    prompt: "Cache memory primarily improves",
    options: ["Disk capacity", "CPU speed", "Average memory access time", "Network latency"],
    correctOptionId: "c",
    explanation: "Cache exploits locality to reduce effective memory latency."
  }),
  createMcqQuestion({
    id: "cs_024",
    category: "Computer Architecture",
    prompt: "In pipelining, a structural hazard occurs due to",
    options: ["Data dependency", "Branch prediction failure", "Resource conflict", "Cache miss"],
    correctOptionId: "c",
    explanation: "Structural hazards arise when hardware resources are insufficient for concurrent stages."
  }),
  createMcqQuestion({
    id: "cs_025",
    category: "System Design",
    prompt: "Horizontal scaling means",
    options: ["Increasing RAM on same server", "Adding more machines", "Increasing CPU clock", "Compressing data"],
    correctOptionId: "b",
    explanation: "Horizontal scale = scale out by adding nodes."
  }),
  createMcqQuestion({
    id: "cs_026",
    category: "System Design",
    prompt: "A load balancer in front of multiple app servers mainly provides",
    options: ["Encryption only", "Traffic distribution and availability", "Code compilation", "Data compression only"],
    correctOptionId: "b",
    explanation: "Load balancer distributes requests and improves resilience."
  }),
  createMcqQuestion({
    id: "cs_027",
    category: "System Design",
    prompt: "Idempotent HTTP methods include",
    options: ["POST only", "GET and DELETE", "PATCH only", "CONNECT only"],
    correctOptionId: "b",
    explanation: "GET and DELETE are idempotent by HTTP semantics."
  }),
  createMcqQuestion({
    id: "cs_028",
    category: "Linux",
    prompt: "Which command is commonly used to list running processes?",
    options: ["ls", "ps", "cat", "cp"],
    correctOptionId: "b",
    explanation: "ps shows process status details."
  }),
  createMcqQuestion({
    id: "cs_029",
    category: "Linux",
    prompt: "In Unix-like systems, file permission 755 means",
    options: ["rw-rw-rw-", "rwxr-xr-x", "rwx------", "rwxrwx---"],
    correctOptionId: "b",
    explanation: "Owner: rwx, group: r-x, others: r-x."
  }),
  createMcqQuestion({
    id: "cs_030",
    category: "Security",
    prompt: "A hash function used for password storage should be",
    options: ["Fast and reversible", "Fast and unsalted", "Slow and salted", "Reversible with key"],
    correctOptionId: "c",
    explanation: "Use slow salted hashes (bcrypt/argon2/scrypt style) to resist brute force."
  }),
  createMcqQuestion({
    id: "cs_031",
    category: "Security",
    prompt: "SQL injection is prevented best by",
    options: ["String concatenation", "Prepared statements", "Using GET requests", "Increasing timeout"],
    correctOptionId: "b",
    explanation: "Prepared queries separate data from SQL structure."
  }),
  createMcqQuestion({
    id: "cs_032",
    category: "Distributed Systems",
    prompt: "CAP theorem states distributed systems can guarantee at most",
    options: ["1 property", "2 of consistency, availability, partition tolerance", "All 3 always", "None"],
    correctOptionId: "b",
    explanation: "Under partition, system chooses consistency or availability."
  }),
  createMcqQuestion({
    id: "cs_033",
    category: "Distributed Systems",
    prompt: "Eventual consistency means",
    options: [
      "All nodes always instantly consistent",
      "Nodes may diverge temporarily but converge later",
      "No replication",
      "Strong serializability"
    ],
    correctOptionId: "b",
    explanation: "Replicas might be temporarily stale but converge over time."
  }),
  createMcqQuestion({
    id: "cs_034",
    category: "Databases",
    prompt: "Which join returns rows only when keys match in both tables?",
    options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL OUTER JOIN"],
    correctOptionId: "c",
    explanation: "Inner join keeps intersection of matching rows."
  }),
  createMcqQuestion({
    id: "cs_035",
    category: "Databases",
    prompt: "An index can significantly speed up",
    options: ["All inserts only", "Read queries with selective predicates", "Schema migrations only", "Network calls"],
    correctOptionId: "b",
    explanation: "Indexes optimize lookup and filtering on indexed columns."
  }),
  createMcqQuestion({
    id: "cs_036",
    category: "Data Structures",
    prompt: "Which structure gives O(1) average insert and lookup by key?",
    options: ["Array", "Linked list", "Hash table", "Binary heap"],
    correctOptionId: "c",
    explanation: "Hash table offers average constant-time key operations."
  }),
  createMcqQuestion({
    id: "cs_037",
    category: "Algorithms",
    prompt: "Binary search requires",
    options: ["Hashing", "Sorted data", "Tree rotations", "Graph edges"],
    correctOptionId: "b",
    explanation: "Binary search assumes sorted order."
  }),
  createMcqQuestion({
    id: "cs_038",
    category: "Algorithms",
    prompt: "Topological sort can be performed on",
    options: ["Any undirected graph", "Any weighted graph", "Directed acyclic graph", "Only complete graphs"],
    correctOptionId: "c",
    explanation: "Topological ordering exists only for DAGs."
  }),
  createMcqQuestion({
    id: "cs_039",
    category: "Networking",
    prompt: "TLS mainly provides",
    options: ["Routing", "Compression", "Confidentiality and integrity over network", "DNS resolution"],
    correctOptionId: "c",
    explanation: "TLS secures application data in transit."
  }),
  createMcqQuestion({
    id: "cs_040",
    category: "Networking",
    prompt: "HTTP status 404 indicates",
    options: ["Unauthorized", "Forbidden", "Not found", "Server error"],
    correctOptionId: "c",
    explanation: "404 means requested resource is not found."
  }),
  createMcqQuestion({
    id: "cs_041",
    category: "Version Control",
    prompt: "A Git rebase primarily",
    options: ["Deletes repository", "Rewrites commit history onto new base", "Builds binaries", "Encrypts commits"],
    correctOptionId: "b",
    explanation: "Rebase reapplies commits on another branch tip."
  }),
  createMcqQuestion({
    id: "cs_042",
    category: "Testing",
    prompt: "Unit tests should ideally",
    options: ["Depend on external network", "Be deterministic and isolated", "Run only in production", "Skip edge cases"],
    correctOptionId: "b",
    explanation: "Reliable unit tests are isolated and repeatable."
  }),
  createMcqQuestion({
    id: "cs_043",
    category: "Software Engineering",
    prompt: "Big-O describes",
    options: ["Exact runtime in ms", "Upper-bound growth trend with input size", "Memory address", "Compilation speed"],
    correctOptionId: "b",
    explanation: "Big-O captures asymptotic growth behavior."
  }),
  createMcqQuestion({
    id: "cs_044",
    category: "Software Engineering",
    prompt: "A pure function",
    options: ["Modifies global state", "Returns random values", "Has no side effects for same input", "Always async"],
    correctOptionId: "c",
    explanation: "Pure functions are deterministic and side-effect free."
  }),
  createMcqQuestion({
    id: "cs_045",
    category: "Cloud Fundamentals",
    prompt: "Container orchestration platforms (e.g., Kubernetes) mainly help with",
    options: ["Image editing", "Service deployment, scaling, and health management", "DNS replacement", "Language parsing"],
    correctOptionId: "b",
    explanation: "They automate container scheduling and lifecycle management."
  })
];

const LEGACY_AI_QUESTION_BANK: McqQuestion[] = [
  createMcqQuestion({
    id: "ai_001",
    category: "Machine Learning Basics",
    prompt: "In supervised learning, models are trained using",
    options: ["Only unlabeled data", "Labeled input-output pairs", "Random text only", "No data"],
    correctOptionId: "b",
    explanation: "Supervised learning relies on labeled examples."
  }),
  createMcqQuestion({
    id: "ai_002",
    category: "Machine Learning Basics",
    prompt: "Overfitting means",
    options: [
      "Model performs poorly on train and test",
      "Model fits train too well but generalizes poorly",
      "Model under-utilizes parameters",
      "Model cannot converge"
    ],
    correctOptionId: "b",
    explanation: "Overfit models memorize training patterns and fail on unseen data."
  }),
  createMcqQuestion({
    id: "ai_003",
    category: "Machine Learning Basics",
    prompt: "Bias-variance tradeoff is about balancing",
    options: ["Speed and memory", "Underfitting and overfitting", "Precision and recall only", "Batch and epoch"],
    correctOptionId: "b",
    explanation: "Higher bias underfits; higher variance overfits."
  }),
  createMcqQuestion({
    id: "ai_004",
    category: "Evaluation Metrics",
    prompt: "For imbalanced classification, which metric is often more useful than accuracy?",
    options: ["MSE", "F1-score", "MAE", "R-squared"],
    correctOptionId: "b",
    explanation: "F1 balances precision and recall for skewed classes."
  }),
  createMcqQuestion({
    id: "ai_005",
    category: "Evaluation Metrics",
    prompt: "Precision is defined as",
    options: [
      "TP / (TP + FN)",
      "TP / (TP + FP)",
      "TN / (TN + FP)",
      "(TP + TN) / total"
    ],
    correctOptionId: "b",
    explanation: "Precision measures correctness among predicted positives."
  }),
  createMcqQuestion({
    id: "ai_006",
    category: "Evaluation Metrics",
    prompt: "Recall is defined as",
    options: ["TP / (TP + FN)", "TP / (TP + FP)", "TN / (TN + FP)", "FP / (FP + TN)"],
    correctOptionId: "a",
    explanation: "Recall measures coverage of actual positives."
  }),
  createMcqQuestion({
    id: "ai_007",
    category: "Linear Models",
    prompt: "Logistic regression outputs",
    options: ["Any real number only", "A probability between 0 and 1", "Only integers", "Only binary labels directly"],
    correctOptionId: "b",
    explanation: "Sigmoid maps logits to probability."
  }),
  createMcqQuestion({
    id: "ai_008",
    category: "Linear Models",
    prompt: "L2 regularization tends to",
    options: ["Set many weights exactly to zero", "Shrink weights smoothly", "Increase model variance", "Remove bias term"],
    correctOptionId: "b",
    explanation: "L2 penalizes squared magnitude and reduces large coefficients."
  }),
  createMcqQuestion({
    id: "ai_009",
    category: "Trees and Ensembles",
    prompt: "Random Forest mainly reduces overfitting by",
    options: ["Using one deep tree", "Bagging many decorrelated trees", "Removing features", "Using only linear splits"],
    correctOptionId: "b",
    explanation: "Bootstrap sampling + random features decorrelate trees."
  }),
  createMcqQuestion({
    id: "ai_010",
    category: "Trees and Ensembles",
    prompt: "Gradient boosting builds models",
    options: ["All at once in parallel only", "Sequentially to correct residual errors", "Without a loss function", "Only with SVM"],
    correctOptionId: "b",
    explanation: "Each stage optimizes residuals/gradients of prior stages."
  }),
  createMcqQuestion({
    id: "ai_011",
    category: "Unsupervised Learning",
    prompt: "K-means clustering objective minimizes",
    options: ["Cross entropy", "Within-cluster sum of squares", "Hinge loss", "L1 distance to origin"],
    correctOptionId: "b",
    explanation: "K-means optimizes cluster compactness (inertia)."
  }),
  createMcqQuestion({
    id: "ai_012",
    category: "Unsupervised Learning",
    prompt: "PCA is primarily used for",
    options: ["Classification only", "Dimensionality reduction", "Sequence modeling", "Image segmentation only"],
    correctOptionId: "b",
    explanation: "PCA projects data to principal components with max variance."
  }),
  createMcqQuestion({
    id: "ai_013",
    category: "Deep Learning",
    prompt: "Backpropagation computes",
    options: ["Model architecture", "Gradients of loss w.r.t. parameters", "Dataset statistics", "Only activation outputs"],
    correctOptionId: "b",
    explanation: "Backprop applies chain rule to compute gradients."
  }),
  createMcqQuestion({
    id: "ai_014",
    category: "Deep Learning",
    prompt: "Dropout is used to",
    options: ["Increase learning rate", "Prevent overfitting by random neuron dropping", "Normalize data", "Initialize weights"],
    correctOptionId: "b",
    explanation: "Dropout regularizes by random unit deactivation during training."
  }),
  createMcqQuestion({
    id: "ai_015",
    category: "Deep Learning",
    prompt: "ReLU activation is",
    options: ["min(0, x)", "max(0, x)", "1 / (1 + e^-x)", "tanh(x)"],
    correctOptionId: "b",
    explanation: "ReLU(x) = max(0, x)."
  }),
  createMcqQuestion({
    id: "ai_016",
    category: "Optimization",
    prompt: "Adam optimizer combines ideas from",
    options: ["SGD only", "Momentum and RMSProp-like adaptive rates", "Newton's method only", "KNN"],
    correctOptionId: "b",
    explanation: "Adam uses first and second moment estimates."
  }),
  createMcqQuestion({
    id: "ai_017",
    category: "Optimization",
    prompt: "Learning rate too high often causes",
    options: ["Very slow training", "Divergence or oscillation", "Guaranteed best accuracy", "No gradient"],
    correctOptionId: "b",
    explanation: "Large steps can overshoot minima and destabilize training."
  }),
  createMcqQuestion({
    id: "ai_018",
    category: "NLP",
    prompt: "Tokenization in NLP is",
    options: ["Converting labels to one-hot only", "Splitting text into units like words/subwords", "Removing all punctuation always", "Translating text"],
    correctOptionId: "b",
    explanation: "Tokenization converts raw text into model-consumable tokens."
  }),
  createMcqQuestion({
    id: "ai_019",
    category: "NLP",
    prompt: "Word embeddings represent words as",
    options: ["Fixed ASCII codes", "Dense vectors in semantic space", "Only frequency counts", "Trees"],
    correctOptionId: "b",
    explanation: "Embeddings capture semantic relationships as vectors."
  }),
  createMcqQuestion({
    id: "ai_020",
    category: "NLP",
    prompt: "BLEU score is commonly used for",
    options: ["Image classification", "Machine translation quality", "Object detection", "Speech enhancement"],
    correctOptionId: "b",
    explanation: "BLEU compares n-gram overlap with references."
  }),
  createMcqQuestion({
    id: "ai_021",
    category: "Computer Vision",
    prompt: "Convolutional neural networks are especially effective for",
    options: ["Tabular only", "Images with spatial structure", "Sorting arrays", "Relational joins"],
    correctOptionId: "b",
    explanation: "CNN kernels exploit local spatial patterns."
  }),
  createMcqQuestion({
    id: "ai_022",
    category: "Computer Vision",
    prompt: "IoU metric is commonly used in",
    options: ["Language modeling", "Object detection", "Time-series forecasting", "Clustering"],
    correctOptionId: "b",
    explanation: "Intersection over Union evaluates predicted bounding boxes."
  }),
  createMcqQuestion({
    id: "ai_023",
    category: "Computer Vision",
    prompt: "Data augmentation helps by",
    options: ["Reducing training data", "Improving generalization with transformed samples", "Removing labels", "Increasing overfit"],
    correctOptionId: "b",
    explanation: "Augmentations diversify training distribution."
  }),
  createMcqQuestion({
    id: "ai_024",
    category: "Reinforcement Learning",
    prompt: "In RL, a policy defines",
    options: ["State transition matrix only", "Action selection strategy for states", "Reward function only", "Dataset split"],
    correctOptionId: "b",
    explanation: "Policy maps states to actions (or action probabilities)."
  }),
  createMcqQuestion({
    id: "ai_025",
    category: "Reinforcement Learning",
    prompt: "Q-learning is",
    options: ["Model-based supervised algorithm", "Off-policy value-based RL algorithm", "Clustering method", "Search algorithm"],
    correctOptionId: "b",
    explanation: "Q-learning learns action-value estimates off-policy."
  }),
  createMcqQuestion({
    id: "ai_026",
    category: "Reinforcement Learning",
    prompt: "Exploration vs exploitation refers to",
    options: ["Training vs testing split", "Trying new actions vs using best known action", "CPU vs GPU choice", "Batch vs online inference"],
    correctOptionId: "b",
    explanation: "Agent balances discovering better actions and leveraging known rewards."
  }),
  createMcqQuestion({
    id: "ai_027",
    category: "Generative AI",
    prompt: "A transformer relies heavily on",
    options: ["Recurrence only", "Self-attention mechanism", "Decision trees", "K-means"],
    correctOptionId: "b",
    explanation: "Attention enables context-aware token interactions."
  }),
  createMcqQuestion({
    id: "ai_028",
    category: "Generative AI",
    prompt: "Temperature in text generation mainly controls",
    options: ["Model size", "Output randomness/diversity", "Token length limit", "Training speed"],
    correctOptionId: "b",
    explanation: "Higher temperature samples from flatter distribution."
  }),
  createMcqQuestion({
    id: "ai_029",
    category: "Generative AI",
    prompt: "Prompt engineering primarily improves",
    options: ["GPU drivers", "How effectively model instructions are expressed", "Dataset labeling only", "Weight quantization"],
    correctOptionId: "b",
    explanation: "Well-structured prompts improve response quality and consistency."
  }),
  createMcqQuestion({
    id: "ai_030",
    category: "LLM Safety",
    prompt: "Hallucination in LLMs means",
    options: ["Model crash", "Confidently generated incorrect content", "GPU memory leak", "Input truncation"],
    correctOptionId: "b",
    explanation: "Hallucinations are plausible but factually wrong outputs."
  }),
  createMcqQuestion({
    id: "ai_031",
    category: "LLM Safety",
    prompt: "RAG (retrieval-augmented generation) helps reduce hallucinations by",
    options: ["Increasing learning rate", "Injecting relevant retrieved context", "Changing tokenizer", "Removing attention"],
    correctOptionId: "b",
    explanation: "Grounding with retrieved context improves factual accuracy."
  }),
  createMcqQuestion({
    id: "ai_032",
    category: "MLOps",
    prompt: "Data drift indicates",
    options: ["Model file corruption", "Input distribution shifts over time", "Better validation score", "Lower batch size"],
    correctOptionId: "b",
    explanation: "Drift occurs when serving data differs from training data."
  }),
  createMcqQuestion({
    id: "ai_033",
    category: "MLOps",
    prompt: "A/B testing in ML deployment is used to",
    options: ["Train faster", "Compare model variants on live traffic", "Label images", "Normalize features"],
    correctOptionId: "b",
    explanation: "A/B tests evaluate real-world impact before full rollout."
  }),
  createMcqQuestion({
    id: "ai_034",
    category: "MLOps",
    prompt: "Model monitoring should track",
    options: ["Only CPU temperature", "Latency, errors, and quality metrics", "Only training loss", "Only GPU usage"],
    correctOptionId: "b",
    explanation: "Production ML health depends on system + model quality metrics."
  }),
  createMcqQuestion({
    id: "ai_035",
    category: "Statistics",
    prompt: "Standard deviation measures",
    options: ["Central tendency", "Spread/dispersion", "Skewness only", "Sample size"],
    correctOptionId: "b",
    explanation: "It quantifies variation around mean."
  }),
  createMcqQuestion({
    id: "ai_036",
    category: "Statistics",
    prompt: "p-value in hypothesis testing is",
    options: [
      "Probability null hypothesis is true",
      "Probability of observing data as extreme given null is true",
      "Type-I error rate always",
      "Posterior probability"
    ],
    correctOptionId: "b",
    explanation: "It is computed assuming null hypothesis is true."
  }),
  createMcqQuestion({
    id: "ai_037",
    category: "Statistics",
    prompt: "Cross-validation primarily helps estimate",
    options: ["Training hardware cost", "Generalization performance", "Optimizer momentum", "Model parameter count"],
    correctOptionId: "b",
    explanation: "Cross-validation evaluates robustness on unseen folds."
  }),
  createMcqQuestion({
    id: "ai_038",
    category: "Feature Engineering",
    prompt: "One-hot encoding is typically used for",
    options: ["Continuous variables", "Categorical variables", "Image pixels", "Audio spectrograms"],
    correctOptionId: "b",
    explanation: "One-hot converts categories into binary indicator vectors."
  }),
  createMcqQuestion({
    id: "ai_039",
    category: "Feature Engineering",
    prompt: "Feature scaling is especially important for",
    options: ["Tree-based models only", "Distance/gradient-based methods", "Hash maps", "Rule engines"],
    correctOptionId: "b",
    explanation: "SVM, KNN, gradient methods are sensitive to feature scale."
  }),
  createMcqQuestion({
    id: "ai_040",
    category: "Responsible AI",
    prompt: "A fairness metric in classification can include",
    options: ["BLEU", "Demographic parity", "PSNR", "IoU"],
    correctOptionId: "b",
    explanation: "Demographic parity checks positive prediction rates across groups."
  }),
  createMcqQuestion({
    id: "ai_041",
    category: "Responsible AI",
    prompt: "Model cards are useful for",
    options: ["GPU overclocking", "Documenting model scope, risks, and evaluation", "Tokenizing text", "Lossless compression"],
    correctOptionId: "b",
    explanation: "Model cards communicate usage constraints and performance characteristics."
  }),
  createMcqQuestion({
    id: "ai_042",
    category: "Generative AI",
    prompt: "Top-k sampling in LLM decoding",
    options: ["Always picks argmax token", "Samples only from top-k probable tokens", "Removes attention layers", "Trains tokenizer"],
    correctOptionId: "b",
    explanation: "Top-k restricts candidate token set before sampling."
  }),
  createMcqQuestion({
    id: "ai_043",
    category: "Generative AI",
    prompt: "Top-p (nucleus) sampling chooses tokens from",
    options: ["Top 1 token always", "Smallest token set with cumulative probability >= p", "All tokens equally", "Only rare tokens"],
    correctOptionId: "b",
    explanation: "Nucleus sampling adapts candidate set per distribution mass."
  }),
  createMcqQuestion({
    id: "ai_044",
    category: "Neural Networks",
    prompt: "Vanishing gradients are commonly mitigated using",
    options: ["Sigmoid everywhere", "ReLU-like activations and normalization", "No hidden layers", "Lower batch size only"],
    correctOptionId: "b",
    explanation: "ReLU, residual links, normalization help gradient flow."
  }),
  createMcqQuestion({
    id: "ai_045",
    category: "Neural Networks",
    prompt: "Batch normalization is typically used to",
    options: ["Replace optimizer", "Stabilize training and improve convergence", "Tokenize text", "Compress model weights"],
    correctOptionId: "b",
    explanation: "It normalizes layer activations and smooths optimization."
  })
];

const EXTERNAL_AI_ROLE_DEFINITIONS: ExternalAiRoleDefinition[] = hasExternalAiRoleBank ? externalAiRoles : [];

const GENERATED_AI_QUESTION_BANK: McqQuestion[] = externalAiQuestions.map((question) =>
  createMcqQuestion({
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: question.options,
    correctOptionId: question.correctOptionId,
    explanation: question.explanation
  })
);

const AI_QUESTION_BANK: McqQuestion[] = GENERATED_AI_QUESTION_BANK.length > 0 ? GENERATED_AI_QUESTION_BANK : LEGACY_AI_QUESTION_BANK;

const AI_ROLE_DEFINITIONS: ExternalAiRoleDefinition[] =
  EXTERNAL_AI_ROLE_DEFINITIONS.length > 0
    ? EXTERNAL_AI_ROLE_DEFINITIONS
    : [
        {
          id: "general-ai",
          name: "General AI",
          imageSrc: "/war-room/ai-card.svg",
          imageAlt: "General AI role visual",
          summary: "Foundational AI interview prep across machine learning and deep learning basics.",
          focusTopics: ["Machine Learning", "Deep Learning", "MLOps", "Generative AI"],
          questionCount: LEGACY_AI_QUESTION_BANK.length
        }
      ];

const AI_ROLE_QUESTION_IDS_BY_ROLE = new Map<string, string[]>();

if (externalAiQuestions.length > 0) {
  externalAiQuestions.forEach((question) => {
    const tracked = AI_ROLE_QUESTION_IDS_BY_ROLE.get(question.roleId) ?? [];
    tracked.push(question.id);
    AI_ROLE_QUESTION_IDS_BY_ROLE.set(question.roleId, tracked);
  });
} else {
  AI_ROLE_QUESTION_IDS_BY_ROLE.set("general-ai", AI_QUESTION_BANK.map((question) => question.id));
}

const GENERATED_CS_QUESTION_BANK: McqQuestion[] = externalComputerScienceQuestions.map((question) =>
  createMcqQuestion({
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    prompt: question.prompt,
    imageUrl: question.imageUrl,
    imageAlt: question.imageAlt,
    imageSourceUrl: question.imageSourceUrl,
    options: question.options,
    correctOptionId: question.correctOptionId,
    explanation: question.explanation
  })
);

const EXTERNAL_CS_TEST_DEFINITIONS = hasExternalComputerScienceBank ? externalComputerScienceTests : [];

const CS_QUESTION_BANK: McqQuestion[] = GENERATED_CS_QUESTION_BANK.length > 0 ? GENERATED_CS_QUESTION_BANK : LEGACY_CS_QUESTION_BANK;

const TRACK_DEFINITIONS: Record<InterviewTestType, InterviewTrackDefinition> = {
  coding: {
    id: "coding",
    title: "Coding Simulation",
    subtitle: "1 easy + 1 medium + 1 hard",
    description:
      "Timed coding round with real interview-style prompts categorized by core DSA topics. Execution is desktop-only.",
    durationMinutes: 90,
    questionCount: 3,
    mode: "coding"
  },
  aptitude: {
    id: "aptitude",
    title: "Aptitude Sprint",
    subtitle: "40 questions / 60 minutes",
    description:
      "Quantitative aptitude, logic, and arithmetic categories used in campus and early-career screening rounds.",
    durationMinutes: 60,
    questionCount: 40,
    mode: "mcq"
  },
  "computer-science": {
    id: "computer-science",
    title: "Computer Science Technical",
    subtitle: "30 questions / 60 minutes",
    description:
      "Core CS mixed-paper assessment across OS, DBMS, networks, COA, DLD, algorithms, and programming fundamentals.",
    durationMinutes: 60,
    questionCount: 30,
    mode: "mcq"
  },
  ai: {
    id: "ai",
    title: "AI Technical",
    subtitle: "40 questions / 90 minutes",
    description:
      "Role-based AI interview prep spanning 20 tracks across ML, GenAI, research, MLOps, and AI architecture.",
    durationMinutes: 90,
    questionCount: 40,
    mode: "mcq"
  }
};

const TEST_TEMPLATE_COUNT_BY_TYPE: Record<InterviewTestType, number> = {
  coding: 100,
  aptitude: 100,
  "computer-science": 100,
  ai: 100
};

const TEST_TEMPLATE_SUMMARIES: Record<InterviewTestType, string> = {
  coding:
    "Assesses problem solving under pressure, DSA pattern recall, optimization reasoning, and code-quality communication.",
  aptitude:
    "Assesses arithmetic fluency, logical consistency, speed vs. accuracy tradeoffs, and elimination strategy in timed MCQs.",
  "computer-science":
    "Assesses depth in OS, DBMS, networking, algorithms, and software engineering concepts for technical interview rounds.",
  ai:
    "Assesses ML and deep-learning intuition, GenAI fundamentals, model evaluation judgment, and practical AI system thinking."
};

const TEST_TEMPLATE_TITLE_PREFIX: Record<InterviewTestType, string> = {
  coding: "Coding Test",
  aptitude: "Aptitude Test",
  "computer-science": "Computer Science Test",
  ai: "AI Test"
};

const TEST_TEMPLATE_CACHE = new Map<InterviewTestType, InterviewTestTemplate[]>();
const AI_ROLE_TEMPLATE_CACHE = new Map<string, InterviewTestTemplate[]>();

function listAiRoleDefinitions(): ExternalAiRoleDefinition[] {
  return AI_ROLE_DEFINITIONS;
}

function getAiRoleById(roleId: string): ExternalAiRoleDefinition | null {
  return listAiRoleDefinitions().find((role) => role.id === roleId) ?? null;
}

function getDefaultAiRoleId(): string | null {
  return listAiRoleDefinitions()[0]?.id ?? null;
}

function resolveAiRoleId(roleId?: string): string | null {
  if (roleId) {
    const matched = getAiRoleById(roleId);
    if (matched) {
      return matched.id;
    }
  }

  return getDefaultAiRoleId();
}

function getTemplateCountForType(testType: InterviewTestType, roleId?: string): number {
  if (testType === "ai") {
    return resolveAiRoleId(roleId) ? TEST_TEMPLATE_COUNT_BY_TYPE.ai : 0;
  }

  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    return EXTERNAL_CS_TEST_DEFINITIONS.length;
  }

  return TEST_TEMPLATE_COUNT_BY_TYPE[testType];
}

const MCQ_QUESTION_LOOKUP = new Map<string, McqQuestion>();
const CODING_QUESTION_LOOKUP = new Map<string, CodingQuestion>();

[...APTITUDE_QUESTION_BANK, ...CS_QUESTION_BANK, ...AI_QUESTION_BANK].forEach((question) => {
  MCQ_QUESTION_LOOKUP.set(question.id, question);
});

CODING_QUESTION_BANK.forEach((question) => {
  CODING_QUESTION_LOOKUP.set(question.id, question);
});

function hashToSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(values: T[], seed: number): T[] {
  const shuffled = [...values];
  const random = createSeededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function pickSeededSubset<T>(values: T[], count: number, seed: number): T[] {
  if (count <= 0 || values.length === 0) {
    return [];
  }

  if (values.length <= count) {
    return seededShuffle(values, seed);
  }

  return seededShuffle(values, seed).slice(0, count);
}

function randomize<T>(values: T[]): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function pickRandomSubset<T>(values: T[], count: number): T[] {
  if (count <= 0) {
    return [];
  }

  if (values.length <= count) {
    return randomize(values);
  }

  return randomize(values).slice(0, count);
}

function toPracticeMcq(question: McqQuestion): PracticeMcqQuestion {
  return {
    id: question.id,
    kind: "mcq",
    category: question.category,
    prompt: question.prompt,
    imageUrl: question.imageUrl,
    imageAlt: question.imageAlt,
    imageSourceUrl: question.imageSourceUrl,
    difficulty: question.difficulty,
    options: question.options
  };
}

function collectCategories(questions: PracticeQuestion[]): string[] {
  return Array.from(new Set(questions.map((question) => question.category))).slice(0, 12);
}

function getAiRoleQuestionBank(roleId?: string): McqQuestion[] {
  const resolvedRoleId = resolveAiRoleId(roleId);
  if (!resolvedRoleId) {
    return [];
  }

  const questionIds = AI_ROLE_QUESTION_IDS_BY_ROLE.get(resolvedRoleId) ?? [];
  if (questionIds.length === 0) {
    return AI_QUESTION_BANK;
  }

  return questionIds
    .map((questionId) => MCQ_QUESTION_LOOKUP.get(questionId))
    .filter((question): question is McqQuestion => Boolean(question));
}

function getMcqBankForType(testType: Exclude<InterviewTestType, "coding">, aiRoleId?: string): McqQuestion[] {
  if (testType === "aptitude") {
    return APTITUDE_QUESTION_BANK;
  }

  if (testType === "computer-science") {
    return CS_QUESTION_BANK;
  }

  return getAiRoleQuestionBank(aiRoleId);
}

function selectCodingRoundQuestions(): CodingQuestion[] {
  const easyPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "easy");
  const mediumPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "medium");
  const hardPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "hard");

  const easy = pickRandomSubset(easyPool, 1)[0];
  const medium = pickRandomSubset(mediumPool, 1)[0];
  const hard = pickRandomSubset(hardPool, 1)[0];

  return [easy, medium, hard].filter((question): question is CodingQuestion => Boolean(question));
}

function selectMcqRoundQuestions(
  testType: Exclude<InterviewTestType, "coding">,
  aiRoleId?: string
): PracticeMcqQuestion[] {
  const track = TRACK_DEFINITIONS[testType];
  const bank = getMcqBankForType(testType, aiRoleId);

  return pickRandomSubset(bank, track.questionCount).map((question) => toPracticeMcq(question));
}

function buildTemplateId(testType: InterviewTestType, templateIndex: number, aiRoleId?: string): string {
  if (testType === "ai" && aiRoleId) {
    return `ai_${aiRoleId}_test_${String(templateIndex).padStart(3, "0")}`;
  }

  return `${testType}_test_${String(templateIndex).padStart(3, "0")}`;
}

function parseAiTemplateDetails(templateId: string, roleId?: string): { roleId: string; templateIndex: number } | null {
  const rolePattern = /^ai_([a-z0-9-]+)_test_(\d{3})$/;
  const roleMatch = templateId.match(rolePattern);
  if (roleMatch) {
    const parsedRole = getAiRoleById(roleMatch[1]);
    const parsedRoleId = parsedRole?.id ?? null;
    const parsedIndex = Number(roleMatch[2]);
    if (!parsedRoleId || !Number.isInteger(parsedIndex)) {
      return null;
    }

    const maxTemplates = getTemplateCountForType("ai", parsedRoleId);
    if (parsedIndex < 1 || parsedIndex > maxTemplates) {
      return null;
    }

    return {
      roleId: parsedRoleId,
      templateIndex: parsedIndex
    };
  }

  const legacyPattern = /^ai_test_(\d{3})$/;
  const legacyMatch = templateId.match(legacyPattern);
  if (!legacyMatch) {
    return null;
  }

  const parsedRoleId = resolveAiRoleId(roleId);
  const parsedIndex = Number(legacyMatch[1]);
  if (!parsedRoleId || !Number.isInteger(parsedIndex)) {
    return null;
  }

  const maxTemplates = getTemplateCountForType("ai", parsedRoleId);
  if (parsedIndex < 1 || parsedIndex > maxTemplates) {
    return null;
  }

  return {
    roleId: parsedRoleId,
    templateIndex: parsedIndex
  };
}

function parseTemplateIndex(testType: InterviewTestType, templateId: string, roleId?: string): number | null {
  if (testType === "ai") {
    return parseAiTemplateDetails(templateId, roleId)?.templateIndex ?? null;
  }

  const prefix = `${testType}_test_`;
  if (!templateId.startsWith(prefix)) {
    return null;
  }

  const parsed = Number(templateId.slice(prefix.length));
  if (!Number.isInteger(parsed)) {
    return null;
  }

  const maxTemplates = getTemplateCountForType(testType, roleId);
  return parsed >= 1 && parsed <= maxTemplates ? parsed : null;
}

function selectCodingRoundQuestionsBySeed(seedKey: string): CodingQuestion[] {
  const seed = hashToSeed(seedKey);
  const easyPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "easy");
  const mediumPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "medium");
  const hardPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "hard");
  const fallbackPool = CODING_QUESTION_BANK;

  const easy =
    pickSeededSubset(easyPool.length > 0 ? easyPool : fallbackPool, 1, seed ^ hashToSeed("easy-selector"))[0] ?? null;
  const medium =
    pickSeededSubset(mediumPool.length > 0 ? mediumPool : fallbackPool, 1, seed ^ hashToSeed("medium-selector"))[0] ?? null;
  const hard =
    pickSeededSubset(hardPool.length > 0 ? hardPool : fallbackPool, 1, seed ^ hashToSeed("hard-selector"))[0] ?? null;

  const uniqueById = new Map<string, CodingQuestion>();
  [easy, medium, hard].forEach((question) => {
    if (question) {
      uniqueById.set(question.id, question);
    }
  });

  if (uniqueById.size < 3) {
    const fill = seededShuffle(fallbackPool, seed ^ hashToSeed("fill-selector"));
    fill.forEach((question) => {
      if (uniqueById.size < 3) {
        uniqueById.set(question.id, question);
      }
    });
  }

  return Array.from(uniqueById.values()).slice(0, 3);
}

function selectMcqRoundQuestionsBySeed(
  testType: Exclude<InterviewTestType, "coding">,
  seedKey: string,
  aiRoleId?: string
): PracticeMcqQuestion[] {
  const track = TRACK_DEFINITIONS[testType];
  const bank = getMcqBankForType(testType, aiRoleId);
  const seed = hashToSeed(seedKey);

  return pickSeededSubset(bank, track.questionCount, seed).map((question) => toPracticeMcq(question));
}

function selectComputerScienceTemplateQuestions(templateIndex: number): PracticeMcqQuestion[] {
  const track = TRACK_DEFINITIONS["computer-science"];
  const testDefinition = EXTERNAL_CS_TEST_DEFINITIONS[templateIndex - 1];
  if (!testDefinition) {
    return [];
  }

  const selectedQuestions: PracticeMcqQuestion[] = [];
  const selectedIds = new Set<string>();

  testDefinition.questionIds.forEach((questionId) => {
    if (selectedQuestions.length >= track.questionCount || selectedIds.has(questionId)) {
      return;
    }

    const question = MCQ_QUESTION_LOOKUP.get(questionId);
    if (!question) {
      return;
    }

    selectedQuestions.push(toPracticeMcq(question));
    selectedIds.add(questionId);
  });

  if (selectedQuestions.length >= track.questionCount) {
    return selectedQuestions.slice(0, track.questionCount);
  }

  const fallbackQuestions = seededShuffle(CS_QUESTION_BANK, hashToSeed(`cs-template-fallback-${templateIndex}`));

  fallbackQuestions.forEach((question) => {
    if (selectedQuestions.length >= track.questionCount || selectedIds.has(question.id)) {
      return;
    }

    selectedQuestions.push(toPracticeMcq(question));
    selectedIds.add(question.id);
  });

  return selectedQuestions.slice(0, track.questionCount);
}

function selectQuestionsForTemplate(
  testType: InterviewTestType,
  templateIndex: number,
  aiRoleId?: string
): PracticeQuestion[] {
  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    const questions = selectComputerScienceTemplateQuestions(templateIndex);
    if (questions.length > 0) {
      return questions;
    }
  }

  const roleScopedSeed = testType === "ai" && aiRoleId ? `${testType}-${aiRoleId}-${templateIndex}` : `${testType}-${templateIndex}`;

  if (testType === "coding") {
    return selectCodingRoundQuestionsBySeed(roleScopedSeed);
  }

  return selectMcqRoundQuestionsBySeed(testType, roleScopedSeed, aiRoleId);
}

function buildInterviewTestTemplate(
  testType: InterviewTestType,
  templateIndex: number,
  aiRoleId?: string
): InterviewTestTemplate {
  const track = TRACK_DEFINITIONS[testType];
  const resolvedAiRoleId = testType === "ai" ? resolveAiRoleId(aiRoleId) : null;
  const aiRole = testType === "ai" && resolvedAiRoleId ? getAiRoleById(resolvedAiRoleId) : null;
  const questions = selectQuestionsForTemplate(testType, templateIndex, resolvedAiRoleId ?? undefined);
  const categoryFocus = collectCategories(questions).slice(0, 4);
  const fallbackAiFocus = aiRole?.focusTopics.slice(0, 4) ?? [];
  const aiSummary =
    aiRole?.summary ||
    "Assesses ML and deep-learning intuition, GenAI fundamentals, model evaluation judgment, and practical AI system thinking.";
  const aiTitlePrefix = aiRole?.name || TEST_TEMPLATE_TITLE_PREFIX.ai;

  return {
    id: buildTemplateId(testType, templateIndex, resolvedAiRoleId ?? undefined),
    index: templateIndex,
    testType,
    title:
      testType === "ai"
        ? `${aiTitlePrefix} Test ${String(templateIndex).padStart(3, "0")}`
        : `${TEST_TEMPLATE_TITLE_PREFIX[testType]} ${String(templateIndex).padStart(3, "0")}`,
    subtitle: `${track.questionCount} questions / ${track.durationMinutes} min`,
    summary: testType === "ai" ? aiSummary : TEST_TEMPLATE_SUMMARIES[testType],
    durationMinutes: track.durationMinutes,
    questionCount: track.questionCount,
    mode: track.mode,
    categoryFocus:
      categoryFocus.length > 0
        ? categoryFocus
        : testType === "ai" && fallbackAiFocus.length > 0
          ? fallbackAiFocus
          : ["General"],
    ...(testType === "ai" && resolvedAiRoleId && aiRole
      ? {
          roleId: resolvedAiRoleId,
          roleName: aiRole.name
        }
      : {})
  };
}

function getOrBuildTemplateCatalog(testType: InterviewTestType): InterviewTestTemplate[] {
  if (testType === "ai") {
    return [];
  }

  const cached = TEST_TEMPLATE_CACHE.get(testType);
  if (cached) {
    return cached;
  }

  const catalog =
    testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0
      ? EXTERNAL_CS_TEST_DEFINITIONS.map((testDefinition, index) => {
          const categoryFocus = testDefinition.focusTopics.slice(0, 4);
          const templateIndex = index + 1;

          return {
            id: testDefinition.id,
            index: templateIndex,
            testType,
            title: testDefinition.title || `Computer Science Test ${String(templateIndex).padStart(3, "0")}`,
            subtitle: `${testDefinition.questionCount} questions / ${testDefinition.durationMinutes} min`,
            summary:
              testDefinition.summary ||
              "Core CS mixed-paper assessment with weighted focus areas and deterministic question ordering.",
            durationMinutes: testDefinition.durationMinutes,
            questionCount: testDefinition.questionCount,
            mode: "mcq",
            categoryFocus: categoryFocus.length > 0 ? categoryFocus : ["Computer Science"]
          } satisfies InterviewTestTemplate;
        })
      : Array.from({ length: getTemplateCountForType(testType) }, (_, index) =>
          buildInterviewTestTemplate(testType, index + 1)
        );

  TEST_TEMPLATE_CACHE.set(testType, catalog);
  return catalog;
}

function getOrBuildAiRoleTemplateCatalog(roleId: string): InterviewTestTemplate[] {
  const resolvedRoleId = resolveAiRoleId(roleId);
  if (!resolvedRoleId) {
    return [];
  }

  const cacheKey = resolvedRoleId;
  const cached = AI_ROLE_TEMPLATE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const catalog = Array.from({ length: getTemplateCountForType("ai", resolvedRoleId) }, (_, index) =>
    buildInterviewTestTemplate("ai", index + 1, resolvedRoleId)
  );

  AI_ROLE_TEMPLATE_CACHE.set(cacheKey, catalog);
  return catalog;
}

export function listInterviewTracks(): InterviewTrackDefinition[] {
  return [
    TRACK_DEFINITIONS.coding,
    TRACK_DEFINITIONS.aptitude,
    TRACK_DEFINITIONS["computer-science"],
    TRACK_DEFINITIONS.ai
  ];
}

export function getInterviewTrack(testType: InterviewTestType): InterviewTrackDefinition {
  return TRACK_DEFINITIONS[testType];
}

export function listAiInterviewRoles(): AiInterviewRole[] {
  return [...AI_ROLE_DEFINITIONS];
}

export function formatInterviewTestType(testType: InterviewTestType): string {
  if (testType === "computer-science") {
    return "Computer Science";
  }

  if (testType === "ai") {
    return "AI";
  }

  return testType[0].toUpperCase() + testType.slice(1);
}

export function getInterviewTestTemplateCount(testType: InterviewTestType, roleId?: string): number {
  return getTemplateCountForType(testType, roleId);
}

export function listInterviewTestTemplates(
  testType: InterviewTestType,
  limit?: number,
  roleId?: string
): InterviewTestTemplate[] {
  const templates =
    testType === "ai"
      ? (() => {
          const resolvedRoleId = resolveAiRoleId(roleId);
          return resolvedRoleId ? getOrBuildAiRoleTemplateCatalog(resolvedRoleId) : [];
        })()
      : getOrBuildTemplateCatalog(testType);

  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return templates;
  }

  return templates.slice(0, Math.max(0, Math.round(limit)));
}

export function getInterviewTestTemplate(
  testType: InterviewTestType,
  templateId: string,
  roleId?: string
): InterviewTestTemplate | null {
  if (testType === "ai") {
    const parsed = parseAiTemplateDetails(templateId, roleId);
    if (!parsed) {
      return null;
    }

    return getOrBuildAiRoleTemplateCatalog(parsed.roleId)[parsed.templateIndex - 1] ?? null;
  }

  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    const template = getOrBuildTemplateCatalog(testType).find((entry) => entry.id === templateId);
    return template ?? null;
  }

  const templateIndex = parseTemplateIndex(testType, templateId, roleId);
  if (templateIndex === null) {
    return null;
  }

  return getOrBuildTemplateCatalog(testType)[templateIndex - 1] ?? null;
}

export function buildPracticeAttemptSeed(testType: InterviewTestType, templateId?: string): PracticeAttemptSeed {
  const track = getInterviewTrack(testType);
  const template = templateId ? getInterviewTestTemplate(testType, templateId) : null;

  if (template) {
    const questions = selectQuestionsForTemplate(
      testType,
      template.index,
      template.testType === "ai" ? template.roleId : undefined
    );
    return {
      track,
      questions,
      categories: collectCategories(questions),
      answerKeyVersion: QUESTION_BANK_VERSION,
      template
    };
  }

  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    const defaultTemplate = getOrBuildTemplateCatalog("computer-science")[0] ?? undefined;
    const questions = selectComputerScienceTemplateQuestions(1);

    return {
      track,
      questions,
      categories: collectCategories(questions),
      answerKeyVersion: QUESTION_BANK_VERSION,
      template: defaultTemplate
    };
  }

  if (track.mode === "coding") {
    const questions = selectCodingRoundQuestions();

    return {
      track,
      questions,
      categories: collectCategories(questions),
      answerKeyVersion: QUESTION_BANK_VERSION
    };
  }

  const fallbackAiRoleId = testType === "ai" ? resolveAiRoleId() ?? undefined : undefined;
  const questions = selectMcqRoundQuestions(
    testType as Exclude<InterviewTestType, "coding">,
    fallbackAiRoleId
  );

  return {
    track,
    questions,
    categories: collectCategories(questions),
    answerKeyVersion: QUESTION_BANK_VERSION
  };
}

export function getMcqQuestionById(questionId: string): McqQuestion | null {
  return MCQ_QUESTION_LOOKUP.get(questionId) ?? null;
}

export function getCodingQuestionById(questionId: string): CodingQuestion | null {
  return CODING_QUESTION_LOOKUP.get(questionId) ?? null;
}

export function getPracticeQuestionById(questionId: string): PracticeQuestion | null {
  const mcqQuestion = getMcqQuestionById(questionId);
  if (mcqQuestion) {
    return toPracticeMcq(mcqQuestion);
  }

  return getCodingQuestionById(questionId);
}

export function scorePracticeMcqResponses(
  questions: PracticeQuestion[],
  mcqAnswers: Record<string, string>
): PracticeScore {
  const mcqQuestions = questions.filter((question): question is PracticeMcqQuestion => question.kind === "mcq");

  if (mcqQuestions.length === 0) {
    return {
      correct: 0,
      total: 0,
      answered: 0,
      percentage: 0
    };
  }

  let correct = 0;
  let answered = 0;

  mcqQuestions.forEach((question) => {
    const selectedOption = (mcqAnswers[question.id] ?? "").trim().toLowerCase();
    if (!selectedOption) {
      return;
    }

    answered += 1;

    const canonical = getMcqQuestionById(question.id);
    if (!canonical) {
      return;
    }

    if (canonical.correctOptionId === selectedOption) {
      correct += 1;
    }
  });

  const total = mcqQuestions.length;

  return {
    correct,
    total,
    answered,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0
  };
}

export function hasDesktopOnlyExecution(mode: PracticeAttemptMode): boolean {
  return mode === "coding";
}
