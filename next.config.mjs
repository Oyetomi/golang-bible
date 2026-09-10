/** @type {import('next').NextConfig} */
const nextConfig = {
  // MDX is read at request time from /content (see lib/content.ts).
  // Course components are injected through mdx-components.tsx, so chapter MDX needs no imports.
  pageExtensions: ["ts", "tsx"],

  // Dev and build used to share .next, so running `pnpm build` while `pnpm dev`
  // was up overwrote the chunks the dev server was serving. The symptom is a
  // 500 on every page with "Cannot find module './793.js'", which looks like a
  // code fault and is not one. Separate directories mean the two can run at the
  // same time — which they routinely do, since verifying a change means building
  // while the preview is still open.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
