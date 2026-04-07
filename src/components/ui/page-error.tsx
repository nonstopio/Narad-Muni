import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  title: string;
  message: string;
  onRetry: () => void;
}

export function PageError({ title, message, onRetry }: PageErrorProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-5">
      <div className="glass-card p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-narada-rose/10 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-narada-rose">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-narada-text mb-2">{title}</h2>
        <p className="text-sm text-narada-text-secondary mb-4">{message}</p>
        <Button variant="secondary" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
