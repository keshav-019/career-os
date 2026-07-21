"use strict";

/**
 * Generic starter-code + harness generator for the local coding judge.
 *
 * A "paramSpec" is an ordered list of { name, type } describing exactly how a
 * problem's stdin is laid out, line by line. A problem also declares an
 * "outputKind" describing how the return value of the user's `solve`
 * function must be printed.
 *
 * Supported param types:
 *   int, long, double, string, intArray, stringArray, grid, charGrid, intArrayList
 *
 * Supported output kinds:
 *   int, long, double, bool, string, intArray, stringArray (auto-sorted), doubleArray
 *
 * Every generated program, in every language, follows the same shape:
 *   1. Slurp all of stdin, split into raw lines (trim trailing \r).
 *   2. Sequentially consume lines according to paramSpec to build typed args.
 *   3. Call the user-editable `solve(...)` function.
 *   4. Format + print the result according to outputKind.
 */

/* ------------------------------------------------------------------ */
/* Shared label helpers                                                */
/* ------------------------------------------------------------------ */

function genericTypeLabel(type) {
  switch (type) {
    case "int":
    case "long":
    case "double":
      return "number";
    case "string":
      return "string";
    case "intArray":
      return "number[]";
    case "stringArray":
      return "string[]";
    case "grid":
      return "number[][]";
    case "charGrid":
      return "string[]";
    case "intArrayList":
      return "number[][]";
    default:
      return "any";
  }
}

function buildSignatureComment(paramSpec, outputKind) {
  const params = paramSpec.map((p) => `${p.name}: ${genericTypeLabel(p.type)}`).join(", ");
  return `solve(${params}) -> ${genericTypeLabel(outputKind)}`;
}

/* ==================================================================== */
/* JavaScript                                                            */
/* ==================================================================== */

function jsReaderFor(param) {
  const { name, type } = param;
  switch (type) {
    case "int":
    case "long":
      return `const ${name} = parseInt(nextLine(), 10);`;
    case "double":
      return `const ${name} = parseFloat(nextLine());`;
    case "string":
      return `const ${name} = nextLine();`;
    case "intArray":
      return (
        `const ${name}_n = parseInt(nextLine(), 10);\n` +
        `  const ${name} = ${name}_n > 0 ? nextLine().trim().split(/\\s+/).map(Number) : [];`
      );
    case "stringArray":
      return (
        `const ${name}_n = parseInt(nextLine(), 10);\n` +
        `  const ${name} = [];\n` +
        `  for (let i = 0; i < ${name}_n; i++) { ${name}.push(nextLine()); }`
      );
    case "grid":
      return (
        `const [${name}_rows, ${name}_cols] = nextLine().trim().split(/\\s+/).map(Number);\n` +
        `  const ${name} = [];\n` +
        `  for (let i = 0; i < ${name}_rows; i++) { ${name}.push(nextLine().trim().split(/\\s+/).map(Number)); }`
      );
    case "charGrid":
      return (
        `const [${name}_rows, ${name}_cols] = nextLine().trim().split(/\\s+/).map(Number);\n` +
        `  const ${name} = [];\n` +
        `  for (let i = 0; i < ${name}_rows; i++) { ${name}.push(nextLine()); }`
      );
    case "intArrayList":
      return (
        `const ${name}_k = parseInt(nextLine(), 10);\n` +
        `  const ${name} = [];\n` +
        `  for (let i = 0; i < ${name}_k; i++) {\n` +
        `    const size = parseInt(nextLine(), 10);\n` +
        `    ${name}.push(size > 0 ? nextLine().trim().split(/\\s+/).map(Number) : []);\n` +
        `  }`
      );
    default:
      throw new Error(`Unsupported param type: ${type}`);
  }
}

function jsPrinter(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `console.log(String(result));`;
    case "double":
      return `console.log(Number(result).toFixed(6));`;
    case "bool":
      return `console.log(result ? "true" : "false");`;
    case "string":
      return `console.log(result === undefined || result === null ? "" : String(result));`;
    case "intArray":
      return `console.log((result || []).join(" "));`;
    case "stringArray":
      return `{ const arr = (result || []).slice().sort(); console.log(String(arr.length)); for (const w of arr) console.log(w); }`;
    case "doubleArray":
      return `{ const arr = result || []; for (const v of arr) console.log(Number(v).toFixed(6)); }`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function defaultReturnJs(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `return 0;`;
    case "double":
      return `return 0.0;`;
    case "bool":
      return `return false;`;
    case "string":
      return `return "";`;
    case "intArray":
    case "stringArray":
    case "doubleArray":
      return `return [];`;
    default:
      return `return null;`;
  }
}

