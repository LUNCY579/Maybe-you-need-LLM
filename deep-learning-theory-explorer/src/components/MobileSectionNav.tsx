import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

/**
 * The small-screen section strip.
 *
 * Below the `lg` breakpoint the navigation rail is hidden, and the same links
 * become a horizontal strip. A strip that silently runs off the edge is a
 * strip people do not know they can scroll, so this one fades the edge that
 * still has content behind it, keeps the active link in view when the route
 * changes, and scrolls the active link into view on arrival.
 */
export function MobileSectionNav({
  items,
}: {
  items: Array<{ to: string; label: string; hint: string }>;
}) {
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const update = () => {
      const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
      setOverflowing(remaining > 2);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    if (typeof ResizeObserver === 'undefined') return () => el.removeEventListener('scroll', update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  // Bring the current section into view: a reader who arrives at a deep page
  // should see which part of the course they are in.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-active="true"]')?.closest('a');
    if (!active) return;
    const left = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    } else {
      el.scrollLeft = Math.max(0, left);
    }
  }, [location.pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="scrollbar-thin flex gap-1 overflow-x-auto px-2 py-2"
      style={
        overflowing
          ? { maskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)' }
          : undefined
      }
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.hint}
          end={item.to === '/'}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
              isActive
                ? 'border-signal-blue/50 bg-signal-blue/15 text-signal-blue'
                : 'border-lab-700 text-lab-300 hover:bg-lab-800 hover:text-lab-100'
            }`
          }
        >
          {({ isActive }) => (
            <span data-active={isActive ? 'true' : 'false'}>{item.label}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
