"use client";

import * as React from "react";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cancelPendingAutoStartTour,
  maybeAutoStartTour,
  startTour,
  type TourPage,
} from "@/lib/tour";

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
    // Cancel any pending auto-start timer on cleanup so React StrictMode's
    // dev-mode mount→cleanup→remount cycle cancels the first timer instead
    // of letting two timers race and start two tours.
    return () => {
      cancelPendingAutoStartTour();
    };
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
