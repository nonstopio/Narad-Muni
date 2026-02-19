import Image from "next/image";

export function TitleBar() {
  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-narada-surface border-b border-white/[0.06] titlebar-drag z-50 flex items-center justify-center gap-3">
      <Image
        src="/icon.png"
        alt="Narada"
        width={24}
        height={24}
        className="rounded-md titlebar-no-drag"
      />
      <div className="flex items-baseline gap-2 titlebar-no-drag">
        <span className="text-sm font-semibold text-narada-text">Narad Muni</span>
        <span className="text-xs text-narada-text-muted hidden sm:inline">Narayan Narayan! I carry your word across all three worlds.</span>
      </div>
    </div>
  );
}
