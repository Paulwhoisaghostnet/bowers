import { LayoutDashboard, Plus, Bird } from "lucide-react";
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
import { useWallet } from "@/lib/wallet-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "My Contracts", url: "/", icon: LayoutDashboard },
  { title: "New Collection", url: "/create", icon: Plus },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { address, shortAddress, isConnecting, connect, disconnect } = useWallet();

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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                    className="data-[active=true]:bg-sidebar-accent"
                  >
                    <a
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(item.url);
                      }}
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

        <SidebarGroup>
          <SidebarGroupLabel>Network</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2">
              <Badge variant="outline" className="text-[10px]">
                Ghostnet (Testnet)
              </Badge>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {address ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-status-online" />
              <span className="text-xs text-muted-foreground font-mono">{shortAddress}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={disconnect}
              data-testid="button-disconnect-wallet"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={connect}
            disabled={isConnecting}
            className="w-full"
            data-testid="button-connect-wallet"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
