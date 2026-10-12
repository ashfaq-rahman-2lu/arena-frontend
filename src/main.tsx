/// <reference types="vite/client" />
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import React, {
  lazy,
  ReactElement,
  ReactNode,
  Suspense,
  useEffect,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import { api, ApiError } from "./shared/api/arena-api";
import {
  ErrorState,
  Footer,
  Nav,
  Spinner,
  ToastProvider,
  useSession,
} from "./shared/ui/primitives";
import "./styles.css";
const Home = lazy(
  async (): Promise<{ default: typeof import("./pages/Home").Home }> => ({
    default: (await import("./pages/Home")).Home,
  }),
);
const AuthPage = lazy(
  async (): Promise<{
    default: typeof import("./features/authentication/auth-page").AuthPage;
  }> => ({
    default: (await import("./features/authentication/auth-page")).AuthPage,
  }),
);
const Dashboard = lazy(
  async (): Promise<{
    default: typeof import("./features/dashboard/dashboard-page").Dashboard;
  }> => ({
    default: (await import("./features/dashboard/dashboard-page")).Dashboard,
  }),
);
const SetupPage = lazy(
  async (): Promise<{
    default: typeof import("./features/setup/setup-page").SetupPage;
  }> => ({ default: (await import("./features/setup/setup-page")).SetupPage }),
);
const TournamentPage = lazy(
  async (): Promise<{
    default: typeof import("./features/tournament-management/tournament-page").TournamentPage;
  }> => ({
    default: (await import("./features/tournament-management/tournament-page"))
      .TournamentPage,
  }),
);
const PublicPage = lazy(
  async (): Promise<{
    default: typeof import("./features/public-viewing/public-page").PublicPage;
  }> => ({
    default: (await import("./features/public-viewing/public-page")).PublicPage,
  }),
);
interface BoundaryProps {
  children: ReactNode;
}
interface BoundaryState {
  error: Error | null;
}
class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }
  render(): ReactNode {
    return this.state.error ? (
      <ErrorState
        error={this.state.error}
        retry={(): void => location.reload()}
      />
    ) : (
      this.props.children
    );
  }
}
function Layout(): ReactElement {
  const session = useSession(),
    cache = useQueryClient();
  const identity = session.data?.user?.id ?? null;
  const previous = useRef(identity);
  useEffect((): void => {
    if (previous.current !== identity) {
      const prior = previous.current;
      previous.current = identity;
      if (prior) {
        void cache
          .cancelQueries({ queryKey: ["private", prior] })
          .then((): void =>
            cache.removeQueries({ queryKey: ["private", prior] }),
          );
        api.resetIdentity();
      }
    }
  }, [identity, cache]);
  return (
    <ToastProvider>
      <Boundary>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Nav />
        <Suspense fallback={<Spinner />}>
          <div key={identity ?? "guest"}>
            <Outlet />
          </div>
        </Suspense>
        <Footer />
      </Boundary>
    </ToastProvider>
  );
}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (attempt: number, error: Error): boolean =>
        !(
          error instanceof ApiError &&
          [400, 401, 403, 409].includes(error.status)
        ) && attempt < 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/auth/:mode", element: <AuthPage /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/new", element: <SetupPage /> },
      { path: "/manage/:id/setup", element: <SetupPage /> },
      { path: "/manage/:id", element: <TournamentPage admin /> },
      { path: "/t/:publicId", element: <PublicPage /> },
      {
        path: "*",
        element: <ErrorState error={new Error("This page does not exist")} />,
      },
    ],
  },
]);
const container = document.getElementById("root");
if (!container) throw new Error("Root element is missing");
createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
