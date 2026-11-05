"use client";

import { ConteudoErroArea } from "@/components/layout/erro-area";

export default function ErroDaArea({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ConteudoErroArea erro={error} reset={reset} />;
}
