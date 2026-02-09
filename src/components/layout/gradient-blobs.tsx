"use client";

export function GradientBlobs() {
  return (
    <>
      <div
        className="fixed opacity-15 z-0 animate-float"
        style={{
          width: 400,
          height: 400,
          background: "radial-gradient(circle, #3B82F6, transparent)",
          filter: "blur(80px)",
          top: -100,
          left: -100,
        }}
      />
      <div
        className="fixed opacity-15 z-0"
        style={{
          width: 350,
          height: 350,
          background: "radial-gradient(circle, #8B5CF6, transparent)",
          filter: "blur(80px)",
          top: "50%",
          right: -50,
          animation: "float 20s ease-in-out infinite reverse",
          animationDelay: "7s",
        }}
      />
      <div
        className="fixed opacity-15 z-0 animate-float"
        style={{
          width: 300,
          height: 300,
          background: "radial-gradient(circle, #10B981, transparent)",
          filter: "blur(80px)",
          bottom: -100,
          left: "50%",
          animationDelay: "14s",
        }}
      />
    </>
  );
}
