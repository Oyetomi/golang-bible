import { compileMDX } from "next-mdx-remote/rsc";
import fs from "node:fs/promises";
import path from "node:path";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import { mdxComponents } from "@/mdx-components";

export type Frontmatter = {
  title: string;
  part: number;
  order: number;
  type: "course" | "project";
  description?: string;
  prerequisites?: string[];
};

const CONTENT_DIR = path.join(process.cwd(), "content");

const prettyCodeOptions = {
  theme: "one-dark-pro",
  keepBackground: false,
};

export async function chapterExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(CONTENT_DIR, relPath));
    return true;
  } catch {
    return false;
  }
}

/** Prose words a reader actually reads: JSX props, fenced code and MDX
 *  expressions are stripped, so the estimate reflects reading, not file size. */
export function proseStats(source: string) {
  const body = source
    .replace(/^---[\s\S]*?---/, "")           // frontmatter
    .replace(/```[\s\S]*?```/g, "")           // fenced code
    .replace(/<([A-Z][A-Za-z0-9]*)[^>]*\/>/g, "") // self-closing components incl. props
    .replace(/<\/?[A-Za-z][^>]*>/g, "")        // remaining tags and their props
    .replace(/\{[^{}]*\}/g, "");              // stray MDX expressions

  const words = body.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  const anims = (
    source.match(/<(ExecTimeline|Scene|[A-Z][A-Za-z]*Anim|AlgoGrid|CodeWalk|HackLab|PredictLab)\b/g) ?? []
  ).length;
  return { words, anims };
}

export async function renderChapter(relPath: string) {
  const source = await fs.readFile(path.join(CONTENT_DIR, relPath), "utf8");
  const stats = proseStats(source);
  const { content, frontmatter } = await compileMDX<Frontmatter>({
    source,
    // GoPlayground is an async server component; the MDXComponents type is
    // synchronous-only, so widen here. RSC renders async components fine.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    components: mdxComponents as any,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins: [rehypeSlug, [rehypePrettyCode, prettyCodeOptions]] as any,
      },
    },
  });
  return { content, frontmatter, stats };
}
