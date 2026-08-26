import { useEffect, useRef, useState } from "react";

/**
 * useInView
 * Returns a ref to attach to any element and a boolean that flips to
 * true the first time that element enters the viewport. Stays true
 * afterward (one-shot reveal, not a repeating toggle) so scrolling
 * back up doesn't re-hide content.
 *
 * @param {number} threshold - fraction of the element visible before triggering
 * @param {string} rootMargin - shrinks/grows the trigger area, e.g. "-80px"
 */
export default function useInView({ threshold = 0.2, rootMargin = "0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the browser can't do IntersectionObserver, just show it.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}
