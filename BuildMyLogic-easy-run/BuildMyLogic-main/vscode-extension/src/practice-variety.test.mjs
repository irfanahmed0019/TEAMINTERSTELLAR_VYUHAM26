import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const programs = {
  "python-loops-triangular-v1":
    "n=int(input())\ns=0\nfor i in range(1,n+1): s+=i\nprint(s)",
  "python-loops-multiples3-v1":
    "n=int(input())\ns=0\nfor i in range(1,n+1):\n if i%3==0:s+=1\nprint(s)",
  "python-conditions-vote-v1":
    'n=int(input())\nif n>=18:print("eligible")\nelse:print("underage")',
  "python-conditions-pass-v1":
    'n=int(input())\nif n>=50:print("pass")\nelse:print("retry")',
  "python-functions-square-v1":
    "def square(n):return n*n\nprint(square(int(input())))",
  "python-functions-negate-v1":
    "def negate(n):return -n\nprint(negate(int(input())))",
  "python-strings-uppercase-v1":
    'n=0\nfor c in input():\n if "A"<=c<="Z":n+=1\nprint(n)',
  "python-strings-consonants-v1":
    'n=0\nfor c in input():\n if "a"<=c<="z" and c not in "aeiou":n+=1\nprint(n)',
};
test("eight distinct authored task evaluators run real correct/wrong/no-construct programs; sibling known answers fail", () => {
  const dir = mkdtempSync(join(tmpdir(), "bml-variety-")),
    file = join(dir, "learner's k.py"),
    script = resolve("media/python_loops_practice.py");
  const run = (id, source) => {
    writeFileSync(file, source);
    return spawnSync("python3", ["-I", script, id, file], {
      cwd: dir,
      encoding: "utf8",
      timeout: 18000,
    });
  };
  try {
    const entries = Object.entries(programs);
    for (const [id, right] of entries) {
      let r = run(id, right);
      assert.equal(r.status, 0, id + r.stdout + r.stderr);
      assert.ok(r.stdout.includes("BML_PRACTICE_PASS:" + id));
      r = run(id, right.replace(/print\([^\n]*\)/g, 'print("WRONG")'));
      assert.equal(r.status, 1, id + r.stdout);
      assert.ok(!r.stdout.includes("BML_PRACTICE_PASS:"));
      r = run(id, "print(0)");
      assert.equal(r.status, 1, id + r.stdout);
      const sibling = entries.find(
        ([other]) => other !== id && other.split("-")[1] === id.split("-")[1],
      );
      r = run(id, sibling[1]);
      assert.equal(r.status, 1, id + " must reject sibling answer " + r.stdout);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("beginner arithmetic uses real inputs and addition, rejects hardcoded or wrong answers",()=>{
 const dir=mkdtempSync(join(tmpdir(),"bml-add-")),file=join(dir,"main.py"),script=resolve("media/python_loops_practice.py");
 try { for(const [source,code] of [["a=int(input())\nb=int(input())\nprint(a+b)",0],["print(12)",1],["a=int(input())\nb=int(input())\nprint(a-b)",1]]) {writeFileSync(file,source);const r=spawnSync("python3",["-I",script,"python-arithmetic-add-v1",file],{encoding:"utf8"});assert.equal(r.status,code,r.stdout+r.stderr);}}finally{rmSync(dir,{recursive:true,force:true});}
});
