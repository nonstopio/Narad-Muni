"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plug, Copy, Check, BookOpen } from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface McpStatus {
  registered: boolean;
  binaryPath: string | null;
  configPath: string;
  binaryExists: boolean;
}

interface McpTool {
  name: string;
  description: string;
}

interface McpTestResult {
  success: boolean;
  tools?: McpTool[];
  error?: string;
}

export function McpStatusCard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
    tools?: McpTool[];
  } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
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
    } catch (err) {
      console.error("[Narada] McpStatusCard handleTest:", err);
      setTestResult({
        type: "error",
        message: "Alas! Could not test the sacred link",
      });
    } finally {
      setTesting(false);
    }
  };

  const setupPrompt = `Add "Narad Muni" as an MCP server in this project.

The app exposes an MCP server via its binary with the --mcp flag.

Binary locations:
- macOS: /Applications/Narad Muni.app/Contents/MacOS/Narad Muni
- Windows: Check Program Files or the user's AppData for "Narad Muni"

Find the binary on this machine, verify it exists, then add it to the project's MCP config (.mcp.json) like this:

{
  "mcpServers": {
    "narada": {
      "command": "<path-to-binary>",
      "args": ["--mcp"]
    }
  }
}`;

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

      {/* Test result modal — portaled to body to escape stacking context */}
      {testResult && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setTestResult(null)}
          />
          <div className="relative p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl rounded-2xl border border-white/[0.08] bg-[#12121ae6] backdrop-blur-xl">
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
                <p className="text-xs text-narada-text-muted mb-2">Available tools:</p>
                <div className="space-y-2">
                  {testResult.tools.map((tool) => (
                    <div key={tool.name} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                      <span className="text-xs font-mono font-medium text-narada-primary">
                        {tool.name}
                      </span>
                      {tool.description && (
                        <p className="text-[11px] text-narada-text-muted mt-0.5 leading-relaxed">
                          {tool.description}
                        </p>
                      )}
                    </div>
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
        </div>,
        document.body
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
              MCP Setup
            </h3>
            <p className="text-xs text-narada-text-secondary mb-5">
              Works with any MCP-compatible assistant — Claude Code, Cursor, Windsurf, etc.
            </p>

            {/* Prompt — the primary action */}
            <div>
              <p className="text-xs text-narada-text-secondary mb-2">
                Copy this prompt and paste it into your coding assistant. It will find the binary and configure everything automatically:
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

            {/* Available tools */}
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <p className="text-xs font-medium text-narada-text mb-2">
                Available tools
              </p>
              <div className="space-y-1">
                {[
                  { name: "log_work", desc: "Log a work entry to the daily draft" },
                  { name: "get_draft", desc: "View draft entries and publish status" },
                  { name: "edit_draft", desc: "Replace draft content to fix mistakes" },
                  { name: "get_status", desc: "Check Slack/Teams/Jira publish results" },
                ].map((tool) => (
                  <div key={tool.name} className="flex items-baseline gap-2 text-xs">
                    <code className="font-mono text-narada-primary text-[11px] shrink-0">
                      {tool.name}
                    </code>
                    <span className="text-narada-text-muted">&mdash; {tool.desc}</span>
                  </div>
                ))}
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
