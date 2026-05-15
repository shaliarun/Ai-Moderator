import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Studies from "@/pages/Studies";
import NewStudy from "@/pages/NewStudy";
import StudyDetail from "@/pages/StudyDetail";
import EditStudy from "@/pages/EditStudy";
import StudyParticipants from "@/pages/StudyParticipants";
import Sessions from "@/pages/Sessions";
import SessionDetail from "@/pages/SessionDetail";
import Interview from "@/pages/Interview";
import Invite from "@/pages/Invite";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

function Routes() {
  return (
    <Switch>
      <Route path="/invite/:token">{(p) => <Invite token={p.token} />}</Route>
      <Route path="/interview/:sessionId">{(p) => <Interview sessionId={p.sessionId} />}</Route>
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/studies" component={Studies} />
            <Route path="/studies/new" component={NewStudy} />
            <Route path="/studies/:id/edit">{(p) => <EditStudy id={p.id} />}</Route>
            <Route path="/studies/:id/participants">{(p) => <StudyParticipants id={p.id} />}</Route>
            <Route path="/studies/:id">{(p) => <StudyDetail id={p.id} />}</Route>
            <Route path="/sessions" component={Sessions} />
            <Route path="/sessions/:id">{(p) => <SessionDetail id={p.id} />}</Route>
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={baseUrl}>
        <Routes />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
