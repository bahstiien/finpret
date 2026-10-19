import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Le service worker gêne le rechargement à chaud : actif seulement en production.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Build de production à part : `next build` (hook pre-push, Playwright) ne se bat pas
  // avec un `next dev` déjà lancé sur .next.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withSerwist(nextConfig);
