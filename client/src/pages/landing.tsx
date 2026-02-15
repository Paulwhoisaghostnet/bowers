import { Bird, Palette, Shield, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroBower from "../assets/images/hero-bower.png";

const features = [
  {
    icon: Palette,
    title: "Deploy NFT Collections",
    description: "Choose from 4 FA2-compliant contract styles and deploy to Tezos with no code required.",
  },
  {
    icon: Bird,
    title: "Build Your Bower",
    description: "Create a custom showcase for your collection. Your bower is your digital gallery in the marketplace.",
  },
  {
    icon: Users,
    title: "Connect & Collaborate",
    description: "Add friends to highlight near your bower. Follow other artists to stay updated on their activity.",
  },
  {
    icon: Shield,
    title: "Multi-Wallet Support",
    description: "Link multiple Tezos wallets to your account. Manage all your collections from one place.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 backdrop-blur bg-background/80 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Bird className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Bowers</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/marketplace">
              <Button variant="ghost" size="sm" data-testid="link-browse-marketplace">
                Browse
              </Button>
            </a>
            <a href="/api/login">
              <Button size="sm" data-testid="button-login">
                Sign In
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold font-serif tracking-tight leading-tight">
              Build your bower.<br />
              <span className="text-primary">Showcase your art.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
              Deploy FA2 NFT collection contracts on Tezos and create a custom gallery to attract collectors, friends, and followers.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
              <a href="/marketplace">
                <Button variant="outline" size="lg" data-testid="button-view-marketplace">
                  View Marketplace
                </Button>
              </a>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
              <span>Free to use</span>
              <span>Tezos Ghostnet</span>
              <span>No code required</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 rounded-md" />
            <img
              src={heroBower}
              alt="Bowerbird digital art"
              className="w-full rounded-md ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 hover:scale-[1.02]"
            />
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold font-serif text-center mb-10">
            Everything you need to showcase your art
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="p-5 hover-elevate">
                <f.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>Bowers - Tezos NFT Studio</span>
          <span>Built on Tezos</span>
        </div>
      </footer>
    </div>
  );
}
