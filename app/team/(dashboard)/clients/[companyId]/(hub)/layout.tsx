// The client hub is one tabbed page now (page.tsx). This layout only carries
// the route group; the page owns the header, the program band and the tabs,
// and gates on the actor's assignments. Old per-tab URLs redirect into it.
export default function TeamClientHubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
