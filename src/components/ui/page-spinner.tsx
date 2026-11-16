import { Orb, type OrbState } from "@/components/ui/orb";

export function PageSpinner({
  message = "Loading chronicles...",
  state = "searching",
}: {
  message?: string;
  state?: OrbState;
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Orb state={state} size={64} />
        <p className="text-sm text-narada-text-secondary">{message}</p>
      </div>
    </div>
  );
}
