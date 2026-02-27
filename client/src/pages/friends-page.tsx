import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, UserPlus, UserCheck, UserX, Search, Bell, BellOff, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import type { User, Friendship, Follower } from "@shared/schema";

type FriendRow = Friendship & { user: User };
type FollowRow = { id: string; user: User };

function UserRow({ user, actions }: { user: User; actions: React.ReactNode }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Anonymous";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.profileImageUrl || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{name}</p>
          {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );
}

export default function FriendsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: friends, isLoading: friendsLoading } = useQuery<FriendRow[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: pending, isLoading: pendingLoading } = useQuery<FriendRow[]>({
    queryKey: ["/api/friends/pending"],
    enabled: isAuthenticated,
  });

  const { data: following } = useQuery<FollowRow[]>({
    queryKey: ["/api/following"],
    enabled: isAuthenticated,
  });

  const { data: followersList } = useQuery<FollowRow[]>({
    queryKey: ["/api/followers"],
    enabled: isAuthenticated,
  });

  const { data: searchResults } = useQuery<User[]>({
    queryKey: ["/api/users/search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleError = (err: Error) => {
    if (isUnauthorizedError(err)) {
      toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/login"; }, 500);
      return;
    }
    toast({ title: "Error", description: err.message, variant: "destructive" });
  };

  const friendRequestMutation = useMutation({
    mutationFn: async (addresseeId: string) => {
      await apiRequest("POST", "/api/friends/request", { addresseeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend Request Sent" });
    },
    onError: handleError,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/friends/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/pending"] });
      toast({ title: "Friend Request Accepted" });
    },
    onError: handleError,
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/friends/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/pending"] });
      toast({ title: "Removed" });
    },
    onError: handleError,
  });

  const followMutation = useMutation({
    mutationFn: async (followedId: string) => {
      await apiRequest("POST", "/api/follow", { followedId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
      toast({ title: "Following" });
    },
    onError: handleError,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (followedId: string) => {
      await apiRequest("DELETE", `/api/follow/${followedId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
      toast({ title: "Unfollowed" });
    },
    onError: handleError,
  });

  if (authLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isFollowingUser = (userId: string) => following?.some((f) => f.user.id === userId);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-friends-title">Friends & Followers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect with other artists. Friends are highlighted near your bower. Followers get notified of your activity.
        </p>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 focus-visible:ring-0"
            data-testid="input-search-users"
          />
          {searchQuery && (
            <Button size="icon" variant="ghost" onClick={() => setSearchQuery("")}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        {searchResults && searchResults.length > 0 && (
          <div className="mt-3 border-t pt-3 space-y-1">
            {searchResults.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => friendRequestMutation.mutate(u.id)}
                      disabled={friendRequestMutation.isPending}
                      data-testid={`button-send-request-${u.id}`}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Add Friend
                    </Button>
                    {!isFollowingUser(u.id) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => followMutation.mutate(u.id)}
                        data-testid={`button-follow-${u.id}`}
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Tabs defaultValue="friends">
        <TabsList className="mb-4">
          <TabsTrigger value="friends" data-testid="tab-friends">
            Friends {friends?.length ? `(${friends.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending {pending?.length ? `(${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="following" data-testid="tab-following">
            Following {following?.length ? `(${following.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="followers" data-testid="tab-followers">
            Followers {followersList?.length ? `(${followersList.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          {friendsLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !friends || friends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No friends yet. Search for users above to connect.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {friends.map((f) => (
                <UserRow
                  key={f.id}
                  user={f.user}
                  actions={
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFriendMutation.mutate(f.id)}
                      data-testid={`button-remove-friend-${f.id}`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {pendingLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !pending || pending.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No pending friend requests.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {pending.map((p) => (
                <UserRow
                  key={p.id}
                  user={p.user}
                  actions={
                    <>
                      <Button size="sm" onClick={() => acceptMutation.mutate(p.id)} data-testid={`button-accept-${p.id}`}>
                        <UserCheck className="w-3.5 h-3.5 mr-1" />
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeFriendMutation.mutate(p.id)} data-testid={`button-reject-${p.id}`}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="following">
          {!following || following.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">You're not following anyone yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {following.map((f) => (
                <UserRow
                  key={f.id}
                  user={f.user}
                  actions={
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => unfollowMutation.mutate(f.user.id)}
                      data-testid={`button-unfollow-${f.user.id}`}
                    >
                      <BellOff className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="followers">
          {!followersList || followersList.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No followers yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {followersList.map((f) => (
                <UserRow
                  key={f.id}
                  user={f.user}
                  actions={
                    !isFollowingUser(f.user.id) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => followMutation.mutate(f.user.id)}
                        data-testid={`button-follow-back-${f.user.id}`}
                      >
                        <Bell className="w-3.5 h-3.5 mr-1" />
                        Follow Back
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Mutual</Badge>
                    )
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
