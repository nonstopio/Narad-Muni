import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Error text with its cause chain. SDKs wrap network failures as a bare "Connection error."
 * or "fetch failed" and keep the reason (DNS, TLS, proxy) in `cause`, often two levels down.
 */
export function errorMessage(err: unknown, fallback = "Unknown error"): string {
  const parts: string[] = []
  let e: unknown = err
  for (let depth = 0; e && depth < 5; depth++, e = (e as { cause?: unknown }).cause) {
    if (typeof e !== "object") break
    const { message, code } = e as { message?: unknown; code?: unknown }
    const msg = typeof message === "string" ? message : ""
    const tag = typeof code === "string" && !msg.includes(code) ? code : ""
    const part = [msg, tag].filter(Boolean).join(" ")
    if (part && !parts.includes(part)) parts.push(part)
  }
  return parts.join(" ← ") || fallback
}
