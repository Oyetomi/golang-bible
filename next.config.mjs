/** @type {import('next').NextConfig} */
const nextConfig = {
  // MDX is read at request time from /content (see lib/content.ts).
  // Course components are injected through mdx-components.tsx, so chapter MDX needs no imports.
  pageExtensions: ["ts", "tsx"],
};

export default nextConfig;
