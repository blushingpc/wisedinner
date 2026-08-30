import type { Metadata } from "next";
import { staples } from "@/data/staples";
import { Quiz } from "./quiz";

export const metadata: Metadata = {
  title: "solve my week · wisedinner",
};

export default function Start() {
  const pantryOptions = staples.filter((s) => !s.perishable).map((s) => s.name);
  return <Quiz pantryOptions={pantryOptions} />;
}
