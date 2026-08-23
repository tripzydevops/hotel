/**
 * Shared Framer Motion animation variants for the Dashboard page components.
 */

export const fadeInScaleVariant = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 },
};

export const fadeInUpVariant = (delay: number = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay },
});

export const tileHoverVariant = {
  whileHover: { y: -5, scale: 1.02 },
  transition: { type: "spring", stiffness: 300, damping: 20 },
};
