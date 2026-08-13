"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Send, Trash2, Users, X, CalendarClock } from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/components/ui/toast";
import type {
  BroadcastCadence,
  BroadcastRecipient,
  BroadcastTemplateData,
} from "@/types";

interface SendResult {
  userId: string;
  name: string;
  ok: boolean;
  error?: string;
}

const CADENCES: { value: BroadcastCadence; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const BLANK: BroadcastTemplateData = {
  id: "",
  name: "",
  body: "",
  recipients: [],
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Searchable checkbox dropdown of workspace members. */
function RecipientPicker({
  members,
  selected,
  onChange,
  disabled,
}: {
  members: BroadcastRecipient[];
  selected: BroadcastRecipient[];
  onChange: (next: BroadcastRecipient[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const toggle = (m: BroadcastRecipient) => {
    onChange(
      selectedIds.has(m.id)
        ? selected.filter((s) => s.id !== m.id)
        : [...selected, m]
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="glass-input text-[13px] flex items-center gap-2 text-left disabled:opacity-50"
      >
        <Users size={14} className="text-narada-text-secondary shrink-0" />
        <span className={selected.length ? "text-narada-text" : "text-narada-text-secondary"}>
          {selected.length
            ? `${selected.length} soul${selected.length === 1 ? "" : "s"} chosen`
            : "Choose who shall receive this"}
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/[0.08] bg-narada-elevated shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
            <Search size={14} className="text-narada-text-secondary shrink-0" />
            <input
              autoFocus
              className="bg-transparent outline-none text-[13px] w-full text-narada-text placeholder:text-narada-text-secondary"
              placeholder="Search the workspace..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-narada-text-secondary text-center">
                No such soul walks this workspace
              </p>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-white/[0.04] cursor-pointer"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                    selectedIds.has(m.id)
                      ? "bg-narada-primary border-narada-primary text-white"
                      : "border-white/[0.15]"
                  }`}
                >
                  {selectedIds.has(m.id) ? "✓" : ""}
                </span>
                <span className="truncate">{m.name}</span>
                <span className="ml-auto font-mono text-[10px] text-narada-text-secondary/50">
                  {m.id}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.06] text-[11px]"
            >
              {s.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((r) => r.id !== s.id))}
                className="text-narada-text-secondary hover:text-narada-rose cursor-pointer"
                aria-label={`Remove ${s.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BroadcastClient() {
  const [templates, setTemplates] = useState<BroadcastTemplateData[]>([]);
  const [members, setMembers] = useState<BroadcastRecipient[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BroadcastTemplateData>(BLANK);
  const [cadence, setCadence] = useState<BroadcastCadence>("once");
  const [startDate, setStartDate] = useState(todayISO());
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const loadTemplates = useCallback(async () => {
    const res = await authedFetch("/api/broadcast");
    const data = await res.json();
    setTemplates(data.templates || []);
    return (data.templates || []) as BroadcastTemplateData[];
  }, []);

  useEffect(() => {
    loadTemplates().catch((err) =>
      console.error("[Narada] Failed to load templates:", err)
    );

    authedFetch("/api/broadcast/members")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setMembersError(d.error);
        setMembers(d.members || []);
      })
      .catch((err) => {
        console.error("[Narada] Failed to load members:", err);
        setMembersError("Alas! The roll of companions could not be read");
      });
  }, [loadTemplates]);

  const handleSave = async (): Promise<string | null> => {
    if (!draft.name.trim() || !draft.body.trim()) {
      addToast("A scroll needs both a name and words", "error");
      return null;
    }
    setSaving(true);
    try {
      const res = await authedFetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id || undefined,
          name: draft.name,
          body: draft.body,
          recipients: draft.recipients,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        addToast(data.error ?? "Alas! The scroll would not be inscribed", "error");
        return null;
      }
      // The save response carries no `scheduled` — keep what we already knew,
      // or the "N missives await their hour" banner disappears after every save.
      setDraft((prev) => ({ ...prev, ...data.template }));
      await loadTemplates();
      return data.template.id as string;
    } catch (err) {
      console.error("[Narada] BroadcastClient handleSave:", err);
      addToast("Alas! The scroll would not be inscribed", "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (draft.recipients.length === 0) {
      addToast("Name at least one soul to receive this scroll", "error");
      return;
    }
    // Always save first so the server sends exactly what you see.
    const id = await handleSave();
    if (!id) return;

    setSending(true);
    setResults(null);
    try {
      const res = await authedFetch("/api/broadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: id,
          cadence,
          startDate,
          time,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();

      if (data.results) setResults(data.results);

      if (!data.success) {
        addToast(data.error ?? "Alas! Not a single scroll found its way", "error");
      } else if (cadence === "once") {
        const sent = (data.results as SendResult[]).filter((r) => r.ok).length;
        addToast(`Narayan Narayan! Your word reached ${sent} soul${sent === 1 ? "" : "s"}`, "success");
      } else {
        addToast(
          `Narayan Narayan! ${data.scheduledCount} missives await their hour`,
          "success"
        );
        const list = await loadTemplates();
        const fresh = list.find((t) => t.id === id);
        if (fresh) setDraft(fresh);
      }
    } catch (err) {
      console.error("[Narada] BroadcastClient handleSend:", err);
      addToast("Alas! The Slack realm would not receive me", "error");
    } finally {
      setSending(false);
    }
  };

  const handleCancelScheduled = async () => {
    if (!draft.id) return;
    setSending(true);
    try {
      const res = await authedFetch(`/api/broadcast/send?templateId=${draft.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        addToast(`${data.cancelled} waiting missives withdrawn`, "success");
        const list = await loadTemplates();
        const fresh = list.find((t) => t.id === draft.id);
        if (fresh) setDraft(fresh);
      } else {
        addToast(data.error ?? "Alas! They could not be withdrawn", "error");
      }
    } catch (err) {
      console.error("[Narada] BroadcastClient handleCancelScheduled:", err);
      addToast("Alas! They could not be withdrawn", "error");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = templates.find((t) => t.id === id);
    const queued = target?.scheduled?.length ?? 0;
    if (
      !confirm(
        queued > 0
          ? `Burn "${target?.name}"? Its ${queued} waiting missives will be withdrawn too.`
          : `Burn "${target?.name}"? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await authedFetch(`/api/broadcast?id=${id}`, { method: "DELETE" });
      if (draft.id === id) setDraft(BLANK);
      await loadTemplates();
      addToast("The scroll has been burned", "success");
    } catch (err) {
      console.error("[Narada] BroadcastClient handleDelete:", err);
      addToast("Alas! The scroll resists the flame", "error");
    }
  };

  const pending = draft.scheduled?.length ?? 0;
  const busy = saving || sending;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h1 className="text-2xl font-semibold mb-1">Missives</h1>
      <p className="text-sm text-narada-text-secondary mb-6">
        Compose a scroll once, and I shall carry it to each soul by name.
      </p>

      {membersError && (
        <div className="glass-card p-4 mb-6 border border-narada-amber/30 text-[13px] text-narada-amber">
          {membersError}
        </div>
      )}

      <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-6">
        {/* Template list */}
        <div className="glass-card p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider">
              Scrolls
            </span>
            <button
              onClick={() => {
                setDraft(BLANK);
                setResults(null);
              }}
              className="text-narada-text-secondary hover:text-narada-text cursor-pointer"
              title="New scroll"
            >
              <Plus size={16} />
            </button>
          </div>

          {templates.length === 0 && (
            <p className="text-xs text-narada-text-secondary/60 py-2">
              No scrolls yet. Compose your first.
            </p>
          )}

          <div className="space-y-1">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                  draft.id === t.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                }`}
                onClick={() => {
                  setDraft(t);
                  setResults(null);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] truncate">{t.name}</p>
                  <p className="text-[10px] text-narada-text-secondary/60">
                    {t.recipients?.length || 0} recipients
                    {t.scheduled?.length ? ` · ${t.scheduled.length} queued` : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-narada-text-secondary hover:text-narada-rose cursor-pointer"
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="glass-card p-6">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              Scroll Name
            </label>
            <input
              className="glass-input text-[13px]"
              placeholder="Weekly nudge"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 mb-4">
            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                The Message
              </label>
              <textarea
                className="glass-input text-[13px] min-h-[320px] flex-1 resize-y font-mono"
                placeholder={"Hello {{first_name}}, a gentle reminder to log your hours."}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <p className="text-[11px] text-narada-text-secondary/60 mt-1">
                <code className="font-mono text-narada-violet/80">{"{{name}}"}</code> and{" "}
                <code className="font-mono text-narada-violet/80">{"{{first_name}}"}</code> become
                each recipient&apos;s own name.
              </p>
            </div>

            <div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                  Recipients
                </label>
                <RecipientPicker
                  members={members}
                  selected={draft.recipients || []}
                  onChange={(recipients) => setDraft({ ...draft, recipients })}
                  disabled={members.length === 0}
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                  Cadence
                </label>
                <div className="flex gap-2">
                  {CADENCES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCadence(c.value)}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-medium border transition-colors cursor-pointer ${
                        cadence === c.value
                          ? "bg-narada-primary/20 border-narada-primary/30 text-narada-text"
                          : "bg-white/[0.04] border-white/[0.06] text-narada-text-secondary hover:text-narada-text"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {cadence !== "once" && (
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                        First Send
                      </label>
                      <input
                        type="date"
                        className="glass-input text-[13px]"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                        Hour
                      </label>
                      <input
                        type="time"
                        className="glass-input text-[13px]"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-narada-text-secondary/60 mt-2">
                    Slack holds the missives itself, so they fly whether or not this app
                    is awake — up to 120 days ahead.
                  </p>
                </div>
              )}
            </div>
          </div>

          {pending > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-narada-violet/[0.08] border border-narada-violet/20 text-[12px]">
              <CalendarClock size={14} className="text-narada-violet shrink-0" />
              <span>{pending} missives await their hour</span>
              <Button
                variant="danger-soft"
                size="xs"
                className="ml-auto"
                onClick={handleCancelScheduled}
                disabled={busy}
              >
                Withdraw all
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.06]">
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={busy}>
              {saving ? "Inscribing..." : "Inscribe"}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSend} disabled={busy}>
              <Send size={13} />
              {sending
                ? "Carrying..."
                : cadence === "once"
                  ? "Send Now"
                  : "Schedule"}
            </Button>
          </div>

          {results && (
            <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-1">
              {results.map((r) => (
                <div key={r.userId} className="flex items-center gap-2 text-[12px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.ok ? "bg-narada-emerald" : "bg-narada-rose"
                    }`}
                  />
                  <span>{r.name}</span>
                  {r.error && (
                    <span className="text-narada-rose/80 font-mono text-[11px] truncate">
                      {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
