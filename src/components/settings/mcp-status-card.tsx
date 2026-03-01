"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plug, Copy, Check, BookOpen, Sparkles } from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface McpStatus {
  registered: boolean;
  binaryPath: string | null;
  configPath: string;
  binaryExists: boolean;
}

interface McpTestResult {
  success: boolean;
  tools?: string[];
  error?: string;
}

export function McpStatusCard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
    tools?: string[];
  } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    authedFetch("/api/settings/mcp-status")
      .then((res) => res.json())
      .then((data: McpStatus) => setStatus(data))
      .catch((err) => {
        console.error("[McpStatusCard] Failed to load MCP status:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authedFetch("/api/settings/mcp-status", { method: "POST" });
      const data: McpTestResult = await res.json();

      if (data.success) {
        setTestResult({
          type: "success",
          message: `Narayan Narayan! The sacred link is alive — ${data.tools?.length || 0} tool${(data.tools?.length || 0) !== 1 ? "s" : ""} ready`,
          tools: data.tools,
        });
      } else {
        setTestResult({
          type: "error",
          message: `Alas! The link could not be forged: ${data.error}`,
        });
      }
    } catch {
      setTestResult({
        type: "error",
        message: "Alas! Could not test the sacred link",
      });
    } finally {
      setTesting(false);
    }
  };

  const truncatePath = (p: string, maxLen = 45) => {
    if (p.length <= maxLen) return p;
    return "..." + p.slice(-(maxLen - 3));
  };

  const mcpBinaryPath =
    status?.binaryPath ||
    "/Applications/Narad Muni.app/Contents/MacOS/Narad Muni";

  const mcpJsonSnippet = JSON.stringify(
    {
      mcpServers: {
        narada: {
          command: mcpBinaryPath,
          args: ["--mcp"],
        },
      },
    },
    null,
    2
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mcpJsonSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — select text if clipboard API unavailable
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(mcpBinaryPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {}
  };

  const setupPrompt = `Configure Narad Muni as an MCP server in this project. Create a .mcp.json file in the project root with this config:\n\n${mcpJsonSnippet}`;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(setupPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {}
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          <Plug className="w-4 h-4 text-narada-primary" />
        </div>
        <span>Divine Messenger Protocol</span>
      </div>

      <p className="text-xs text-narada-text-secondary mb-4">
        I can receive scrolls from AI sages in your code editor.
      </p>

      {/* Status + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status?.registered ? "bg-narada-emerald shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-white/20"
            }`}
          />
          <span className="text-sm text-narada-text">
            {status?.registered ? "Registered" : "Not registered"}
          </span>
        </div>
        {status?.registered && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs text-narada-text-secondary hover:text-narada-primary transition-colors disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test connection"}
          </button>
        )}
      </div>

      {/* Setup link */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <button
          onClick={() => setShowInstructions(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-narada-text-secondary hover:text-narada-text transition-colors py-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Setup Instructions
        </button>
      </div>

      {/* Test result modal */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setTestResult(null)}
          />
          <div className="relative glass-card p-6 max-w-sm w-full shadow-2xl border border-white/[0.08]">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  testResult.type === "success"
                    ? "bg-narada-emerald/10 text-narada-emerald"
                    : "bg-narada-rose/10 text-narada-rose"
                }`}
              >
                {testResult.type === "success" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                )}
              </div>
              <h3 className="text-sm font-semibold text-narada-text">
                {testResult.type === "success" ? "Sacred Link Active" : "Sacred Link Broken"}
              </h3>
            </div>
            <p className="text-xs text-narada-text-secondary leading-relaxed mb-2">
              {testResult.message}
            </p>
            {testResult.tools && testResult.tools.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-narada-text-muted mb-1">Available tools:</p>
                <div className="flex flex-wrap gap-1.5">
                  {testResult.tools.map((tool) => (
                    <span
                      key={tool}
                      className="text-xs font-mono px-2 py-0.5 rounded-md bg-narada-primary/10 text-narada-primary border border-narada-primary/20"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button
              variant={testResult.type === "success" ? "success-soft" : "danger-soft"}
              size="sm"
              onClick={() => setTestResult(null)}
              className="w-full"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Setup instructions modal — portaled to body to escape stacking context */}
      {showInstructions && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInstructions(false)}
          />
          <div className="relative p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl rounded-2xl border border-white/[0.08] bg-[#12121ae6] backdrop-blur-xl">
            <h3 className="text-base font-semibold text-narada-text mb-1">
              Summoning the Divine Messenger
            </h3>
            <p className="text-xs text-narada-text-secondary mb-5">
              Set up MCP in your coding assistant
            </p>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-narada-primary/15 text-narada-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-narada-text">
                    Locate the sacred binary
                  </p>
                  <p className="text-xs text-narada-text-secondary leading-relaxed mt-0.5 mb-2">
                    The Narad Muni app exposes an MCP server via its binary.
                    Your path:
                  </p>
                  <div className="flex items-center gap-2">
                    <code
                      className="text-[11px] font-mono text-narada-text-muted bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.06] truncate flex-1"
                      title={mcpBinaryPath}
                    >
                      {truncatePath(mcpBinaryPath)}
                    </code>
                    <button
                      onClick={handleCopyPath}
                      className="flex items-center gap-1 text-[10px] text-narada-text-muted hover:text-narada-text transition-colors shrink-0"
                      title="Copy path"
                    >
                      {copiedPath ? (
                        <Check className="w-3.5 h-3.5 text-narada-emerald" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-narada-violet/15 text-narada-violet flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-narada-text">
                    Add to your MCP config
                  </p>
                  <p className="text-xs text-narada-text-secondary leading-relaxed mt-0.5 mb-2">
                    Create a{" "}
                    <code className="text-[11px] font-mono text-narada-text-muted bg-white/[0.04] px-1 py-0.5 rounded">
                      .mcp.json
                    </code>{" "}
                    in your project root (or add to your assistant&apos;s global
                    MCP settings):
                  </p>
                  <div className="relative rounded-lg bg-black/40 border border-white/[0.06] overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
                      <span className="text-[10px] font-mono text-narada-text-muted">
                        .mcp.json
                      </span>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[10px] text-narada-text-muted hover:text-narada-text transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-narada-emerald" />
                            <span className="text-narada-emerald">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-[11px] font-mono text-narada-text-muted leading-relaxed overflow-x-auto">{mcpJsonSnippet}</pre>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-narada-emerald/15 text-narada-emerald flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium text-narada-text">
                    Restart &amp; invoke
                  </p>
                  <p className="text-xs text-narada-text-secondary leading-relaxed mt-0.5">
                    Restart your coding assistant. The{" "}
                    <code className="text-[11px] font-mono text-narada-text-muted bg-white/[0.04] px-1 py-0.5 rounded">
                      log_work
                    </code>{" "}
                    tool will be available &mdash; ask it to log your work.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Setup prompt section */}
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-narada-violet" />
                <span className="text-xs font-medium text-narada-text">
                  Or let your AI assistant do it
                </span>
              </div>
              <p className="text-xs text-narada-text-secondary mb-2">
                Copy this prompt and paste it into your coding assistant:
              </p>
              <div className="relative rounded-lg bg-black/40 border border-white/[0.06] overflow-hidden">
                <div className="flex items-center justify-end px-3 py-1.5 border-b border-white/[0.06]">
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 text-[10px] text-narada-text-muted hover:text-narada-text transition-colors"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3 h-3 text-narada-emerald" />
                        <span className="text-narada-emerald">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy prompt
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-narada-text-muted leading-relaxed overflow-x-auto whitespace-pre-wrap">{setupPrompt}</pre>
              </div>
            </div>

            <div className="mt-5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowInstructions(false)}
                className="w-full hover:border-narada-primary/50 hover:text-narada-text hover:bg-narada-primary/[0.05]"
              >
                Got it
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
