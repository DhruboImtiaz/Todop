export function isDemoMode(): boolean {
  return (
    window.location.pathname === "/demo" ||
    new URLSearchParams(window.location.search).has("demo")
  );
}

/** Route old bookmarks to the task list, including when the app loads offline. */
export function getPlannerLocation(): string {
  const url = new URL(window.location.href);
  if (/^\/today\/?$/i.test(url.pathname)) {
    url.pathname = '/app';
    window.history.replaceState(window.history.state, '', url);
  }
  return url.pathname + url.search;
}

/** Notify both the app shell and page router after an in-app navigation. */
export function navigate(path: string): void {
  const target =
    isDemoMode() && path !== "/" && !path.startsWith("/auth")
      ? `${path}${path.includes("?") ? "&" : "?"}demo=1`
      : path;
  window.history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}
