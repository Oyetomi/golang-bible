import { notFound } from "next/navigation";
import { chapters, chapterByHref, chapterBySlug } from "@/lib/manifest";
import { renderChapter, chapterExists } from "@/lib/content";
import { NextUp, ComingSoon } from "@/components/course/server";

export const dynamicParams = true;

export async function generateStaticParams() {
  const params: { slug: string[] }[] = [];
  for (const c of chapters) {
    if (await chapterExists(c.path)) {
      params.push({ slug: c.href.replace(/^\//, "").split("/") });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const ch = chapterByHref("/" + slug.join("/"));
  if (!ch) return {};
  return { title: `${ch.title} — The Go Bible`, description: ch.description };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const chapter = chapterByHref("/" + slug.join("/"));
  if (!chapter) notFound();

  if (!(await chapterExists(chapter.path))) {
    return (
      <article className="prose">
        <ComingSoon title={chapter.title} />
      </article>
    );
  }

  const { content } = await renderChapter(chapter.path);
  const next = chapter.next ? chapterBySlug(chapter.next) : null;

  return (
    <article className="prose">
      {content}
      {next && <NextUp href={next.href} title={next.title} />}
    </article>
  );
}
