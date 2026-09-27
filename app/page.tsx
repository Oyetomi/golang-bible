import Link from "next/link";
import { chapters, partGroups } from "@/lib/manifest";
import { DoneMark, HomeDesk, PartProgress } from "@/components/home/HomeDesk";

export default function Home() {
  const groups = partGroups();
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
        <section key={g.part} className="hp" style={{ animationDelay: `${120 + gi * 60}ms` }}>
          <header className="hp-head">
            <div>
              <p className="hp-kicker">{g.label}</p>
              <h2 className="hp-title">{g.title}</h2>
              <p className="hp-sub">{g.subtitle}.</p>
            </div>
            <PartProgress slugs={g.chapters.map((c) => c.slug)} />
          </header>
          <ol className="hp-list">
            {g.chapters.map((c) => (
              <li key={c.slug}>
                <Link href={c.href} className="hp-ch">
                  <span className="hp-num">{c.order}</span>
                  <span className="hp-text">
                    <span className="hp-ch-title">
                      {c.title}
                      {c.type === "project" && <span className="hp-build">build</span>}
                    </span>
                    <span className="hp-desc">{c.description}</span>
                  </span>
                  <DoneMark slug={c.slug} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
