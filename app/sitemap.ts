import type { MetadataRoute } from "next";
import { SITE } from "./copy";

const ROUTES = ["", "/start", "/drop", "/pricing", "/faq", "/the-math", "/about", "/press", "/support", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({ url: `${SITE}${r}`, lastModified: new Date(), changeFrequency: r === "/drop" ? "weekly" : "monthly", priority: r === "" ? 1 : 0.7 }));
}
