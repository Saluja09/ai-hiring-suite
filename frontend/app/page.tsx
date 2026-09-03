import Link from "next/link";
import {
  ArrowRight,
  Mic,
  Users,
  CalendarCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TourButton } from "@/components/tour-button";

const sections = [
  {
    href: "/hiring-assistant",
    icon: Mic,
    title: "Hiring Assistant",
    description:
      "Spin up a voice agent from a job description and let it screen candidates end-to-end — no dialer, no script writing.",
    tag: "Voice screening",
    tourId: "card-hiring",
  },
  {
    href: "/people-reachout",
    icon: Users,
    title: "People Reachout",
    description:
      "Search and shortlist candidates by role, then launch bulk outbound calls tracked live in one campaign view.",
    tag: "Sourcing & outreach",
    tourId: "card-reachout",
  },
  {
    href: "/attendance",
    icon: CalendarCheck,
    title: "Attendance",
    description:
      "Automated voice check-ins that confirm availability and attendance, with results streamed back in real time.",
    tag: "Ops automation",
    tourId: "card-attendance",
  },
] as const;

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Ambient accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent)_0%,transparent_70%)] opacity-60"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            AI Hiring Suite
          </span>
        </div>
        <div className="flex items-center gap-3">
          <TourButton page="landing" />
          <Badge variant="outline" className="hidden sm:inline-flex">
            Built on Hunar
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6">
        <section className="flex flex-col items-start gap-6 py-16 sm:py-24">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            Voice-AI hiring, end to end
          </Badge>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Hire faster with a voice agent that screens, reaches out, and
            checks in — on your behalf.
          </h1>

          <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
            AI Hiring Suite runs on Hunar&apos;s voice infrastructure to
            automate the repetitive parts of recruiting: candidate screening
            calls, bulk outreach campaigns, and attendance confirmations —
            all from a single, typed control plane.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/hiring-assistant"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Start a hiring campaign
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/people-reachout"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Explore people search
            </Link>
          </div>
        </section>

        <section className="grid gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ href, icon: Icon, title, description, tag, tourId }) => (
            <Link key={href} href={href} className="group">
              <Card
                data-tour={tourId}
                className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30"
              >
                <CardHeader>
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent />
                <CardFooter className="justify-between border-t-0 bg-transparent">
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {tag}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open
                    <ArrowRight className="size-3.5" />
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-border px-6 py-8 text-sm text-muted-foreground">
        AI Hiring Suite — powered by Hunar voice agents.
      </footer>
    </div>
  );
}
