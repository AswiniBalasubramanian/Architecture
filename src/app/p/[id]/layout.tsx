// Project pages read everything from this browser's storage, so the server has
// nothing per-project to render. One shell is prerendered for the id "_" and
// every /p/<id>/... URL is rewritten to it (next.config.ts), so these pages are
// served from the CDN cache; the real id is read from the address bar.

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
