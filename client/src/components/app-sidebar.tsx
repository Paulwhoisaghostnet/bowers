import { LayoutDashboard, Plus, Bird, Store, Palette, Wallet, Users, LogOut, Globe } from "lucide-react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/wallet-context";
import { useNetwork, type TezosNetwork } from "@/lib/network-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const publicItems = [
  { title: "Marketplace", url: "/marketplace", icon: Store },
];

const authItems = [
  { title: "My Contracts", url: "/dashboard", icon: LayoutDashboard },
  { title: "New Collection", url: "/create", icon: Plus },
  { title: "My Bower", url: "/bower/edit", icon: Palette },
  { title: "Wallets", url: "/wallets", icon: Wallet },
  { title: "Friends", url: "/friends", icon: Users },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { address: walletAddress, shortAddress, isConnecting, connect, disconnect, providerName } = useWallet();
  const { network, setNetwork, isMainnet } = useNetwork();

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || "User"
    : "";
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
          data-testid="link-home"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <Bird className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Bowers</h1>
            <p className="text-[10px] text-muted-foreground">Tezos NFT Studio</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                    className="data-[active=true]:bg-sidebar-accent"
                  >
                    <a
                      href={item.url}
                      onClick={(e) => { e.preventDefault(); navigate(item.url); }}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAuthenticated && (
          <SidebarGroup>
            <SidebarGroupLabel>My Studio</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {authItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={location === item.url}
                      className="data-[active=true]:bg-sidebar-accent"
                    >
                      <a
                        href={item.url}
                        onClick={(e) => { e.preventDefault(); navigate(item.url); }}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Network</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <button
                  onClick={() => setNetwork(isMainnet ? "ghostnet" : "mainnet")}
                  className="text-left"
                >
                  <Badge
                    variant={isMainnet ? "default" : "outline"}
                    className={`text-[10px] cursor-pointer ${isMainnet ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    {isMainnet ? "Mainnet" : "Ghostnet (Testnet)"}
                  </Badge>
                </button>
              </div>
              {isMainnet && (
                <p className="text-[10px] text-amber-500 font-medium px-0.5">
                  Real tez — transactions cost money
                </p>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {isAuthenticated && user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{userName}</p>
                {walletAddress && (
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-muted-foreground font-mono">{shortAddress}</p>
                    {providerName && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">
                        {providerName === "octez.connect" ? "octez" : "beacon"}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!walletAddress ? (
              <Button
                onClick={connect}
                disabled={isConnecting}
                size="sm"
                variant="outline"
                className="w-full"
                data-testid="button-connect-wallet"
              >
                <Wallet className="w-3.5 h-3.5 mr-1" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={disconnect}
                data-testid="button-disconnect-wallet"
              >
                Disconnect Wallet
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Sign Out
            </Button>
          </div>
        ) : (
          <a href="/login">
            <Button className="w-full" data-testid="button-login-sidebar">
              Sign In
            </Button>
          </a>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
