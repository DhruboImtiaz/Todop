export function isDemoMode(): boolean {
  return (
    window.location.pathname === "/demo" ||
    new URLSearchParams(window.location.search).has("demo")
  );
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
