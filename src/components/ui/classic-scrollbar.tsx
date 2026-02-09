import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

type ClassicScrollbarProps = {
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;
  scrollStep?: number;
};

export function ClassicScrollbar({
  targetRef,
  className,
  scrollStep = 48,
}: ClassicScrollbarProps) {
  const [metrics, setMetrics] = React.useState({
    thumbTop: 0,
    thumbHeight: 24,
    trackHeight: 0,
    maxThumbTop: 0,
  });

  const draggingRef = React.useRef<{
    startY: number;
    startTop: number;
    pointerId: number;
  } | null>(null);

  const recalc = React.useCallback(() => {
    const el = targetRef.current;
    if (!el) return;

    const clientHeight = el.clientHeight;
    const scrollHeight = el.scrollHeight;
    const scrollTop = el.scrollTop;

    const buttonHeight = 16;
    const trackHeight = Math.max(0, clientHeight - buttonHeight * 2);

    // If there isn't enough space, keep a minimal thumb.
    if (trackHeight === 0 || scrollHeight <= 0) {
      setMetrics({
        thumbTop: 0,
        thumbHeight: 24,
        trackHeight,
        maxThumbTop: 0,
      });
      return;
    }

    // If content doesn't overflow, thumb fills the track.
    if (scrollHeight <= clientHeight) {
      setMetrics({
        thumbTop: 0,
        thumbHeight: trackHeight,
        trackHeight,
        maxThumbTop: 0,
      });
      return;
    }

    const visibleRatio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(24, Math.round(trackHeight * visibleRatio));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = Math.round(
      (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop,
    );

    setMetrics({
      thumbTop: Number.isFinite(thumbTop) ? thumbTop : 0,
      thumbHeight,
      trackHeight,
      maxThumbTop,
    });
  }, [targetRef]);

  React.useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    recalc();

    const onScroll = () => recalc();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => recalc())
        : null;
    ro?.observe(el);

    window.addEventListener("resize", recalc);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [recalc, targetRef]);

  const scrollBy = (delta: number) => {
    targetRef.current?.scrollBy({ top: delta, behavior: "auto" });
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = targetRef.current;
    if (!el) return;

    // Avoid when clicking directly on the thumb
    if ((e.target as HTMLElement).dataset.thumb === "true") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const thumbCenter = metrics.thumbTop + metrics.thumbHeight / 2;
    if (y < thumbCenter) scrollBy(-el.clientHeight);
    else scrollBy(el.clientHeight);
  };

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      startY: e.clientY,
      startTop: metrics.thumbTop,
      pointerId: e.pointerId,
    };
  };

  const onThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = targetRef.current;
    if (!el) return;

    const drag = draggingRef.current;
    if (!drag) return;

    const clientHeight = el.clientHeight;
    const scrollHeight = el.scrollHeight;
    if (scrollHeight <= clientHeight) return;

    const dy = e.clientY - drag.startY;
    const nextThumbTop = Math.min(
      metrics.maxThumbTop,
      Math.max(0, drag.startTop + dy),
    );

    const scrollMax = scrollHeight - clientHeight;
    const denom = metrics.maxThumbTop || 1;
    const nextScrollTop = (nextThumbTop / denom) * scrollMax;
    el.scrollTop = nextScrollTop;
  };

  const onThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current?.pointerId === e.pointerId) {
      draggingRef.current = null;
    }
  };

  return (
    <div className={cn("classic-scrollbar", className)} aria-hidden="true">
      <button
        type="button"
        className="classic-scrollbar-btn"
        tabIndex={-1}
        aria-label="Rolar para cima"
        onClick={() => scrollBy(-scrollStep)}
      >
        <ChevronUp className="h-3 w-3" />
      </button>

      <div
        className="classic-scrollbar-track"
        onPointerDown={onTrackPointerDown}
      >
        <div
          data-thumb="true"
          className="classic-scrollbar-thumb"
          style={{ top: metrics.thumbTop, height: metrics.thumbHeight }}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
        />
      </div>

      <button
        type="button"
        className="classic-scrollbar-btn"
        tabIndex={-1}
        aria-label="Rolar para baixo"
        onClick={() => scrollBy(scrollStep)}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}
