import { createDemoData } from "../../utils/demo";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthProvider } from "../../context/AuthContext";
import { useAuth } from "../../hooks/useAuth";
import { StorageProvider } from "../../context/StorageProvider";
import {
  defaultStorageRepository,
  LocalStorageRepository,
} from "../../services/storage/localStorageRepository";
import { CloudWorkspace } from "./CloudWorkspace";
import { LandingPage } from "../landing/LandingPage";
const Planner = lazy(() => import("../../App"));
const AuthPage = lazy(() =>
  import("./AuthPage").then((module) => ({ default: module.AuthPage })),
);
const TeamWorkspacesPage = lazy(() => import("../workspaces/TeamWorkspacesPage"));
import { getPlannerLocation, isDemoMode } from "../../utils/navigation";
import { isTeamPath } from "../../utils/teamRoutes";
import { useStorage } from "../../hooks/useStorage";
import { accountWorkspaceCacheKey } from "../../services/storage/supabaseRepository";
import { supabaseUrl } from "../../services/supabase/client";
import { initializeAppearance } from "../../utils/settings";

function DemoResetButton() {
  const { importData } = useStorage();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function resetDemo() {
    setBusy(true);
    setError("");
    try {
      await importData(createDemoData());
    } catch {
      setError("Could not reset the demo. Your sample changes are preserved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        disabled={busy}
        onClick={() => {
          void resetDemo();
        }}
      >
        Reset demo
      </button>
      {error && (
        <span className="demo-reset-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
function DemoWorkspace({ children }: { children: ReactNode }) {
  const repository = useMemo(
    () => new LocalStorageRepository("todop_demo_v2", createDemoData()),
    [],
  );
  return (
    <StorageProvider repository={repository}>
      <div className="demo-workspace">
        <div className="demo-bar">
          <span>Sample workspace</span>
          <DemoResetButton />
        </div>
        {children}
      </div>
    </StorageProvider>
  );
}
function Entry({ children }: { children: ReactNode }) {
  const { account, loading, recovery } = useAuth();
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search);
  const path = location.split('?')[0];
  const personalAppearance = path === '/' || path === '/auth' || isTeamPath(path);
  const accountId = account?.id;
  useEffect(() => {
    const onPopState = () => setLocation(getPlannerLocation());
    onPopState();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!personalAppearance) return;
    initializeAppearance(accountId ? accountWorkspaceCacheKey(supabaseUrl, accountId) : undefined);
  }, [personalAppearance, accountId]);
  if (isDemoMode() && !isTeamPath(path)) return <DemoWorkspace>{children}</DemoWorkspace>;
  if (path === "/") return <LandingPage signedIn={!!account} />;
  if (loading)
    return (
      <main className="workspace-loading" role="status">
        Opening Todop…
      </main>
    );
  if (path === "/auth" || recovery)
    return (
      <Suspense
        fallback={
          <main className="workspace-loading" role="status">
            Opening your account…
          </main>
        }
      >
        <AuthPage key={recovery ? "recovery" : "auth"} />
      </Suspense>
    );
  if (isTeamPath(path)) return (
    <Suspense fallback={<main className="workspace-loading" role="status">Opening shared workspaces…</main>}>
      <TeamWorkspacesPage location={location} />
    </Suspense>
  );
  if (account)
    return (
      <CloudWorkspace key={account.id} userId={account.id}>
        {children}
      </CloudWorkspace>
    );
  return (
    <StorageProvider repository={defaultStorageRepository}>
      {children}
    </StorageProvider>
  );
}
export function AppEntry() {
  return (
    <AuthProvider>
      <Entry>
        <Suspense
          fallback={
            <main className="workspace-loading" role="status">
              Opening your planner…
            </main>
          }
        >
          <Planner />
        </Suspense>
      </Entry>
    </AuthProvider>
  );
}
