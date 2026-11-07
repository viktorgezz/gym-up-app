/**
 * iOS lays the keyboard over the page instead of resizing it. Expose the height it covers
 * as --kb, so a bottom sheet with a number field can sit above the keyboard.
 */
export function trackKeyboard(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement;
  let last = -1;

  const update = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    if (covered === last) return;
    last = covered;
    root.style.setProperty('--kb', `${covered}px`);
  };

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    root.style.removeProperty('--kb');
  };
}
