import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface CountUpProps {
  to: number;
  from?: number;
  direction?: "up" | "down";
  delay?: number;
  duration?: number; // Duration in seconds
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  className = "",
  startWhen = true,
  separator = "",
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? to : from);

  // Spring configuration for smooth counting
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 80,
  });

  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    // duration parameter is not used in spring physics (duration is in Props interface)
    if (isInView && startWhen) {
      if (typeof onStart === "function") onStart();

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === "down" ? from : to);
      }, delay * 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart]);

  useEffect(() => {
    return springValue.on("change", (latest: number) => {
      if (ref.current) {
        const options = {
          useGrouping: !!separator,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        };

        const formattedNumber = Intl.NumberFormat("en-US", options).format(
          Math.round(latest)
        );

        ref.current.textContent = separator
          ? formattedNumber.replace(/,/g, separator)
          : formattedNumber;
      }

      if (latest === (direction === "down" ? from : to)) {
        if (typeof onEnd === "function") onEnd();
      }
    });
  }, [springValue, separator, direction, from, to, onEnd]);

  const initialValue = direction === "down" ? to : from;
  const initialFormatted = Intl.NumberFormat("en-US", {
    useGrouping: !!separator,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(initialValue);
  const initialText = separator
    ? initialFormatted.replace(/,/g, separator)
    : initialFormatted;

  return (
    <span className={className} ref={ref}>
      {initialText}
    </span>
  );
}
