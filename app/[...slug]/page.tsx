import { notFound } from "next/navigation";
import { chapters, chapterByHref } from "@/lib/manifest";
import { renderChapter, chapterExists } from "@/lib/content";
import { ComingSoon } from "@/components/course/server";
import { ChapterPagination } from "@/components/nav/ChapterPagination";
import { ReaderBar } from "@/components/course/ReaderBar";

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
  const href = "/" + slug.join("/");
  const ch = chapterByHref(href);
  if (!ch) return {};
  const title = `${ch.title} — The Go Bible`;
  return {
    title,
    description: ch.description,
    openGraph: {
      title,
      description: ch.description,
      type: "article",
      url: href,
      siteName: "The Go Bible",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ch.description,
    },
  };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const href = "/" + slug.join("/");
  const chapter = chapterByHref(href);
  if (!chapter) notFound();

  if (!(await chapterExists(chapter.path))) {
    return (
      <article className="prose">
        <ComingSoon title={chapter.title} />
      </article>
    );
  }

  const { content } = await renderChapter(chapter.path);
  const currentIndex = chapters.findIndex((c) => c.href === chapter.href);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <article className="prose">
      <ReaderBar />
      {content}
      <ChapterPagination prev={prev} next={next} />
    </article>
  );
}
