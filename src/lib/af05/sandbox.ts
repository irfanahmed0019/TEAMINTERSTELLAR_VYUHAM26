/**
 * In-browser JavaScript exercise runner.
 *
 * Threat model: a student runs their OWN exercise code in their OWN browser,
 * so this is isolation for reliability and honest measurement, not a security
 * boundary against hostile third-party code. Code executes in a dedicated Web
 * Worker (separate thread, no DOM) with network and storage entry points
 * (fetch, XMLHttpRequest, WebSocket, importScripts, indexedDB, caches)
 * disabled before user code runs, plus a hard timeout. Tests execute for real
 * and their results are the only test evidence the Assessment Agent accepts.
 */
import type { PracticalSpec } from "./diagnostic";

export type RunResult = {
  ok: boolean;
  passed: number;
  total: number;
  failures: { args: unknown[]; expected: unknown; received: unknown }[];
  error?: string;
  durationMs: number;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

const WORKER_SOURCE = `
"use strict";
// Disable network and storage before any student code runs.
const blocked = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches"];
for (const name of blocked) {
  try {
    Object.defineProperty(self, name, {
      get() { throw new Error(name + " is disabled inside the exercise runner"); },
      configurable: true,
    });
  } catch (e) { /* property may be non-configurable; worker still isolates DOM */ }
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  var keys = Object.keys(value).sort();
  return "{" + keys.map(function (k) { return JSON.stringify(k) + ":" + stableStringify(value[k]); }).join(",") + "}";
}

self.onmessage = function (event) {
  var data = event.data;
  var failures = [];
  var passed = 0;
  var error;
  try {
    var factory = new Function(data.code + "\\n;return " + data.functionName + ";");
    var fn = factory();
    if (typeof fn !== "function") {
      throw new Error("No function called " + data.functionName + " was defined.");
    }
    for (var i = 0; i < data.tests.length; i++) {
      var test = data.tests[i];
      var received;
      try {
        received = fn.apply(null, JSON.parse(JSON.stringify(test.args)));
      } catch (runError) {
        received = "THREW: " + (runError && runError.message ? runError.message : String(runError));
        failures.push({ args: test.args, expected: test.expected, received: received });
        continue;
      }
      if (stableStringify(received) === stableStringify(test.expected)) {
        passed += 1;
      } else {
        failures.push({ args: test.args, expected: test.expected, received: received });
      }
    }
  } catch (outer) {
    error = outer && outer.message ? outer.message : String(outer);
  }
  self.postMessage({
    passed: passed,
    total: data.tests.length,
    failures: failures,
    error: error,
  });
};
`;

export async function runPractical(
  code: string,
  spec: PracticalSpec,
  timeoutMs = 4000,
): Promise<RunResult> {
  const started = Date.now();
  const total = spec.tests.length;

  if (
    typeof Worker === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined"
  ) {
    return {
      ok: false,
      passed: 0,
      total,
      failures: [],
      error: "This browser cannot run the exercise runner.",
      durationMs: 0,
    };
  }

  const blob = new Blob([WORKER_SOURCE], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  try {
    const result = await new Promise<Omit<RunResult, "ok" | "durationMs">>(
      (resolve) => {
        const timer = setTimeout(() => {
          resolve({
            passed: 0,
            total,
            failures: [],
            error: `Time limit exceeded (${timeoutMs / 1000}s). Check for infinite loops.`,
          });
        }, timeoutMs);
        worker.onmessage = (event) => {
          clearTimeout(timer);
          resolve(event.data as Omit<RunResult, "ok" | "durationMs">);
        };
        worker.onerror = (event) => {
          clearTimeout(timer);
          resolve({
            passed: 0,
            total,
            failures: [],
            error: event.message || "The code could not run.",
          });
        };
        worker.postMessage({
          code,
          functionName: spec.functionName,
          tests: spec.tests,
        });
      },
    );

    return {
      ok: !result.error && result.passed === result.total,
      ...result,
      durationMs: Date.now() - started,
    };
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}

/** Weight for competency evidence: 3 only when every test really passed. */
export function practicalWeight(passed: number, total: number): number {
  if (total === 0) return 0;
  if (passed === total) return 3;
  if (passed >= Math.ceil(total / 2)) return 1;
  return 0;
}

export { stableStringify };
