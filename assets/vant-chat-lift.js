/*
 * Vänt: on phones, lift the chat bubble (Shopify Inbox) above the bottom bars,
 * so it never covers the Add to basket button.
 *
 * Bars it watches: the swatch tray on the swatches page, the Add to basket bar
 * on product pages, and the theme's own sticky add-to-cart bar.
 * When none of them is on screen, the bubble goes back to its usual place.
 */
(() => {
  if (window.vantChatLiftReady) return;
  window.vantChatLiftReady = true;

  const PHONE = window.matchMedia('(max-width: 749px)');
  const BARS = '.vant-pdp__bar, .vant-sp__tray, .sticky-add-to-cart__bar';
  const GAP = 8;
  let target = null;
  let queued = false;

  // The part of the chat that is fixed to the screen
  const findTarget = () => {
    if (target && target.isConnected) return target;
    const host = document.querySelector('#shopify-chat inbox-online-store-chat, inbox-online-store-chat, #shopify-chat');
    if (!host) return null;
    const fixed = (el) => el && el.nodeType === 1 && getComputedStyle(el).position === 'fixed';
    if (fixed(host)) return (target = host);
    const roots = [host, host.shadowRoot].filter(Boolean);
    for (const root of roots) {
      for (const el of root.querySelectorAll('*')) {
        if (fixed(el)) return (target = el);
        if (el.shadowRoot) {
          for (const inner of el.shadowRoot.querySelectorAll('*')) {
            if (fixed(inner)) return (target = inner);
          }
        }
      }
    }
    return null;
  };

  // How much of the bottom of the screen our bars cover right now
  const barHeight = () => {
    const vh = window.innerHeight;
    let top = vh;
    document.querySelectorAll(BARS).forEach((bar) => {
      const style = getComputedStyle(bar);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return;
      const r = bar.getBoundingClientRect();
      if (!r.height || r.top >= vh - 2 || r.bottom < vh - 4) return; // not sitting on the bottom edge
      top = Math.min(top, r.top);
    });
    return top < vh ? Math.round(vh - top) : 0;
  };

  const update = () => {
    queued = false;
    const el = findTarget();
    if (!el) return;
    const lift = PHONE.matches ? barHeight() : 0;
    el.style.transition = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : 'translate 0.25s ease';
    el.style.translate = lift ? `0 -${lift + GAP}px` : '';
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  PHONE.addEventListener?.('change', queue);

  // Bars show and hide by class; the chat loads late
  new MutationObserver(queue).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  document.addEventListener('DOMContentLoaded', queue);
  window.addEventListener('load', queue);
  queue();
})();
