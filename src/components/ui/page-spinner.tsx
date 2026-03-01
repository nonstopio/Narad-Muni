export function PageSpinner({ message = "Loading chronicles..." }: { message?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-narada-blue/30 border-t-narada-blue rounded-full animate-spin" />
        <p className="text-sm text-narada-text-secondary">{message}</p>
      </div>
    </div>
  );
}
