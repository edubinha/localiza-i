import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showTooltip?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showTooltip = true, ...props }, ref) => {
  const [isHovering, setIsHovering] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0;
  const showValue = isHovering || isDragging;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      onPointerDown={() => setIsDragging(true)}
      onPointerUp={() => setIsDragging(false)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-navy/80 to-navy rounded-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "relative block h-5 w-5 rounded-full border-2 border-navy bg-white shadow-md",
          "transition-all duration-150 ease-out",
          "hover:scale-110 hover:shadow-lg hover:shadow-navy/20",
          "focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
          "cursor-grab active:cursor-grabbing active:scale-105"
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {showTooltip && showValue && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="bg-navy text-white text-xs font-medium px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
              {value} km
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-navy rotate-45" />
          </div>
        )}
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
