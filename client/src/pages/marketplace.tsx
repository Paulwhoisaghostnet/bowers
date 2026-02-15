import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bird, Palette, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Bower, User } from "@shared/schema";

type BowerWithUser = Bower & { user: User | null };

function BowerCard({ bower }: { bower: BowerWithUser }) {
  const [, navigate] = useLocation();
  const userName = bower.user
    ? [bower.user.firstName, bower.user.lastName].filter(Boolean).join(" ") || "Anonymous"
    : "Anonymous";
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card
      className="overflow-visible hover-elevate cursor-pointer"
      onClick={() => navigate(`/bower/${bower.id}`)}
      data-testid={`card-bower-${bower.id}`}
    >
      <div
        className="h-24 rounded-t-md flex items-end p-3"
        style={{ backgroundColor: bower.themeColor || "#6366f1" }}
      >
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 ring-2 ring-background">
            <AvatarImage src={bower.user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-white drop-shadow">{userName}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm truncate">{bower.title}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {bower.layout}
          </Badge>
        </div>
        {bower.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{bower.description}</p>
        )}
        <Button variant="ghost" size="sm" className="w-full" data-testid={`button-view-bower-${bower.id}`}>
          View Bower
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

export default function Marketplace() {
  const { data: bowers, isLoading } = useQuery<BowerWithUser[]>({
    queryKey: ["/api/bowers"],
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-marketplace-title">
            Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover bowers from artists across the Tezos ecosystem
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton className="h-24 rounded-t-md" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </Card>
          ))}
        </div>
      ) : !bowers || bowers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Palette className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-1">No bowers yet</h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Be the first to create a bower and showcase your collection in the marketplace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bowers.map((b) => (
            <BowerCard key={b.id} bower={b} />
          ))}
        </div>
      )}
    </div>
  );
}
