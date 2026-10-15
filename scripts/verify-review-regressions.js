/* eslint-disable @typescript-eslint/no-unused-expressions -- Executed by Playwright MCP. */
(async (page) => {
  const base = "http://127.0.0.1:3947", uid = "performance-fixture", day = "2026-10-26";
  const key = `narada.drafts.${uid}.${day}`;
  const draft = { rawTranscript: "Submitted text", draftSource: "manual", workedHours: 8, slackOutput: "Preview", teamsOutput: "", workLogEntries: [], previewReady: true, metricsHints: null, slackEnabled: true, teamsEnabled: false, jiraEnabled: false, revision: "clean", syncedRevision: "clean", cloudReady: true };
  let cloudText = "New cloud text", cloudDelay = 0, releasePublish, publishStarted = false, conflict = false, retryBody;
  const entry = { issueKey: "PROJ-1", timeSpentSecs: 1800, started: `${day}T10:30:00.000Z`, comment: "server", isRepeat: false };
  const serverEntries = [{ ...entry, id: "first", jiraWorklogId: "receipt-42" }, { ...entry, id: "second", jiraWorklogId: null }];
  const update = { id: day, date: `${day}T00:00:00.000Z`, rawTranscript: "Submitted text", slackOutput: "Preview", teamsOutput: "", slackStatus: "SENT", teamsStatus: "SKIPPED", jiraStatus: "FAILED", workLogEntries: serverEntries };
  await page.unroute("**/api/**");
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname === "/api/settings") return route.fulfill({ json: { configs: [{ id: "SLACK", platform: "SLACK", isActive: true }, { id: "JIRA", platform: "JIRA", isActive: true, baseUrl: "https://fixture.invalid" }] } });
    if (url.pathname === "/api/leaves") return route.fulfill({ json: { onLeave: false, leaves: [], holidays: [] } });
    if (url.pathname === "/api/drafts") {
      if (req.method() !== "GET") return route.fulfill({ status: 503, json: {} });
      await new Promise(r => setTimeout(r, cloudDelay));
      return route.fulfill({ json: { draft: { rawTranscript: cloudText, source: "manual" } } });
    }
    if (url.pathname === "/api/updates" && req.method() === "POST") {
      publishStarted = true;
      if (conflict) return route.fulfill({ status: 409, json: { success: false, error: "Different update already exists for this day" } });
      await new Promise(r => { releasePublish = r; });
      return route.fulfill({ json: { success: true, update: { ...update, jiraStatus: "SKIPPED" } } });
    }
    if (url.pathname === "/api/updates" && req.method() === "PUT") {
      retryBody = req.postDataJSON();
      return route.fulfill({ json: { success: true, update: { ...update, jiraStatus: "SENT" } } });
    }
    if (url.pathname === "/api/updates" && url.searchParams.has("id")) return route.fulfill({ json: { update } });
    return route.fulfill({ json: { success: true, updates: [], leaves: [], holidays: [], streak: 0 } });
  });
  const seed = async value => { await page.goto(base); await page.getByText("Devotion Streak", { exact: true }).waitFor(); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value }); };
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const input = page.getByPlaceholder("What deeds did you accomplish today?", { exact: false });
  const slack = page.getByPlaceholder("The scroll for Slack will materialize once the sage has spoken...");
  await seed(draft);
  await page.goto(`${base}/update?date=${day}`);
  await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some(e => e.value === "New cloud text"));
  if ((await read()).previewReady) throw new Error("Changed cloud text retained a stale preview");
  cloudText = "Submitted text";
  await seed(draft); await page.goto(`${base}/update?date=${day}`); await slack.waitFor();
  await page.waitForTimeout(300);
  if (await slack.inputValue() !== "Preview") throw new Error("Same cloud text erased edited preview");
  cloudDelay = 1000;
  await seed(draft); await page.goto(`${base}/update?date=${day}`); await input.waitFor();
  await input.fill("Typed while cloud refresh pending");
  await page.waitForTimeout(1200);
  if (await input.inputValue() !== "Typed while cloud refresh pending") throw new Error("Refresh overwrote typing");
  cloudDelay = 0;
  await seed({ ...draft, syncedRevision: undefined }); await page.goto(`${base}/update?date=${day}`); await slack.waitFor();
  await page.getByRole("button", { name: /Dispatch to All Worlds/ }).click();
  for (let i=0; !publishStarted && i<50; i++) await page.waitForTimeout(50);
  if (!publishStarted) throw new Error("Publish did not start");
  await input.fill("New unsent text typed during dispatch");
  releasePublish();
  await page.getByText("Published. Your newer edits remain saved on this device.", { exact: true }).waitFor();
  if ((await read()).rawTranscript !== "New unsent text typed during dispatch" || !page.url().includes("/update")) throw new Error("Publish discarded newer edits");
  conflict = true;
  await page.getByRole("button", { name: /Dispatch to All Worlds/ }).click();
  await page.getByText("Different update already exists for this day", { exact: true }).waitFor();
  if ((await read()).deleted || (await read()).rawTranscript !== "New unsent text typed during dispatch") throw new Error("Conflict lost draft");
  await seed({ ...draft, retryUpdateId: day, jiraEnabled: true, workLogEntries: serverEntries.map(e => ({ ...e, jiraWorklogId: null, comment: "local edit" })) });
  await page.goto(`${base}/update?date=${day}&retry=${day}`);
  await page.getByRole("heading", { name: "Retry Mode", exact: true }).waitFor();
  await page.getByRole("button", { name: "Add Entry" }).click();
  await page.getByPlaceholder("PROJ-123").last().fill("PROJ-3");
  const restored = await read();
  if (restored.workLogEntries.find(e => e.id === "first")?.jiraWorklogId !== "receipt-42") throw new Error("Stale retry erased server receipt");
  await page.getByRole("button", { name: /Retry/ }).last().click();
  await page.waitForTimeout(500);
  if (!retryBody?.workLogEntries.some(e => e.issueKey === "PROJ-3")) throw new Error("Added retry row missing from request");
  // A failed native handoff must block the editor rather than expose another owner's storage.
  await page.addInitScript(() => { window.narada = { setFirebaseUser: async () => { throw new Error("fixture handoff failure"); } }; });
  await page.goto(`${base}/update?date=${day}`);
  await page.getByRole("alert").filter({ hasText: "Your local drafts could not be opened safely" }).waitFor();
  if (await input.count()) throw new Error("Editor mounted after failed native handoff");
  return { passed: ["clean draft revalidates", "same-text refresh preserves preview", "refresh protects typing", "publish preserves newer edits", "same-day conflict preserves draft", "retry preserves fresh server receipt", "new retry row submitted", "failed desktop handoff blocks editing"] };
})
