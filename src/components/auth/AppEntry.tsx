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
import { SupabaseRepository } from "../../services/storage/supabaseRepository";
import { supabase } from "../../services/supabase/client";
import { LandingPage } from "../landing/LandingPage";
const Planner = lazy(() => import("../../App"));
const AuthPage = lazy(() =>
  import("./AuthPage").then((module) => ({ default: module.AuthPage })),
);
import { isDemoMode, navigate } from "../../utils/navigation";
import { useStorage } from "../../hooks/useStorage";

function CloudWorkspace({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const repository = useMemo(
    () => new SupabaseRepository(supabase, userId),
    [userId],
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      repository
        .refresh()
        .then(() => {
          if (active) {
            setReady(true);
            setError("");
          }
        })
        .catch((failure) => {
          if (active)
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not connect to your planner.",
            );
        });
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [repository, attempt]);
  if (!ready)
    return (
      <main className="workspace-loading" aria-live="polite">
        <h1>Your planner</h1>
        <p>{error || "Opening your workspace…"}</p>
        {error && (
          <>
            <button onClick={() => setAttempt((v) => v + 1)}>Try again</button>
            <button onClick={() => navigate("/")}>Back to home</button>
          </>
        )}
      </main>
    );
  return (
    <StorageProvider repository={repository}>
      {error && (
        <div className="workspace-error" role="alert">
          Cloud connection unavailable. Reconnect before making changes.
          <button onClick={() => setAttempt((v) => v + 1)}>Retry</button>
        </div>
      )}
      {children}
    </StorageProvider>
  );
}
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
          <span>DEMO WORKSPACE · SAMPLE DATA</span>
          <DemoResetButton />
        </div>
        {children}
      </div>
    </StorageProvider>
  );
}
function Entry({ children }: { children: ReactNode }) {
  const { session, loading, recovery } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  if (isDemoMode()) return <DemoWorkspace>{children}</DemoWorkspace>;
  if (path === "/") return <LandingPage signedIn={!!session} />;
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
  if (session)
    return (
      <CloudWorkspace key={session.user.id} userId={session.user.id}>
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
