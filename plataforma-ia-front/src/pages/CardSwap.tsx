import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, type Easing } from 'framer-motion';

export interface CardSwapProps {
  children: React.ReactNode;
  verticalDistance?: number;
  horizontalDistance?: number;
  scaleOffset?: number;
  mainCardScale?: number;
  delay?: number;
  pauseOnHover?: boolean;
  skewAmount?: number;
  easing?: string | number[];
  className?: string;
  containerClassName?: string;
}

export const CardSwap: React.FC<CardSwapProps> = ({
  children,
  verticalDistance = 30,
  horizontalDistance = 30,
  scaleOffset = 0.05,
  mainCardScale = 1.1,
  delay = 5000,
  pauseOnHover = true,
  skewAmount: _skewAmount = 0,
  easing = "backOut",
  className = "w-full max-w-sm",
  containerClassName = "relative w-full h-full flex justify-center items-center",
}) => {
  const cards = React.Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    resetTimeout();
    if (pauseOnHover && isHovered) return;

    timeoutRef.current = setTimeout(() => {
      setActiveIndex((prevIndex) =>
        prevIndex === cards.length - 1 ? 0 : prevIndex + 1
      );
    }, delay);

    return () => resetTimeout();
  }, [activeIndex, isHovered, delay, pauseOnHover, cards.length]);

  return (
    <div
      className={containerClassName}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`relative h-full flex justify-center items-center ${className}`}>
        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => {
            let relativeIndex = index - activeIndex;
            if (relativeIndex < 0) {
              relativeIndex += cards.length;
            }

            const zIndex = cards.length - relativeIndex;
            // La principal es más grande, las demás siguen el scaleOffset
            const scale = relativeIndex === 0 ? mainCardScale : 1 - (relativeIndex * scaleOffset);
            const yOffset = relativeIndex * verticalDistance;
            const xOffset = relativeIndex * horizontalDistance;

            return (
              <motion.div
                key={index}
                className="absolute w-full flex justify-center origin-center cursor-pointer"
                style={{ zIndex }}
                initial={{ opacity: 0, scale: 0.8, x: 200, y: 200, rotate: 0 }}
                animate={{
                  opacity: 1,
                  scale,
                  y: yOffset,
                  x: xOffset,
                  rotate: 0,
                }}
                exit={{ opacity: 0, scale: 1.1, x: 200, y: 200, rotate: 0 }}
                transition={{ duration: 0.8, ease: easing as unknown as Easing }}
                onClick={() => {
                   if (relativeIndex !== 0) {
                      setActiveIndex(index);
                   }
                }}
              >
                {card}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div
      className={`rounded-[2rem] p-6 shadow-2xl w-full ${className}`}
    >
      {children}
    </div>
  );
};

export default CardSwap;