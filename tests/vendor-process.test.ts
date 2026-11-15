import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { execFileWithCleanup } from "../lib/exec-file";

test("aborting a crawler also terminates its browser child process", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "vendor-process-"));
  const pidFile = join(directory, "child.pid");
  const controller = new AbortController();
  const script = `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    require('node:fs').writeFileSync(process.argv[1],String(child.pid));setInterval(()=>{},1000);`;
  const running = execFileWithCleanup(process.execPath, ["-e", script, pidFile], {
    signal: controller.signal, timeout: 5000, maxBuffer: 1024,
  });
  // Attach the rejection handler before triggering cancellation.
  const rejected = assert.rejects(running, /abort/i);
  let childPid: number | undefined;
  try {
    const readyDeadline = Date.now() + 4000;
    while (!childPid && Date.now() < readyDeadline) {
      try { childPid = Number(await readFile(pidFile, "utf8")); }
      catch { await sleep(20); }
    }
    assert(childPid, "child process must start before cancellation");
    controller.abort();
    await rejected;
    let alive = true;
    const exitDeadline = Date.now() + 2000;
    while (alive && Date.now() < exitDeadline) {
      try { process.kill(childPid, 0); await sleep(20); }
      catch { alive = false; }
    }
    assert.equal(alive, false, "browser child must not survive the crawler");
  } finally {
    controller.abort();
    await rejected;
    if (childPid) { try { process.kill(childPid, "SIGKILL"); } catch { /* Already gone. */ } }
    await rm(directory, { recursive: true, force: true });
  }
});
