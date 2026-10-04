/**
 * Self-check for the auto-update controller. Run: npx tsx electron/updater.test.ts
 * A broken state machine here means duplicate prompts or an install the user never asked for.
 */

import assert from "node:assert";
import { EventEmitter } from "node:events";
import { createUpdateController } from "./updater";

const flush = () => new Promise((r) => setImmediate(r));

function setup(opts: { isSupported?: boolean; response?: number; checkResult?: () => Promise<any>; answer?: () => Promise<{ response: number }> } = {}) {
  const calls: string[] = [];
  const dialogs: { type?: string; message: string; buttons?: string[] }[] = [];
  const timeouts: { fn: () => void; ms: number }[] = [];
  const intervals: { fn: () => void; ms: number }[] = [];
  const updater = Object.assign(new EventEmitter(), {
    checks: 0,
    checkForUpdates() {
      this.checks++;
      return opts.checkResult ? opts.checkResult() : Promise.resolve({ downloadPromise: null });
    },
    quitAndInstall(isSilent?: boolean, forceRun?: boolean) {
      calls.push(`quitAndInstall(${isSilent},${forceRun})`);
    },
  });
  const c = createUpdateController({
    updater,
    isSupported: opts.isSupported ?? true,
    showMessageBox: async (o) => {
      dialogs.push({ type: o.type, message: o.message, buttons: o.buttons });
      if (o.buttons && opts.answer) return opts.answer();
      return { response: o.buttons ? opts.response ?? 1 : 0 };
    },
    getVersion: () => "1.0.0",
    log: { info: () => {}, error: () => {} },
    onBeforeRestart: () => calls.push("onBeforeRestart"),
    onRestartAborted: () => calls.push("onRestartAborted"),
    setTimeout: (fn, ms) => (timeouts.push({ fn, ms }), timeouts.length),
    setInterval: (fn, ms) => (intervals.push({ fn, ms }), intervals.length),
    clearTimeout: () => {},
  });
  const prompts = () => dialogs.filter((d) => d.buttons?.includes("Restart and Install"));
  return { c, updater, calls, dialogs, timeouts, intervals, prompts };
}

