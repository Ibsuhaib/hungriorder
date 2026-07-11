// Animated "current location" card — adapted from the shadcn/TSX expand-map
// component to this Vite + JS + Tailwind app: converted to JSX and the shadcn
// theme tokens (background/foreground/muted/border) mapped to the hungriOrder
// palette (white/navy/slate/gold). Click to expand into a stylised mini-map.

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';

export function LocationMap({
  location = 'Location not set',
  coordinates = '',
  className = '',
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8]);
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8]);

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - (rect.left + rect.width / 2));
    mouseY.set(e.clientY - (rect.top + rect.height / 2));
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={containerRef}
      className={`relative cursor-pointer select-none ${className}`}
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsExpanded((v) => !v)}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e1c]"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          width: isExpanded ? 320 : 240,
          height: isExpanded ? 250 : 130,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.06]" />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute inset-0 bg-[#141326]" />

              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                {/* Main roads */}
                <motion.line
                  x1="0%" y1="35%" x2="100%" y2="35%"
                  className="stroke-white/25" strokeWidth="4"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <motion.line
                  x1="0%" y1="65%" x2="100%" y2="65%"
                  className="stroke-white/25" strokeWidth="4"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
                <motion.line
                  x1="30%" y1="0%" x2="30%" y2="100%"
                  className="stroke-white/20" strokeWidth="3"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                />
                <motion.line
                  x1="70%" y1="0%" x2="70%" y2="100%"
                  className="stroke-white/20" strokeWidth="3"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />

                {/* Secondary streets */}
                {[20, 50, 80].map((y, i) => (
                  <motion.line
                    key={`h-${i}`}
                    x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
                    className="stroke-white/10" strokeWidth="1.5"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                  />
                ))}
                {[15, 45, 55, 85].map((x, i) => (
                  <motion.line
                    key={`v-${i}`}
                    x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%"
                    className="stroke-white/10" strokeWidth="1.5"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                  />
                ))}
              </svg>

              {/* Buildings */}
              {[
                'top-[40%] left-[10%] w-[15%] h-[20%]',
                'top-[15%] left-[35%] w-[12%] h-[15%]',
                'top-[70%] left-[75%] w-[18%] h-[18%]',
                'top-[20%] right-[10%] w-[10%] h-[25%]',
                'top-[55%] left-[5%] w-[8%] h-[12%]',
                'top-[8%] left-[75%] w-[14%] h-[10%]',
              ].map((cls, i) => (
                <motion.div
                  key={cls}
                  className={`absolute ${cls} rounded-sm border border-white/15 bg-white/20`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.05 }}
                />
              ))}

              {/* Pin */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }}
              >
                <svg
                  width="32" height="32" viewBox="0 0 24 24" fill="none"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.5))' }}
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#34D399" />
                  <circle cx="12" cy="9" r="2.5" fill="#0e0e1c" />
                </svg>
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e1c] via-transparent to-transparent opacity-60" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid pattern - only when collapsed */}
        <motion.div
          className="absolute inset-0 opacity-[0.03]"
          animate={{ opacity: isExpanded ? 0 : 0.03 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <pattern id="ho-loc-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" className="stroke-white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ho-loc-grid)" />
          </svg>
        </motion.div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-4">
          <div className="flex items-start justify-between">
            <motion.div animate={{ opacity: isExpanded ? 0 : 1 }} transition={{ duration: 0.3 }}>
              <motion.svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-emerald-500"
                animate={{
                  filter: isHovered
                    ? 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.6))'
                    : 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.3))',
                }}
                transition={{ duration: 0.3 }}
              >
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" x2="9" y1="3" y2="18" />
                <line x1="15" x2="15" y1="6" y2="21" />
              </motion.svg>
            </motion.div>

            <motion.div
              className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 backdrop-blur-sm"
              animate={{ scale: isHovered ? 1.05 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Live</span>
            </motion.div>
          </div>

          <div className="space-y-1">
            <motion.h3
              className="text-sm font-medium tracking-tight text-white/90"
              animate={{ x: isHovered ? 4 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.h3>

            <AnimatePresence>
              {isExpanded && coordinates && (
                <motion.p
                  className="font-mono text-xs text-white/40"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {coordinates}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              className="h-px bg-gradient-to-r from-emerald-500/50 via-emerald-400/30 to-transparent"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: isHovered || isExpanded ? 1 : 0.3 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Click hint */}
      <motion.p
        className="absolute -bottom-5 left-1/2 whitespace-nowrap text-[10px] text-white/30"
        style={{ x: '-50%' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered && !isExpanded ? 1 : 0, y: isHovered ? 0 : 4 }}
        transition={{ duration: 0.2 }}
      >
        Click to expand
      </motion.p>
    </motion.div>
  );
}
