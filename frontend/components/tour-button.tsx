"use client";

import * as React from "react";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { maybeAutoStartTour, startTour, type TourPage } from "@/lib/tour";

export interface TourButtonProps {
  page: TourPage;
}

/**
 * Drop this into any page's header to give it a guided tour: it auto-starts
 * the tour once per browser on first visit (via `maybeAutoStartTour`), and
 * always lets the visitor replay it on demand.
 */
export function TourButton({ page }: TourButtonProps) {
  React.useEffect(() => {
    maybeAutoStartTour(page);
  }, [page]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => startTour(page)}
      className="gap-1.5 text-muted-foreground"
    >
      <Compass className="size-4" />
      Take a tour
    </Button>
  );
}

export default TourButton;