function buildJavaScriptParts(paramSpec, outputKind, userBody) {
  const readers = paramSpec.map((p) => "  " + jsReaderFor(p)).join("\n");
  const argNames = paramSpec.map((p) => p.name).join(", ");
  const body = userBody || `  // Write your solution here.\n  ${defaultReturnJs(outputKind)}`;

  const prefix = `const fs = require("fs");
const __raw = fs.readFileSync(0, "utf8");
const __lines = __raw.split("\\n").map((l) => l.replace(/\\r$/, ""));
let __cursor = 0;
function nextLine() {
  return __cursor < __lines.length ? __lines[__cursor++] : "";
}

`;

  const functionBlock = `/**
 * ${buildSignatureComment(paramSpec, outputKind)}
 */
function solve(${argNames}) {
${body}
}`;

  const suffix = `

function __main() {
${readers}
  const result = solve(${argNames});
  ${jsPrinter(outputKind)}
}

__main();
`;

  return { prefix, functionBlock, suffix };
}

function buildJavaScriptStarter(paramSpec, outputKind, userBody) {
  const { prefix, functionBlock, suffix } = buildJavaScriptParts(paramSpec, outputKind, userBody);
  return prefix + functionBlock + suffix;
}

/* ==================================================================== */
/* Python                                                                */
/* ==================================================================== */

function pyReaderFor(param) {
  const { name, type } = param;
  switch (type) {
    case "int":
    case "long":
      return `${name} = int(next_line())`;
    case "double":
      return `${name} = float(next_line())`;
    case "string":
      return `${name} = next_line()`;
    case "intArray":
      return `${name}_n = int(next_line())\n    ${name} = list(map(int, next_line().split())) if ${name}_n > 0 else []`;
    case "stringArray":
      return `${name}_n = int(next_line())\n    ${name} = [next_line() for _ in range(${name}_n)]`;
    case "grid":
      return (
        `${name}_rows, ${name}_cols = map(int, next_line().split())\n` +
        `    ${name} = [list(map(int, next_line().split())) for _ in range(${name}_rows)]`
      );
    case "charGrid":
      return (
        `${name}_rows, ${name}_cols = map(int, next_line().split())\n` +
        `    ${name} = [next_line() for _ in range(${name}_rows)]`
      );
    case "intArrayList":
      return (
        `${name}_k = int(next_line())\n` +
        `    ${name} = []\n` +
        `    for _i in range(${name}_k):\n` +
        `        _size = int(next_line())\n` +
        `        ${name}.append(list(map(int, next_line().split())) if _size > 0 else [])`
      );
    default:
      throw new Error(`Unsupported param type: ${type}`);
  }
}

function pyPrinter(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `print(result)`;
    case "double":
      return `print(f"{float(result):.6f}")`;
    case "bool":
      return `print("true" if result else "false")`;
    case "string":
      return `print(result if result is not None else "")`;
    case "intArray":
      return `print(" ".join(str(x) for x in (result or [])))`;
    case "stringArray":
      return `_arr = sorted(result or [])\n    print(len(_arr))\n    for _w in _arr:\n        print(_w)`;
    case "doubleArray":
      return `for _v in (result or []):\n        print(f"{float(_v):.6f}")`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function defaultReturnPy(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `return 0`;
    case "double":
      return `return 0.0`;
    case "bool":
      return `return False`;
    case "string":
      return `return ""`;
    case "intArray":
    case "stringArray":
    case "doubleArray":
      return `return []`;
    default:
      return `return None`;
  }
}

function buildPythonParts(paramSpec, outputKind, userBody) {
  const readers = paramSpec.map((p) => "    " + pyReaderFor(p)).join("\n");
  const argNames = paramSpec.map((p) => p.name).join(", ");
  const body = userBody || `    # Write your solution here.\n    ${defaultReturnPy(outputKind)}`;

  const prefix = `import sys

_lines = sys.stdin.read().split("\\n")
_cursor = 0


def next_line():
    global _cursor
    if _cursor < len(_lines):
        line = _lines[_cursor]
        _cursor += 1
        return line
    return ""


`;

  const functionBlock = `def solve(${argNames}):
${body}`;

  const suffix = `


def main():
${readers}
    result = solve(${argNames})
    ${pyPrinter(outputKind)}


if __name__ == "__main__":
    main()
`;

  return { prefix, functionBlock, suffix };
}

function buildPythonStarter(paramSpec, outputKind, userBody) {
  const { prefix, functionBlock, suffix } = buildPythonParts(paramSpec, outputKind, userBody);
  return prefix + functionBlock + suffix;
}

/* ==================================================================== */
/* C++                                                                   */
/* ==================================================================== */

