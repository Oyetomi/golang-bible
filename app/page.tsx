import { chapters, partGroups } from "@/lib/manifest";
import { HomeDesk } from "@/components/home/HomeDesk";
import { PartOutline } from "@/components/home/PartOutline";
import { lessonFacts } from "@/lib/outline";

export default function Home() {
  const groups = partGroups();
  const facts = lessonFacts();
  const first = chapters.find((c) => c.part === 1 && c.order === 1) ?? chapters[0];
  const firstGroup = groups.find((g) => g.part === first.part);

  return (
    <div className="prose home">
      <HomeDesk
        total={chapters.length}
        start={{
          slug: first.slug,
          title: first.title,
          href: first.href,
          part: firstGroup?.label ?? "Part 1",
          order: first.order,
        }}
      />

      {groups.map((g, gi) => (
        <div key={g.part} className="hp" style={{ animationDelay: `${120 + gi * 60}ms` }}>
          <PartOutline
            label={g.label}
            title={g.title}
            subtitle={g.subtitle}
            locking={g.part !== "appendix"}
            collapsed={g.part === "appendix"}
            lessons={g.chapters.map((c) => ({
              slug: c.slug,
              title: c.title,
              href: c.href,
              order: c.order,
              type: c.type,
              kind: c.kind,
              module: c.module,
              ...facts[c.slug],
            }))}
          />
        </div>
      ))}
    </div>
  );
}
