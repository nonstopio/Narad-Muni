/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright MCP executes this file as a function. */
(async (page) => {
  const uid = "performance-fixture";
  const base = "http://127.0.0.1:3947";
  const firstDay = "2026-10-21";
  const secondDay = "2026-10-22";
  const hydrationDay = "2026-10-23";
  let offline = false;
  let cloudWritesEnabled = false;
  const requests = [];
  const cloudWrites = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.unroute("**/api/**");
  await page.unroute("**/identitytoolkit.googleapis.com/**");
  await page.route("**/identitytoolkit.googleapis.com/**", (route) => route.fulfill({ json: { users: [{ localId: uid, email: "fixture@example.invalid", displayName: "Fixture User", emailVerified: true, providerUserInfo: [] }] } }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname + url.search, method: request.method() });
    if (offline) return route.abort("internetdisconnected");
    if (url.pathname === "/api/settings") return route.fulfill({ json: { configs: [{ id: "SLACK", platform: "SLACK", isActive: true, repeatEntries: [] }] } });
    if (url.pathname === "/api/leaves") return route.fulfill({ json: { onLeave: false, leaves: [], holidays: [] } });
    if (url.pathname === "/api/drafts") {
      if (request.method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 2200));
        return route.fulfill({ json: { draft: { rawTranscript: "Old cloud draft", source: "manual" } } });
      }
      if (!cloudWritesEnabled) return route.fulfill({ status: 503, json: { error: "fixture offline" } });
      cloudWrites.push({ method: request.method(), ...(request.method() === "PUT" ? request.postDataJSON() : {}) });
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname === "/api/parse") return route.fulfill({ json: { success: true, data: { slackFormat: "Generated preview", teamsFormat: "Generated teams", timeEntries: [], tasks: [], blockers: [] } } });
    return route.fulfill({ json: { success: true, updates: [], leaves: [], holidays: [], streak: 7 } });
  });
  await page.goto(base);
  await page.evaluate(async ({ uid, days }) => {
    const apiKey = "AIzaSyBS0kmYQfvMBj68riUwi8AkIMCIDtpQbIk";
    const authKey = `firebase:authUser:${apiKey}:[DEFAULT]`;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("firebaseLocalStorageDb", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const existing = await new Promise((resolve, reject) => {
      const request = db.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").get(authKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (existing?.value?.uid && existing.value.uid !== uid) { db.close(); throw new Error("Use an isolated Playwright profile; a real account must not be replaced."); }
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    const token = encode({ alg: "RS256", typ: "JWT" }) + "." + encode({ sub: uid, user_id: uid, aud: "narad-muni-14", iss: "https://securetoken.google.com/narad-muni-14", iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "google.com", identities: {} } }) + ".fixture";
    await new Promise((resolve, reject) => {
      const tx = db.transaction("firebaseLocalStorage", "readwrite");
      tx.objectStore("firebaseLocalStorage").put({ fbase_key: authKey, value: { uid, email: "fixture@example.invalid", emailVerified: true, displayName: "Fixture User", isAnonymous: false, providerData: [], stsTokenManager: { refreshToken: "fixture", accessToken: token, expirationTime: Date.now() + 3600000 }, apiKey, appName: "[DEFAULT]" } });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
    for (const day of days) localStorage.removeItem(`narada.drafts.${uid}.${day}`);
  }, { uid, days: [firstDay, secondDay, hydrationDay] });
  await page.reload();
  await page.getByText("Devotion Streak", { exact: true }).waitFor();
  await page.goto(`${base}/update?date=${firstDay}`);
  const input = page.getByPlaceholder("What deeds did you accomplish today?", { exact: false });
  const slack = page.getByPlaceholder("The scroll for Slack will materialize once the sage has spoken...");
  await input.waitFor();
  await input.fill("Last keystroke before Quit");
  const savedImmediately = await page.evaluate(({ uid, day }) => JSON.parse(localStorage.getItem(`narada.drafts.${uid}.${day}`)), { uid, day: firstDay });
  if (savedImmediately.rawTranscript !== "Last keystroke before Quit") throw new Error("Immediate local save failed");
  await page.waitForTimeout(2400);
  if (await input.inputValue() !== "Last keystroke before Quit") throw new Error("A late cloud read replaced typing");
  await page.getByRole("button", { name: "Invoke the Sage", exact: true }).click();
  await slack.waitFor();
  await slack.fill("Manually edited preview");
  await page.reload();
  await input.waitFor();
  if (await input.inputValue() !== "Last keystroke before Quit" || await slack.inputValue() !== "Manually edited preview") throw new Error("Reload lost text or preview");

  offline = true;
  await page.goto(base);
  await page.getByText("Devotion Streak", { exact: true }).waitFor();
  await page.goto(`${base}/update?date=${firstDay}`);
  await input.waitFor();
  await input.fill("Recovered after VPN reconnect");
  offline = false; cloudWritesEnabled = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(({ uid, day }) => {
    const draft = JSON.parse(localStorage.getItem(`narada.drafts.${uid}.${day}`));
    return draft?.syncedRevision === draft?.revision;
  }, { uid, day: firstDay });
  if (!cloudWrites.some((write) => write.date === firstDay && write.rawTranscript === "Recovered after VPN reconnect")) throw new Error("Reconnect failed to sync the latest revision");
  await page.goto(`${base}/update?date=${secondDay}`);
  await input.waitFor(); await input.fill("Separate day draft");
  await page.goto(`${base}/update?date=${firstDay}`);
  await input.waitFor();
  if (await input.inputValue() !== "Recovered after VPN reconnect") throw new Error("Date navigation mixed drafts");

  await page.goto(`${base}/update?date=${hydrationDay}`);
  await input.waitFor();
  await page.waitForTimeout(2500);
  if (await input.inputValue() !== "Old cloud draft") throw new Error("Portal metadata initialization hid the cloud draft");
  if (cloudWrites.some((write) => write.date === hydrationDay)) throw new Error("Metadata overwrote an unseen cloud draft");
  if (requests.some((request) => request.path === "/api/updates" && request.method === "GET")) throw new Error("Home downloaded unbounded history");
  if (pageErrors.length) throw new Error("Uncaught browser errors: " + pageErrors.join("; "));
  return { passed: ["immediate local draft save", "late response protection", "edited preview restoration", "cached pages with failed cloud requests", "reconnect synchronization", "per-day isolation", "safe metadata hydration", "no unbounded home history read"], interceptedRequests: requests.length };
})
