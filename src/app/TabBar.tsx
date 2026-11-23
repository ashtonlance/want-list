import { useSectionLinks } from "./sectionLinks";

/** The phone's bottom tab bar. On a desktop the side bar (SideNav) takes its place. */
export function TabBar() {
  const links = useSectionLinks();
  return (
    <nav className="tabbar" aria-label="Sections">
      <div className="tabs">
        {links.map((l) => (
          <a key={l.section} href={l.href} aria-current={l.current ? "page" : undefined} onClick={l.onClick}>
            {l.icon}
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