function cppType(type) {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "string":
      return "string";
    case "intArray":
      return "vector<int>";
    case "stringArray":
      return "vector<string>";
    case "grid":
      return "vector<vector<int>>";
    case "charGrid":
      return "vector<string>";
    case "intArrayList":
      return "vector<vector<int>>";
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

function cppOutType(outputKind) {
  switch (outputKind) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "bool":
      return "bool";
    case "string":
      return "string";
    case "intArray":
      return "vector<int>";
    case "stringArray":
      return "vector<string>";
    case "doubleArray":
      return "vector<double>";
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function cppReaderFor(param) {
  const { name, type } = param;
  switch (type) {
    case "int":
      return `int ${name} = stoi(nextLine());`;
    case "long":
      return `long long ${name} = stoll(nextLine());`;
    case "double":
      return `double ${name} = stod(nextLine());`;
    case "string":
      return `string ${name} = nextLine();`;
    case "intArray":
      return (
        `int ${name}_n = stoi(nextLine());\n` +
        `    vector<int> ${name}; if (${name}_n > 0) ${name} = splitInts(nextLine());`
      );
    case "stringArray":
      return (
        `int ${name}_n = stoi(nextLine());\n` +
        `    vector<string> ${name};\n` +
        `    for (int i = 0; i < ${name}_n; i++) ${name}.push_back(nextLine());`
      );
    case "grid":
      return (
        `int ${name}_rows, ${name}_cols;\n` +
        `    { istringstream hdr(nextLine()); hdr >> ${name}_rows >> ${name}_cols; }\n` +
        `    vector<vector<int>> ${name};\n` +
        `    for (int i = 0; i < ${name}_rows; i++) ${name}.push_back(splitInts(nextLine()));`
      );
    case "charGrid":
      return (
        `int ${name}_rows, ${name}_cols;\n` +
        `    { istringstream hdr(nextLine()); hdr >> ${name}_rows >> ${name}_cols; }\n` +
        `    vector<string> ${name};\n` +
        `    for (int i = 0; i < ${name}_rows; i++) ${name}.push_back(nextLine());`
      );
    case "intArrayList":
      return (
        `int ${name}_k = stoi(nextLine());\n` +
        `    vector<vector<int>> ${name};\n` +
        `    for (int i = 0; i < ${name}_k; i++) {\n` +
        `      int size = stoi(nextLine());\n` +
        `      ${name}.push_back(size > 0 ? splitInts(nextLine()) : vector<int>());\n` +
        `    }`
      );
    default:
      throw new Error(`Unsupported param type: ${type}`);
  }
}

function cppPrinter(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `cout << result << "\\n";`;
    case "double":
      return `cout << fixed << setprecision(6) << result << "\\n";`;
    case "bool":
      return `cout << (result ? "true" : "false") << "\\n";`;
    case "string":
      return `cout << result << "\\n";`;
    case "intArray":
      return (
        `for (size_t i = 0; i < result.size(); i++) { if (i) cout << ' '; cout << result[i]; }\n` +
        `    cout << "\\n";`
      );
    case "stringArray":
      return (
        `sort(result.begin(), result.end());\n` +
        `    cout << result.size() << "\\n";\n` +
        `    for (auto& w : result) cout << w << "\\n";`
      );
    case "doubleArray":
      return `for (auto& v : result) cout << fixed << setprecision(6) << v << "\\n";`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function defaultReturnCpp(outputKind) {
  switch (outputKind) {
    case "int":
      return `return 0;`;
    case "long":
      return `return 0LL;`;
    case "double":
      return `return 0.0;`;
    case "bool":
      return `return false;`;
    case "string":
      return `return "";`;
    case "intArray":
      return `return vector<int>();`;
    case "stringArray":
      return `return vector<string>();`;
    case "doubleArray":
      return `return vector<double>();`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function buildCppParts(paramSpec, outputKind, userBody) {
  const readers = paramSpec.map((p) => "    " + cppReaderFor(p)).join("\n");
  const argsDecl = paramSpec.map((p) => `${cppType(p.type)} ${p.name}`).join(", ");
  const argNames = paramSpec.map((p) => p.name).join(", ");
  const body = userBody || `    // Write your solution here.\n    ${defaultReturnCpp(outputKind)}`;

  const prefix = `#include <bits/stdc++.h>
using namespace std;

static vector<string> __lines;
static size_t __cursor = 0;

static string nextLine() {
  if (__cursor < __lines.size()) return __lines[__cursor++];
  return "";
}

static vector<int> splitInts(const string& s) {
  vector<int> out;
  stringstream ss(s);
  long long x;
  while (ss >> x) out.push_back((int)x);
  return out;
}

`;

  const functionBlock = `/**
 * ${buildSignatureComment(paramSpec, outputKind)}
 */
${cppOutType(outputKind)} solve(${argsDecl}) {
${body}
}`;

  const suffix = `

int main() {
  std::string __all((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  {
    size_t start = 0;
    for (size_t i = 0; i <= __all.size(); i++) {
      if (i == __all.size() || __all[i] == '\\n') {
        string line = __all.substr(start, i - start);
        if (!line.empty() && line.back() == '\\r') line.pop_back();
        __lines.push_back(line);
        start = i + 1;
      }
    }
  }

${readers}
  auto result = solve(${argNames});
  ${cppPrinter(outputKind)}
  return 0;
}
`;

  return { prefix, functionBlock, suffix };
}

function buildCppStarter(paramSpec, outputKind, userBody) {
  const { prefix, functionBlock, suffix } = buildCppParts(paramSpec, outputKind, userBody);
  return prefix + functionBlock + suffix;
}

/* ==================================================================== */
/* Java                                                                  */
/* ==================================================================== */

function javaType(type) {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "double":
      return "double";
    case "string":
      return "String";
    case "intArray":
      return "int[]";
    case "stringArray":
      return "String[]";
    case "grid":
      return "int[][]";
    case "charGrid":
      return "String[]";
    case "intArrayList":
      return "int[][]";
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

function javaOutType(outputKind) {
  switch (outputKind) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "double":
      return "double";
    case "bool":
      return "boolean";
    case "string":
      return "String";
    case "intArray":
      return "int[]";
    case "stringArray":
      return "String[]";
    case "doubleArray":
      return "double[]";
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function javaReaderFor(param) {
  const { name, type } = param;
  switch (type) {
    case "int":
      return `int ${name} = Integer.parseInt(nextLine().trim());`;
    case "long":
      return `long ${name} = Long.parseLong(nextLine().trim());`;
    case "double":
      return `double ${name} = Double.parseDouble(nextLine().trim());`;
    case "string":
      return `String ${name} = nextLine();`;
    case "intArray":
      return (
        `int ${name}_n = Integer.parseInt(nextLine().trim());\n` +
        `    int[] ${name} = ${name}_n > 0 ? parseIntArray(nextLine(), ${name}_n) : new int[0];`
      );
    case "stringArray":
      return (
        `int ${name}_n = Integer.parseInt(nextLine().trim());\n` +
        `    String[] ${name} = new String[${name}_n];\n` +
        `    for (int i = 0; i < ${name}_n; i++) ${name}[i] = nextLine();`
      );
    case "grid":
      return (
        `String[] ${name}_hdr = nextLine().trim().split("\\\\s+");\n` +
        `    int ${name}_rows = Integer.parseInt(${name}_hdr[0]);\n` +
        `    int ${name}_cols = Integer.parseInt(${name}_hdr[1]);\n` +
        `    int[][] ${name} = new int[${name}_rows][];\n` +
        `    for (int i = 0; i < ${name}_rows; i++) ${name}[i] = parseIntArray(nextLine(), ${name}_cols);`
      );
    case "charGrid":
      return (
        `String[] ${name}_hdr = nextLine().trim().split("\\\\s+");\n` +
        `    int ${name}_rows = Integer.parseInt(${name}_hdr[0]);\n` +
        `    int ${name}_cols = Integer.parseInt(${name}_hdr[1]);\n` +
        `    String[] ${name} = new String[${name}_rows];\n` +
        `    for (int i = 0; i < ${name}_rows; i++) ${name}[i] = nextLine();`
      );
    case "intArrayList":
      return (
        `int ${name}_k = Integer.parseInt(nextLine().trim());\n` +
        `    int[][] ${name} = new int[${name}_k][];\n` +
        `    for (int i = 0; i < ${name}_k; i++) {\n` +
        `      int size = Integer.parseInt(nextLine().trim());\n` +
        `      ${name}[i] = size > 0 ? parseIntArray(nextLine(), size) : new int[0];\n` +
        `    }`
      );
    default:
      throw new Error(`Unsupported param type: ${type}`);
  }
}

function javaPrinter(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `System.out.println(result);`;
    case "double":
      return `System.out.println(String.format("%.6f", result));`;
    case "bool":
      return `System.out.println(result ? "true" : "false");`;
    case "string":
      return `System.out.println(result == null ? "" : result);`;
    case "intArray":
      return (
        `StringBuilder __sb = new StringBuilder();\n` +
        `    for (int i = 0; i < result.length; i++) { if (i > 0) __sb.append(' '); __sb.append(result[i]); }\n` +
        `    System.out.println(__sb.toString());`
      );
    case "stringArray":
      return (
        `String[] __arr = result == null ? new String[0] : result;\n` +
        `    Arrays.sort(__arr);\n` +
        `    System.out.println(__arr.length);\n` +
        `    for (String w : __arr) System.out.println(w);`
      );
    case "doubleArray":
      return `for (double v : result) System.out.println(String.format("%.6f", v));`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function defaultReturnJava(outputKind) {
  switch (outputKind) {
    case "int":
      return `return 0;`;
    case "long":
      return `return 0L;`;
    case "double":
      return `return 0.0;`;
    case "bool":
      return `return false;`;
    case "string":
      return `return "";`;
    case "intArray":
      return `return new int[0];`;
    case "stringArray":
      return `return new String[0];`;
    case "doubleArray":
      return `return new double[0];`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function buildJavaParts(paramSpec, outputKind, userBody) {
  const readers = paramSpec.map((p) => "    " + javaReaderFor(p)).join("\n");
  const argsDecl = paramSpec.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
  const argNames = paramSpec.map((p) => p.name).join(", ");
  const body = userBody || `    // Write your solution here.\n    ${defaultReturnJava(outputKind)}`;

  const prefix = `import java.util.*;
import java.io.*;

public class Main {
  static List<String> __lines;
  static int __cursor = 0;

  static String nextLine() {
    if (__cursor < __lines.size()) return __lines.get(__cursor++);
    return "";
  }

  static int[] parseIntArray(String line, int expected) {
    if (expected <= 0) return new int[0];
    String[] parts = line.trim().split("\\\\s+");
    int[] out = new int[expected];
    for (int i = 0; i < expected && i < parts.length; i++) out[i] = Integer.parseInt(parts[i]);
    return out;
  }

`;

  const functionBlock = `  /**
   * ${buildSignatureComment(paramSpec, outputKind)}
   */
  static ${javaOutType(outputKind)} solve(${argsDecl}) {
${body}
  }`;

  const suffix = `

  public static void main(String[] args) throws Exception {
    BufferedReader __br = new BufferedReader(new InputStreamReader(System.in));
    __lines = new ArrayList<>();
    String __l;
    while ((__l = __br.readLine()) != null) __lines.add(__l);

${readers}
    ${javaOutType(outputKind)} result = solve(${argNames});
    ${javaPrinter(outputKind)}
  }
}
`;

  return { prefix, functionBlock, suffix };
}

function buildJavaStarter(paramSpec, outputKind, userBody) {
  const { prefix, functionBlock, suffix } = buildJavaParts(paramSpec, outputKind, userBody);
  return prefix + functionBlock + suffix;
}

/* ==================================================================== */
/* Rust                                                                  */
/* ==================================================================== */

function rustType(type) {
  switch (type) {
    case "int":
      return "i32";
    case "long":
      return "i64";
    case "double":
      return "f64";
    case "string":
      return "String";
    case "intArray":
      return "Vec<i32>";
    case "stringArray":
      return "Vec<String>";
    case "grid":
      return "Vec<Vec<i32>>";
    case "charGrid":
      return "Vec<String>";
    case "intArrayList":
      return "Vec<Vec<i32>>";
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

function rustOutType(outputKind) {
  switch (outputKind) {
    case "int":
      return "i32";
    case "long":
      return "i64";
    case "double":
      return "f64";
    case "bool":
      return "bool";
    case "string":
      return "String";
    case "intArray":
      return "Vec<i32>";
    case "stringArray":
      return "Vec<String>";
    case "doubleArray":
      return "Vec<f64>";
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function rustReaderFor(param) {
  const { name, type } = param;
  switch (type) {
    case "int":
      return `let ${name}: i32 = next_line().trim().parse().unwrap_or(0);`;
    case "long":
      return `let ${name}: i64 = next_line().trim().parse().unwrap_or(0);`;
    case "double":
      return `let ${name}: f64 = next_line().trim().parse().unwrap_or(0.0);`;
    case "string":
      return `let ${name}: String = next_line();`;
    case "intArray":
      return (
        `let ${name}_n: usize = next_line().trim().parse().unwrap_or(0);\n` +
        `    let ${name}: Vec<i32> = if ${name}_n > 0 { next_line().trim().split_whitespace().map(|x| x.parse().unwrap_or(0)).collect() } else { Vec::new() };`
      );
    case "stringArray":
      return (
        `let ${name}_n: usize = next_line().trim().parse().unwrap_or(0);\n` +
        `    let mut ${name}: Vec<String> = Vec::new();\n` +
        `    for _ in 0..${name}_n { ${name}.push(next_line()); }`
      );
    case "grid":
      return (
        `let ${name}_hdr = next_line();\n` +
        `    let mut ${name}_hdr_it = ${name}_hdr.trim().split_whitespace();\n` +
        `    let ${name}_rows: usize = ${name}_hdr_it.next().unwrap_or("0").parse().unwrap_or(0);\n` +
        `    let _${name}_cols: usize = ${name}_hdr_it.next().unwrap_or("0").parse().unwrap_or(0);\n` +
        `    let mut ${name}: Vec<Vec<i32>> = Vec::new();\n` +
        `    for _ in 0..${name}_rows { ${name}.push(next_line().trim().split_whitespace().map(|x| x.parse().unwrap_or(0)).collect()); }`
      );
    case "charGrid":
      return (
        `let ${name}_hdr = next_line();\n` +
        `    let mut ${name}_hdr_it = ${name}_hdr.trim().split_whitespace();\n` +
        `    let ${name}_rows: usize = ${name}_hdr_it.next().unwrap_or("0").parse().unwrap_or(0);\n` +
        `    let _${name}_cols: usize = ${name}_hdr_it.next().unwrap_or("0").parse().unwrap_or(0);\n` +
        `    let mut ${name}: Vec<String> = Vec::new();\n` +
        `    for _ in 0..${name}_rows { ${name}.push(next_line()); }`
      );
    case "intArrayList":
      return (
        `let ${name}_k: usize = next_line().trim().parse().unwrap_or(0);\n` +
        `    let mut ${name}: Vec<Vec<i32>> = Vec::new();\n` +
        `    for _ in 0..${name}_k {\n` +
        `      let size: usize = next_line().trim().parse().unwrap_or(0);\n` +
        `      if size > 0 { ${name}.push(next_line().trim().split_whitespace().map(|x| x.parse().unwrap_or(0)).collect()); } else { ${name}.push(Vec::new()); }\n` +
        `    }`
      );
    default:
      throw new Error(`Unsupported param type: ${type}`);
  }
}

function rustPrinter(outputKind) {
  switch (outputKind) {
    case "int":
    case "long":
      return `println!("{}", result);`;
    case "double":
      return `println!("{:.6}", result);`;
    case "bool":
      return `println!("{}", if result { "true" } else { "false" });`;
    case "string":
      return `println!("{}", result);`;
    case "intArray":
      return `println!("{}", result.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" "));`;
    case "stringArray":
      return `{ let mut arr = result.clone(); arr.sort(); println!("{}", arr.len()); for w in arr { println!("{}", w); } }`;
    case "doubleArray":
      return `for v in result { println!("{:.6}", v); }`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function defaultReturnRust(outputKind) {
  switch (outputKind) {
    case "int":
      return `return 0;`;
    case "long":
      return `return 0;`;
    case "double":
      return `return 0.0;`;
    case "bool":
      return `return false;`;
    case "string":
      return `return String::new();`;
    case "intArray":
      return `return Vec::new();`;
    case "stringArray":
      return `return Vec::new();`;
    case "doubleArray":
      return `return Vec::new();`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function buildRustParts(paramSpec, outputKind, userBody) {
  const readers = paramSpec.map((p) => "    " + rustReaderFor(p)).join("\n");
  const argsDecl = paramSpec.map((p) => `${p.name}: ${rustType(p.type)}`).join(", ");
  const argNames = paramSpec.map((p) => p.name).join(", ");
  const body = userBody || `    // Write your solution here.\n    ${defaultReturnRust(outputKind)}`;

  const prefix = `#![allow(non_snake_case, unused_variables, unused_mut)]
use std::io::{self, Read};

`;

  const functionBlock = `/**
 * ${buildSignatureComment(paramSpec, outputKind)}
 */
fn solve(${argsDecl}) -> ${rustOutType(outputKind)} {
${body}
}`;

  const suffix = `

fn main() {
  let mut input = String::new();
  io::stdin().read_to_string(&mut input).unwrap();
  let lines: Vec<String> = input.split('\\n').map(|l| l.trim_end_matches('\\r').to_string()).collect();
  let mut idx: usize = 0;
  let mut next_line = || -> String {
    if idx < lines.len() { let s = lines[idx].clone(); idx += 1; s } else { String::new() }
  };

${readers}
  let result = solve(${argNames});
  ${rustPrinter(outputKind)}
}
`;

  return { prefix, functionBlock, suffix };
}

function buildRustStarter(paramSpec, outputKind, userBody) {
  const { prefix, functionBlock, suffix } = buildRustParts(paramSpec, outputKind, userBody);
  return prefix + functionBlock + suffix;
}

/* ==================================================================== */
/* C                                                                     */
/* ==================================================================== */

function cReturnType(outputKind) {
  switch (outputKind) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "bool":
      return "int";
    case "string":
      return "char*";
    case "intArray":
      return "int*";
    case "stringArray":
      return "char**";
    case "doubleArray":
      return "double*";
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function cParamType(type) {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "string":
      return "char*";
    case "intArray":
      return "int*";
    case "stringArray":
      return "char**";
    case "grid":
      return "int**";
    case "charGrid":
      return "char**";
    case "intArrayList":
      return "int**";
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

function cIsArrayOutput(outputKind) {
  return outputKind === "intArray" || outputKind === "stringArray" || outputKind === "doubleArray";
}

function cReaderFor(param) {
  const { name, type } = param;
  switch (type) {
    case "int":
      return `int ${name} = atoi(nextLine());`;
    case "long":
      return `long long ${name} = atoll(nextLine());`;
    case "double":
      return `double ${name} = atof(nextLine());`;
    case "string":
      return `char* ${name} = nextLine();`;
    case "intArray":
      return (
        `int ${name}_n = atoi(nextLine());\n` +
        `    int* ${name} = ${name}_n > 0 ? parseIntsLine(nextLine(), ${name}_n) : NULL;`
      );
    case "stringArray":
      return (
        `int ${name}_n = atoi(nextLine());\n` +
        `    char** ${name} = (char**)malloc(sizeof(char*) * (${name}_n > 0 ? ${name}_n : 1));\n` +
        `    for (int i = 0; i < ${name}_n; i++) ${name}[i] = nextLine();`
      );
    case "grid":
      return (
        `int ${name}_rows, ${name}_cols;\n` +
        `    sscanf(nextLine(), "%d %d", &${name}_rows, &${name}_cols);\n` +
        `    int** ${name} = (int**)malloc(sizeof(int*) * (${name}_rows > 0 ? ${name}_rows : 1));\n` +
        `    for (int i = 0; i < ${name}_rows; i++) ${name}[i] = parseIntsLine(nextLine(), ${name}_cols);`
      );
    case "charGrid":
      return (
        `int ${name}_rows, ${name}_cols;\n` +
        `    sscanf(nextLine(), "%d %d", &${name}_rows, &${name}_cols);\n` +
        `    char** ${name} = (char**)malloc(sizeof(char*) * (${name}_rows > 0 ? ${name}_rows : 1));\n` +
        `    for (int i = 0; i < ${name}_rows; i++) ${name}[i] = nextLine();`
      );
    case "intArrayList":
      return (
        `int ${name}_k = atoi(nextLine());\n` +
        `    int** ${name} = (int**)malloc(sizeof(int*) * (${name}_k > 0 ? ${name}_k : 1));\n` +
        `    int* ${name}_sizes = (int*)malloc(sizeof(int) * (${name}_k > 0 ? ${name}_k : 1));\n` +
        `    for (int i = 0; i < ${name}_k; i++) {\n` +
        `      int size = atoi(nextLine());\n` +
        `      ${name}_sizes[i] = size;\n` +
        `      ${name}[i] = size > 0 ? parseIntsLine(nextLine(), size) : NULL;\n` +
        `    }`
      );
    default:
      throw new Error(`Unsupported param type: ${type}`);
  }
}

function cExtraArgs(param) {
  // Grid/array-list params additionally need an explicit count/size argument
  // because C has no way to know array length from a bare pointer.
  const { name, type } = param;
  if (type === "intArray" || type === "stringArray") {
    return [`${name}_n`];
  }
  if (type === "grid" || type === "charGrid") {
    return [`${name}_rows`, `${name}_cols`];
  }
  if (type === "intArrayList") {
    return [`${name}_k`, `${name}_sizes`];
  }
  return [];
}

function cExtraParamDecl(param) {
  const { name, type } = param;
  if (type === "intArray" || type === "stringArray") {
    return [`int ${name}_n`];
  }
  if (type === "grid" || type === "charGrid") {
    return [`int ${name}_rows`, `int ${name}_cols`];
  }
  if (type === "intArrayList") {
    return [`int ${name}_k`, `int* ${name}_sizes`];
  }
  return [];
}

function cPrinter(outputKind) {
  switch (outputKind) {
    case "int":
      return `printf("%d\\n", result);`;
    case "long":
      return `printf("%lld\\n", result);`;
    case "double":
      return `printf("%.6f\\n", result);`;
    case "bool":
      return `printf("%s\\n", result ? "true" : "false");`;
    case "string":
      return `printf("%s\\n", result ? result : "");`;
    case "intArray":
      return (
        `for (int i = 0; i < resultSize; i++) { if (i) printf(" "); printf("%d", result[i]); }\n` +
        `    printf("\\n");`
      );
    case "stringArray":
      return (
        `qsort(result, resultSize, sizeof(char*), __cmpStr);\n` +
        `    printf("%d\\n", resultSize);\n` +
        `    for (int i = 0; i < resultSize; i++) printf("%s\\n", result[i]);`
      );
    case "doubleArray":
      return `for (int i = 0; i < resultSize; i++) printf("%.6f\\n", result[i]);`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function defaultReturnC(outputKind) {
  switch (outputKind) {
    case "int":
      return `return 0;`;
    case "long":
      return `return 0;`;
    case "double":
      return `return 0.0;`;
    case "bool":
      return `return 0;`;
    case "string":
      return `return "";`;
    case "intArray":
    case "doubleArray":
      return `*resultSize = 0;\n    return NULL;`;
    case "stringArray":
      return `*resultSize = 0;\n    return NULL;`;
    default:
      throw new Error(`Unsupported output kind: ${outputKind}`);
  }
}

function buildCParts(paramSpec, outputKind, userBody) {
  const readers = paramSpec.map((p) => "    " + cReaderFor(p)).join("\n");

  const solveParamDecls = [];
  const callArgs = [];
  for (const p of paramSpec) {
    solveParamDecls.push(`${cParamType(p.type)} ${p.name}`);
    callArgs.push(p.name);
    for (const extra of cExtraParamDecl(p)) solveParamDecls.push(extra);
    for (const extra of cExtraArgs(p)) callArgs.push(extra);
  }

  const isArrayOut = cIsArrayOutput(outputKind);
  if (isArrayOut) {
    solveParamDecls.push("int* resultSize");
  }

  const body = userBody || `    // Write your solution here.\n    ${defaultReturnC(outputKind)}`;

  const callLine = isArrayOut
    ? `int resultSize = 0;\n  ${cReturnType(outputKind)} result = solve(${callArgs.join(", ")}, &resultSize);`
    : `${cReturnType(outputKind)} result = solve(${callArgs.join(", ")});`;

  const prefix = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define __MAXLINES 200000
static char* __lines[__MAXLINES];
static int __lineCount = 0;
static int __cursor = 0;

static int __cmpStr(const void* a, const void* b) {
  return strcmp(*(const char**)a, *(const char**)b);
}

static char* nextLine(void) {
  if (__cursor < __lineCount) return __lines[__cursor++];
  return "";
}

static char* __dupString(const char* src) {
  size_t len = strlen(src);
  char* copy = (char*)malloc(len + 1);
  memcpy(copy, src, len + 1);
  return copy;
}

static int* parseIntsLine(const char* line, int expected) {
  if (expected <= 0) return NULL;
  int* out = (int*)malloc(sizeof(int) * expected);
  char* copy = __dupString(line);
  char* tok = strtok(copy, " \\t");
  int i = 0;
  while (tok != NULL && i < expected) {
    out[i++] = atoi(tok);
    tok = strtok(NULL, " \\t");
  }
  free(copy);
  return out;
}

static void __slurpStdin(void) {
  size_t cap = 1 << 20;
  char* buf = (char*)malloc(cap);
  size_t len = 0;
  size_t r;
  while ((r = fread(buf + len, 1, cap - len, stdin)) > 0) {
    len += r;
    if (len == cap) {
      cap *= 2;
      buf = (char*)realloc(buf, cap);
    }
  }
  buf[len] = '\\0';

  size_t start = 0;
  for (size_t i = 0; i <= len; i++) {
    if (i == len || buf[i] == '\\n') {
      size_t lineLen = i - start;
      char* line = (char*)malloc(lineLen + 1);
      memcpy(line, buf + start, lineLen);
      line[lineLen] = '\\0';
      if (lineLen > 0 && line[lineLen - 1] == '\\r') line[lineLen - 1] = '\\0';
      if (__lineCount < __MAXLINES) __lines[__lineCount++] = line;
      start = i + 1;
    }
  }
}

`;

  const functionBlock = `/**
 * ${buildSignatureComment(paramSpec, outputKind)}
 */
${cReturnType(outputKind)} solve(${solveParamDecls.join(", ")}) {
${body}
}`;

  const suffix = `

int main(void) {
  __slurpStdin();
${readers}
  ${callLine}
  ${cPrinter(outputKind)}
  return 0;
}
`;

  return { prefix, functionBlock, suffix };
}

function buildCStarter(paramSpec, outputKind, userBody) {
  const { prefix, functionBlock, suffix } = buildCParts(paramSpec, outputKind, userBody);
  return prefix + functionBlock + suffix;
}

/* ==================================================================== */

function buildAllStarters(paramSpec, outputKind, bodies) {
  const b = bodies || {};
  return {
    c: buildCStarter(paramSpec, outputKind, b.c),
    cpp: buildCppStarter(paramSpec, outputKind, b.cpp),
    java: buildJavaStarter(paramSpec, outputKind, b.java),
    javascript: buildJavaScriptStarter(paramSpec, outputKind, b.javascript),
    python: buildPythonStarter(paramSpec, outputKind, b.python),
    rust: buildRustStarter(paramSpec, outputKind, b.rust)
  };
}

/**
 * Returns, per language, { prefix, functionBlock, suffix }. `functionBlock`
 * is the only part ever shown to (or editable by) the user - it is exactly
 * the `solve` function signature plus its body (a stub by default). `prefix`
 * and `suffix` are the hidden stdin/stdout harness and must never be sent to
 * the client; the full runnable program is `prefix + userEditedBlock +
 * suffix`.
 */
function buildAllStarterParts(paramSpec, outputKind, bodies) {
  const b = bodies || {};
  return {
    c: buildCParts(paramSpec, outputKind, b.c),
    cpp: buildCppParts(paramSpec, outputKind, b.cpp),
    java: buildJavaParts(paramSpec, outputKind, b.java),
    javascript: buildJavaScriptParts(paramSpec, outputKind, b.javascript),
    python: buildPythonParts(paramSpec, outputKind, b.python),
    rust: buildRustParts(paramSpec, outputKind, b.rust)
  };
}

module.exports = {
  buildAllStarters,
  buildAllStarterParts,
  buildCStarter,
  buildCppStarter,
  buildJavaStarter,
  buildJavaScriptStarter,
  buildPythonStarter,
  buildRustStarter,
  buildCParts,
  buildCppParts,
  buildJavaParts,
  buildJavaScriptParts,
  buildPythonParts,
  buildRustParts,
  buildSignatureComment
};