async function main() {
  // Unsupported (dev/store) builds: no checks, manual gets an info dialog.
  {
    const t = setup({ isSupported: false });
    t.c.start();
    t.c.checkManual();
    await flush();
    assert.strictEqual(t.updater.checks, 0);
    assert.strictEqual(t.timeouts.length + t.intervals.length, 0);
    assert.strictEqual(t.dialogs.length, 1);
    assert.strictEqual(t.dialogs[0].type, "info");
  }

  // Manual check, up to date.
  {
    const t = setup();
    t.c.checkManual();
    t.updater.emit("update-not-available", { version: "1.0.0" });
    await flush();
    assert.strictEqual(t.updater.checks, 1);
    assert.match(t.dialogs[0].message, /latest/);
    assert.strictEqual(t.c.getState(), "idle");
  }

  // Concurrent manual checks while checking / downloading: "in progress", no second check.
  {
    const t = setup();
    t.c.checkManual();
    t.c.checkManual();
    assert.match(t.dialogs[0].message, /already/);
    t.updater.emit("update-available", { version: "2.0.0" });
    t.updater.emit("download-progress", { percent: 42.4 });
    t.c.checkManual();
    await flush();
    assert.strictEqual(t.updater.checks, 1);
    assert.match(t.dialogs[1].message, /on its way|background/i);
    assert.match(t.dialogs[2].message, /42%/);
  }

  // Background check finds update -> downloads -> exactly one prompt despite more ticks.
  {
    const t = setup();
    t.c.start();
    assert.deepStrictEqual(t.timeouts.map((x) => x.ms), [10_000]);
    assert.deepStrictEqual(t.intervals.map((x) => x.ms), [6 * 60 * 60 * 1000]);
    t.timeouts[0].fn();
    t.updater.emit("update-available", { version: "2.0.0" });
    t.intervals[0].fn(); // tick while downloading
    t.updater.emit("update-downloaded", { version: "2.0.0" });
    t.intervals[0].fn();
    t.intervals[0].fn();
    await flush();
    assert.strictEqual(t.updater.checks, 1);
    assert.strictEqual(t.dialogs.length, 1, "background found update: no dialog but the prompt");
    assert.strictEqual(t.prompts().length, 1);
    assert.strictEqual(t.c.getState(), "downloaded");
    // "Later" (default response 1): nothing installs.
    assert.deepStrictEqual(t.calls, []);

    // Manual check when downloaded -> re-prompt.
    t.c.checkManual();
    await flush();
    assert.strictEqual(t.prompts().length, 2);
    assert.strictEqual(t.updater.checks, 1);
  }

  // Background download failure: idle, no dialog, one retry scheduled (not stacked).
  {
    const t = setup();
    t.c.start();
    t.timeouts[0].fn();
    t.updater.emit("update-available", { version: "2.0.0" });
    t.updater.emit("error", new Error("download broke"));
    t.updater.emit("error", new Error("again"));
    await flush();
    assert.strictEqual(t.c.getState(), "idle");
    assert.strictEqual(t.dialogs.length, 0);
    const retries = t.timeouts.filter((x) => x.ms === 30 * 60 * 1000);
    assert.strictEqual(retries.length, 1);
    retries[0].fn();
    assert.strictEqual(t.updater.checks, 2, "retry re-checks");
  }

  // Manual check failure: check rejects AND emits 'error' -> exactly one dialog.
  {
    const err = new Error("offline");
    let t: ReturnType<typeof setup>;
    t = setup({
      checkResult: () => {
        t.updater.emit("error", err);
        return Promise.reject(err);
      },
    });
    t.c.checkManual();
    await flush();
    assert.strictEqual(t.dialogs.length, 1);
    assert.strictEqual(t.dialogs[0].type, "error");
    assert.strictEqual(t.c.getState(), "idle");
    assert.strictEqual(t.timeouts.length, 0, "manual failure needs no background retry");
  }

  // Background check failure (reject + 'error'): no dialog, single retry.
  {
    const err = new Error("offline");
    let t: ReturnType<typeof setup>;
    t = setup({
      checkResult: () => {
        t.updater.emit("error", err);
        return Promise.reject(err);
      },
    });
    t.c.start();
    t.timeouts[0].fn();
    await flush();
    assert.strictEqual(t.dialogs.length, 0);
    assert.strictEqual(t.timeouts.filter((x) => x.ms === 30 * 60 * 1000).length, 1);
  }

  // "Restart and Install": onBeforeRestart before quitAndInstall(false, true); error after -> abort + dialog.
  {
    const t = setup({ response: 0 });
    t.c.checkManual();
    t.updater.emit("update-available", { version: "2.0.0" });
    t.updater.emit("update-downloaded", { version: "2.0.0" });
    await flush();
    assert.deepStrictEqual(t.calls, ["onBeforeRestart", "quitAndInstall(false,true)"]);
    const before = t.dialogs.length;
    t.updater.emit("error", new Error("Squirrel rejected"));
    await flush();
    assert.strictEqual(t.calls[2], "onRestartAborted");
    assert.strictEqual(t.dialogs.length, before + 1);
    assert.strictEqual(t.dialogs[before].type, "error");
    assert.strictEqual(t.c.getState(), "idle");
  }

  // Manual check whose download then fails: the user who asked hears about it.
  {
    const t = setup();
    t.c.checkManual();
    t.updater.emit("update-available", { version: "2.0.0" });
    t.updater.emit("error", new Error("download broke"));
    await flush();
    assert.deepStrictEqual(t.dialogs.map((d) => d.type), ["info", "error"]);
    assert.strictEqual(t.c.getState(), "idle");
  }

  // Manual re-check while the restart prompt is still open: no second prompt.
  {
    let answer: (r: { response: number }) => void = () => {};
    const t = setup({ answer: () => new Promise((r) => (answer = r)) });
    const c = t.c;
    c.checkManual();
    t.updater.emit("update-available", { version: "2.0.0" });
    t.updater.emit("update-downloaded", { version: "2.0.0" });
    c.checkManual();
    await flush();
    assert.strictEqual(t.prompts().length, 1);
    answer({ response: 1 }); // Later
    await flush();
    c.checkManual(); // after closing, an explicit request re-prompts
    await flush();
    assert.strictEqual(t.prompts().length, 2);
    assert.deepStrictEqual(t.calls, []);
  }

  // main.ts close-to-hide must let the updater through once quitting is flagged.
  {
    const fs = await import("node:fs");
    const main = fs.readFileSync(require.resolve("./main.ts"), "utf8");
    assert.match(main, /if \(!isQuitting\) \{\s*e\.preventDefault\(\);/);
    assert.match(main, /onBeforeRestart: \(\) => \{ isQuitting = true; \}/);
    assert.match(main, /onRestartAborted: \(\) => \{ isQuitting = false; \}/);
    assert.match(main, /"before-quit-for-update", \(\) => \{ isQuitting = true; \}/);
  }

  console.log("updater: all assertions passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
