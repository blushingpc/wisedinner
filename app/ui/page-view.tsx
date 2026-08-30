"use client";

import { useEffect } from "react";
import { track, type Event } from "./track";

// one event on mount, for pages that only need "someone saw this"
export function PageView({ event }: { event: Event }) {
  useEffect(() => track(event), [event]);
  return null;
}
