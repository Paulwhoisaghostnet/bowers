import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/lib/theme-provider";
import { WalletProvider } from "@/lib/wallet-context";
import { NetworkProvider } from "@/lib/network-context";
import { useAuth } from "@/hooks/use-auth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CreateCollection from "@/pages/create-collection";
import MintToken from "@/pages/mint-token";
import Marketplace from "@/pages/marketplace";
import BowerDetail from "@/pages/bower-detail";
import BowerEditor from "@/pages/bower-editor";
import WalletsPage from "@/pages/wallets-page";
import FriendsPage from "@/pages/friends-page";
import AuthPage from "@/pages/auth-page";
import CollectionPage from "@/pages/collection";
import ManageContract from "@/pages/manage-contract";
import NotFound from "@/pages/not-found";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create" component={CreateCollection} />
      <Route path="/mint/:id" component={MintToken} />
      <Route path="/collection/:id" component={CollectionPage} />
      <Route path="/manage/:id" component={ManageContract} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/bower/edit" component={BowerEditor} />
      <Route path="/bower/:id" component={BowerDetail} />
      <Route path="/wallets" component={WalletsPage} />
      <Route path="/friends" component={FriendsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/bower/:id" component={BowerDetail} />
      <Route component={Landing} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={AuthPage} />
        <Route path="/marketplace">
          <SidebarLayout>
            <Marketplace />
          </SidebarLayout>
        </Route>
        <Route path="/bower/:id">
          <SidebarLayout>
            <BowerDetail />
          </SidebarLayout>
        </Route>
        <Route path="/collection/:id">
          <SidebarLayout>
            <CollectionPage />
          </SidebarLayout>
        </Route>
        <Route>
          <Landing />
        </Route>
      </Switch>
    );
  }

  return (
    <SidebarLayout>
      <AuthenticatedRouter />
    </SidebarLayout>
  );
}

function SidebarLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NetworkProvider>
          <WalletProvider>
            <TooltipProvider>
              <AppContent />
              <Toaster />
            </TooltipProvider>
          </WalletProvider>
        </NetworkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
