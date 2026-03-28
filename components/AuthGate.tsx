import React from "react";

/**
 * AuthGate is a no-op when auth is disabled.
 * Renders children without any redirect.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
