import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Bird, UserPlus, UserCheck, Bell, BellOff, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CONTRACT_STYLES } from "@shared/schema";
import type { Bower, User, Contract } from "@shared/schema";

type BowerDetail = Bower & { user: User | null };

export default function BowerDetail() {
  const [, params] = useRoute("/bower/:id");
  const [, navigate] = useLocation();
  const { user: currentUser, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: bower, isLoading } = useQuery<BowerDetail>({
    queryKey: ["/api/bowers", params?.id],
    enabled: !!params?.id,
  });

  const { data: contract } = useQuery<Contract>({
    queryKey: ["/api/contracts/detail", bower?.contractId],
    enabled: !!bower?.contractId,
  });

  const { data: following } = useQuery<{ id: string; user: User }[]>({
    queryKey: ["/api/following"],
    enabled: isAuthenticated,
  });

  const isFollowing = following?.some((f) => f.user.id === bower?.userId);
  const isOwner = currentUser?.id === bower?.userId;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!bower) return;
      if (isFollowing) {
        await apiRequest("DELETE", `/api/follow/${bower.userId}`);
      } else {
        await apiRequest("POST", "/api/follow", { followedId: bower.userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
      toast({ title: isFollowing ? "Unfollowed" : "Following", description: isFollowing ? "You will no longer receive updates." : "You'll be notified of bower activity." });
    },
  });

  const friendMutation = useMutation({
    mutationFn: async () => {
      if (!bower) return;
      await apiRequest("POST", "/api/friends/request", { addresseeId: bower.userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend Request Sent", description: "They'll need to accept your request." });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-48 w-full rounded-md mb-6" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!bower) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Bird className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Bower Not Found</h2>
        <Button variant="outline" onClick={() => navigate("/marketplace")} data-testid="button-back-marketplace">
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const userName = bower.user
    ? [bower.user.firstName, bower.user.lastName].filter(Boolean).join(" ") || "Anonymous"
    : "Anonymous";
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/marketplace")} data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Marketplace
      </Button>

      <div
        className="rounded-md p-8 mb-6 relative"
        style={{ backgroundColor: bower.themeColor || "#6366f1" }}
      >
        <div className="absolute inset-0 bg-black/20 rounded-md" />
        <div className="relative z-10 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 ring-2 ring-white/30">
              <AvatarImage src={bower.user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow" data-testid="text-bower-title">
                {bower.title}
              </h1>
              <p className="text-sm text-white/80">{userName}</p>
            </div>
          </div>

          {isAuthenticated && !isOwner && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white backdrop-blur"
                onClick={() => friendMutation.mutate()}
                disabled={friendMutation.isPending}
                data-testid="button-add-friend"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Add Friend
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white backdrop-blur"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                data-testid="button-follow"
              >
                {isFollowing ? <BellOff className="w-3.5 h-3.5 mr-1" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {bower.description && (
        <p className="text-sm text-muted-foreground mb-6">{bower.description}</p>
      )}

      {contract && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div>
              <h3 className="font-semibold" data-testid="text-featured-contract">{contract.name}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {contract.kt1Address.slice(0, 10)}...{contract.kt1Address.slice(-6)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{contract.symbol}</Badge>
              <Badge variant="outline" className="text-[10px]">{contract.tokenCount} tokens</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{CONTRACT_STYLES.find((s) => s.id === contract.styleId)?.name ?? contract.styleId}</Badge>
            {contract.royaltiesEnabled && <Badge variant="secondary" className="text-[10px]">Royalties</Badge>}
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://ghostnet.tzkt.io/${contract.kt1Address}`, "_blank")}
              data-testid="button-view-on-explorer"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              View on Explorer
            </Button>
          </div>
        </Card>
      )}

      {!contract && (
        <Card className="p-8 text-center">
          <Bird className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">This bower hasn't featured a collection yet.</p>
        </Card>
      )}
    </div>
  );
}
