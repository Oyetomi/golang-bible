import type { ReactNode } from "react";

/* ProjectMap — where the code lives. A project's file tree at this point in
   the lesson: which files are new, which changed, what each one is for, and
   the commands that run it. Put one at the top of every lesson that builds
   a project, so a reader always knows which file a snippet belongs to. */

export type ProjectMapFile = {
  /** path from the project root, e.g. "cmd/demo/main.go"; a trailing "/" is an empty folder */
  path: string;
  status?: "new" | "changed" | "same";
  /** one line: what this file is for */
  note?: string;
};

type Node = { name: string; file?: ProjectMapFile; kids: Map<string, Node> };

function build(files: ProjectMapFile[]): Node {
  const root: Node = { name: "", kids: new Map() };
  for (const f of files) {
    const parts = f.path.replace(/\/$/, "").split("/");
    let n = root;
    parts.forEach((p, i) => {
      if (!n.kids.has(p)) n.kids.set(p, { name: p, kids: new Map() });
      n = n.kids.get(p)!;
      if (i === parts.length - 1 && !f.path.endsWith("/")) n.file = f;
    });
  }
  return root;
}

function rows(n: Node, depth: number, out: ReactNode[], key: string) {
  // folders first, then files, each alphabetically, like an editor's sidebar
  const kids = [...n.kids.values()].sort((a, b) => {
    const fa = a.kids.size > 0 ? 0 : 1;
    const fb = b.kids.size > 0 ? 0 : 1;
    return fa - fb || a.name.localeCompare(b.name);
  });
  for (const k of kids) {
    const isDir = k.kids.size > 0 || !k.file;
    const st = k.file?.status ?? "same";
    out.push(
      <li key={key + "/" + k.name} className={`pm-row pm-${isDir ? "dir" : st}`} style={{ paddingLeft: `${depth * 18 + 10}px` }}>
        <span className="pm-icon" aria-hidden>{isDir ? "▾" : "·"}</span>
        <span className="pm-name">{k.name}{isDir ? "/" : ""}</span>
        {!isDir && st !== "same" && <span className={`pm-chip pm-chip-${st}`}>{st}</span>}
        {k.file?.note && <span className="pm-note">{k.file.note}</span>}
      </li>
    );
    if (k.kids.size > 0) rows(k, depth + 1, out, key + "/" + k.name);
  }
}

export function ProjectMap({
  title = "Where the code lives",
  root,
  files,
  run,
  children,
}: {
  title?: string;
  /** the project folder's name, e.g. "kv" */
  root: string;
  files: ProjectMapFile[];
  /** commands to run from the project folder */
  run?: string[];
  children?: ReactNode;
}) {
  const out: ReactNode[] = [];
  rows(build(files), 1, out, root);
  const tree = (
    <ul className="pm-tree">
      <li className="pm-row pm-dir pm-root" style={{ paddingLeft: "10px" }}>
        <span className="pm-icon" aria-hidden>▾</span>
        <span className="pm-name">{root}/</span>
      </li>
      {out}
    </ul>
  );
  // In a big project, lead with what this lesson touches and fold the rest.
  const touched = files.filter((f) => f.status === "new" || f.status === "changed");
  const fold = files.length > 10 && touched.length > 0;
  return (
    <figure className="pm">
      <div className="pm-head">
        <span className="pm-kicker">project</span>
        <span className="pm-title">{title}</span>
        <span className="pm-legend">
          <span className="pm-chip pm-chip-new">new</span>
          <span className="pm-chip pm-chip-changed">changed</span>
        </span>
      </div>
      {fold ? (
        <>
          <ul className="pm-tree pm-touched">
            {touched.map((f) => (
              <li key={f.path} className={`pm-row pm-${f.status}`} style={{ paddingLeft: "10px" }}>
                <span className="pm-name">{root}/{f.path}</span>
                <span className={`pm-chip pm-chip-${f.status}`}>{f.status}</span>
                {f.note && <span className="pm-note">{f.note}</span>}
              </li>
            ))}
          </ul>
          <details className="pm-all">
            <summary>the whole project: {files.length} files</summary>
            {tree}
          </details>
        </>
      ) : (
        tree
      )}
      {run && run.length > 0 && (
        <div className="pm-run">
          <span className="pm-run-k">run it, from inside {root}/</span>
          {run.map((c) => (
            <code key={c} className="pm-cmd">$ {c}</code>
          ))}
        </div>
      )}
      {children && <figcaption className="pm-cap">{children}</figcaption>}
    </figure>
  );
}
