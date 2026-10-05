/** Self-check for errorMessage. Run: npx tsx src/lib/utils.test.ts */
import assert from "node:assert"
import { errorMessage } from "./utils"

// The OpenAI SDK's shape behind a TLS-intercepting proxy: the reason is two causes down.
const tls = Object.assign(new Error("unable to get local issuer certificate"), { code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" })
const err = new Error("Connection error.", { cause: new TypeError("fetch failed", { cause: tls }) })
assert.strictEqual(
  errorMessage(err),
  "Connection error. ← fetch failed ← unable to get local issuer certificate UNABLE_TO_GET_ISSUER_CERT_LOCALLY"
)

// Plain errors read exactly as before.
assert.strictEqual(errorMessage(new Error("plain")), "plain")
// A code already in the message isn't repeated (Node's "getaddrinfo ENOTFOUND host").
const dns = Object.assign(new Error("getaddrinfo ENOTFOUND x.test"), { code: "ENOTFOUND" })
assert.strictEqual(errorMessage(new TypeError("fetch failed", { cause: dns })), "fetch failed ← getaddrinfo ENOTFOUND x.test")
// Non-errors and empty messages fall back.
assert.strictEqual(errorMessage("nope"), "Unknown error")
assert.strictEqual(errorMessage(null, "Parsing failed"), "Parsing failed")
assert.strictEqual(errorMessage(new Error(""), "Test failed"), "Test failed")
// Non-string codes (HTTP statuses) are ignored, and cycles stop.
assert.strictEqual(errorMessage(Object.assign(new Error("bad"), { code: 401 })), "bad")
const loop = new Error("a") as Error & { cause?: unknown }
loop.cause = loop
assert.strictEqual(errorMessage(loop), "a")
console.log("utils: all assertions passed")
