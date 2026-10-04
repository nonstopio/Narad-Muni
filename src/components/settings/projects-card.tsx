"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FolderGit2, Plus, Trash2, X } from "lucide-react";
import { useToastStore } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import type { LocalProject } from "@/types";

const noopSubscribe = () => () => {};
const EMAIL = /^[^\s@]+@[^\s@]+$/;

const ADD_ERRORS: Record<string, string> = {
  "not-a-repo": "Alas! That folder holds no git chronicle.",
  "git-missing": "Alas! Git is not installed — install it, then summon me again.",
  "signed-out": "Alas! Sign in again so I know whose repositories these are.",
};

function ProjectRow({ project, onChange, onRemove }: {
  project: LocalProject;
  onChange: (patch: Partial<Pick<LocalProject, "name" | "enabled" | "authorEmails">>) => Promise<void>;
  onRemove: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [email, setEmail] = useState("");

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) {
      setName(project.name);
      return;
    }
    if (trimmed !== project.name) onChange({ name: trimmed });
  };

  const addEmail = () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) return;
    if (!project.authorEmails.includes(e) && project.authorEmails.length < 10) {
      onChange({ authorEmails: [...project.authorEmails, e] });
    }
    setEmail("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          className="glass-input flex-1 min-w-0 px-3 py-1.5 text-sm"
          value={name}
          maxLength={60}
          aria-label="Repository name"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <button
          type="button"
          role="switch"
          aria-checked={project.enabled}
          aria-label={`${project.enabled ? "Disable" : "Enable"} ${project.name}`}
          onClick={() => onChange({ enabled: !project.enabled })}
          className={`relative w-10 h-[22px] shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
            project.enabled ? "bg-narada-emerald" : "bg-white/[0.1]"
          }`}
        >
          <span
            className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              project.enabled ? "translate-x-[18px]" : "translate-x-0"
            }`}
          />
        </button>
        <Button variant="danger-soft" size="icon-sm" onClick={onRemove} aria-label={`Remove ${project.name}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Truncated from the left so the repo folder name stays visible */}
      <p
        className="font-mono text-xs text-narada-text-muted truncate text-left"
        style={{ direction: "rtl" }}
        title={project.root}
      >
        <bdi>{project.root}</bdi>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {project.authorEmails.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono bg-white/[0.05] border border-white/[0.06] text-narada-text-secondary">
            {e}
            <button
              type="button"
              aria-label={`Remove ${e}`}
              className="cursor-pointer hover:text-narada-rose"
              onClick={() => onChange({ authorEmails: project.authorEmails.filter((x) => x !== e) })}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          className="glass-input px-2 py-0.5 text-xs font-mono w-48"
          placeholder="+ email"
          value={email}
          aria-label="Add author email"
          onChange={(e) => setEmail(e.target.value)}
          onBlur={addEmail}
          onKeyDown={(e) => e.key === "Enter" && addEmail()}
        />
      </div>
      {project.authorEmails.length === 0 && (
        <p className="text-xs text-narada-amber">Alas! Grant me your commit email so I know which deeds are yours.</p>
      )}
    </div>
  );
}

export function ProjectsCard() {
  const isElectron = useSyncExternalStore(noopSubscribe, () => !!window.narada?.isElectron, () => false);
  const [projects, setProjects] = useState<LocalProject[] | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const deviceTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  useEffect(() => {
    if (!isElectron) return;
    window.narada!.projects.list().then((res) => {
      if ("error" in res) {
        setProjects([]);
        return;
      }
      setProjects(res.projects);
      setTimeZone(res.workdayTimeZone);
    }).catch((err) => console.error("[Narada] Failed to load projects:", err));
  }, [isElectron]);

  if (!isElectron || projects === null) return null;

  const api = window.narada!.projects;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await api.add();
      if ("project" in res) {
        setProjects((prev) => [...(prev ?? []), res.project]);
        addToast(`Narayan Narayan! I now watch ${res.project.name}.`, "success");
      } else if (res.error === "duplicate") {
        addToast("Narayan Narayan! I already watch that repository.", "warning");
      } else if (res.error !== "cancelled") {
        addToast(ADD_ERRORS[res.error], "error");
      }
    } catch (err) {
      console.error("[Narada] Failed to add project:", err);
      addToast("Alas! That repository could not be added.", "error");
    } finally {
      setAdding(false);
    }
  };

  const change = async (id: string, patch: Partial<Pick<LocalProject, "name" | "enabled" | "authorEmails">>) => {
    try {
      const res = await api.update({ id, ...patch });
      if ("project" in res) setProjects((prev) => prev?.map((p) => (p.id === id ? res.project : p)) ?? null);
    } catch (err) {
      console.error("[Narada] Failed to update project:", err);
      addToast("Alas! That change could not be kept.", "error");
    }
  };

  const remove = async (id: string) => {
    await api.remove(id);
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
  };

  const changeTz = async (value: string) => {
    const res = await api.setTimeZone(value || null);
    if (!("error" in res)) setTimeZone(res.workdayTimeZone);
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          <FolderGit2 className="w-4 h-4 text-narada-secondary" />
        </div>
        <span>Sacred Repositories</span>
      </div>

      <p className="text-xs text-narada-text-secondary mb-4">
        I read your commits from these folders to recall a day&apos;s deeds. I only ever read — nothing in them is changed, and nothing leaves this machine.
      </p>

      <label className="flex items-center justify-between gap-4 mb-5">
        <span className="text-sm text-narada-text">Workday timezone</span>
        <select
          className="glass-input px-3 py-1.5 text-sm max-w-[260px]"
          value={timeZone ?? ""}
          onChange={(e) => changeTz(e.target.value)}
        >
          <option value="">Device ({deviceTz})</option>
          {timeZone && !zones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-3 mb-4">
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} onChange={(patch) => change(p.id, patch)} onRemove={() => remove(p.id)} />
        ))}
      </div>

      <Button variant="primary" onClick={handleAdd} disabled={adding}>
        <Plus className="w-4 h-4" />
        Add repository
      </Button>
    </div>
  );
}
