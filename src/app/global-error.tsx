"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#0A0A0F",
          color: "#F1F5F9",
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            margin: "0 24px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(239,68,68,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  color: "#F1F5F9",
                }}
              >
                Alas! The Cosmos Has Fractured
              </h1>
              <p
                style={{
                  fontSize: 14,
                  margin: "4px 0 0 0",
                  color: "#94A3B8",
                }}
              >
                A great disturbance has shaken the very foundations of this
                realm.
              </p>
            </div>
          </div>

          {/* Error message */}
          <div
            style={{
              borderRadius: 12,
              backgroundColor: "rgba(239,68,68,0.05)",
              border: "1px solid rgba(239,68,68,0.2)",
              padding: "12px 16px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#EF4444",
                margin: 0,
              }}
            >
              {error.message || "An unknown disturbance shattered the realm"}
            </p>
            {error.digest && (
              <p
                style={{
                  fontSize: 12,
                  color: "#64748B",
                  margin: "6px 0 0 0",
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                }}
              >
                Digest: {error.digest}
              </p>
            )}
          </div>

          {/* Stack trace */}
          {error.stack && (
            <div>
              <span
                style={{
                  fontSize: 11,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Sacred Stack Trace
              </span>
              <pre
                style={{
                  fontSize: 12,
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  color: "#94A3B8",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: 16,
                  margin: 0,
                  overflowX: "auto",
                  overflowY: "auto",
                  maxHeight: 200,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  userSelect: "all",
                  WebkitUserSelect: "all",
                }}
              >
                {error.stack}
              </pre>
            </div>
          )}

          {/* Try Again button */}
          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              height: 40,
              padding: "0 20px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily:
                "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              color: "#EF4444",
              backgroundColor: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
