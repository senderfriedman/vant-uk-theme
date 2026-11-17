/*
 * Vänt: the phone's Back button closes whatever is open on top of the page
 * (video pop-up, menu drawer, basket drawer, search, email pop-up) instead of leaving the page.
 *
 * How: when something opens, one extra step is added to the browser history.
 * Back removes that step, and we close what is open. If the shopper closes it
 * another way (the X, tapping outside), we take the extra step away again.
 */
(() => {
  if (window.vantBackCloseReady || !window.history || !history.pushState) return;
  window.vantBackCloseReady = true;

  const FLAG = 'vantOverlay';
  let pushed = false;
  let ignoreNextPop = false;

  const visible = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  const openDialogs = () =>
    Array.from(document.querySelectorAll('dialog[open]')).filter((dialog) => {
      try {
        return dialog.matches(':modal');
      } catch (e) {
        return true;
      }
    });

  const openMenus = () =>
    Array.from(document.querySelectorAll('header-drawer')).filter((drawer) => {
      if (typeof drawer.isOpen === 'boolean') return drawer.isOpen;
      return Boolean(drawer.querySelector('details[open]'));
    });

  // Email pop-up from Klaviyo (not a native dialog)
  const openForms = () =>
    Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).filter(
      (el) => el.tagName !== 'DIALOG' && visible(el) && el.closest('[class*="klaviyo"], [class*="kl-private"], .needsclick')
    );

  const anyOpen = () => openDialogs().length + openMenus().length + openForms().length > 0;

  const closeDialog = (dialog) => {
    // Prefer the theme's own close, so its animation and clean-up run
    let node = dialog.parentElement;
    while (node && node !== document.body) {
      if (node.tagName.includes('-')) {
        if (typeof node.closeDialog === 'function') return node.closeDialog();
        if (typeof node.close === 'function') return node.close();
      }
      node = node.parentElement;
    }
    dialog.close();
    return undefined;
  };

  const closeAll = () => {
    openDialogs().forEach((dialog) => {
      try {
        closeDialog(dialog);
      } catch (e) {
        try {
          dialog.close();
        } catch (e2) {}
      }
      // Safety net if the theme's close did not finish
      setTimeout(() => {
        try {
          if (dialog.open) dialog.close();
        } catch (e) {}
      }, 700);
    });
    openMenus().forEach((drawer) => {
      try {
        if (typeof drawer.close === 'function') drawer.close();
        else drawer.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
      } catch (e) {}
    });
    openForms().forEach((form) => {
      const button = form.querySelector('.klaviyo-close-form, button[aria-label*="Close" i]');
      if (button) button.click();
    });
  };

  const sync = () => {
    const open = anyOpen();
    if (open && !pushed) {
      try {
        history.pushState(Object.assign({}, history.state, { [FLAG]: true }), '');
        pushed = true;
      } catch (e) {}
    } else if (!open && pushed) {
      pushed = false;
      if (history.state && history.state[FLAG]) {
        ignoreNextPop = true;
        history.back();
      }
    }
  };

  let queued = false;
  const queueSync = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };

  window.addEventListener('popstate', () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    if (pushed) {
      pushed = false;
      closeAll();
    }
  });

  const start = () => {
    // Arrived on a leftover extra step with nothing open (e.g. after following a link from the menu): drop it
    if (history.state && history.state[FLAG] && !anyOpen()) {
      ignoreNextPop = true;
      history.back();
    }
    new MutationObserver(queueSync).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open', 'aria-modal'],
    });
    queueSync();
  };

  // Page restored from the browser's back/forward cache with something still open
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) pushed = Boolean(history.state && history.state[FLAG]) && anyOpen();
  });

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
