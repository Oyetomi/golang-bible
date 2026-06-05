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

export async function renderChapter(relPath: string) {
  const source = await fs.readFile(path.join(CONTENT_DIR, relPath), "utf8");
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
  return { content, frontmatter };
}
