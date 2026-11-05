/*
 * Vänt product page: fabric tabs, colour circles, size links, gallery, quantity, total,
 * add to basket (via window.VantCart) and the mobile sticky bar.
 */
(() => {
  const handleize = (text) =>
    String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const init = (root) => {
    if (root.dataset.vantReady) return;
    root.dataset.vantReady = 'true';

    const jsonEl = root.querySelector('[data-vant-product-json]');
    if (!jsonEl) return;
    let data;
    try {
      data = JSON.parse(jsonEl.textContent);
    } catch (error) {
      console.warn('[vant-product] Could not read product data', error);
      return;
    }

    const money = (cents) => {
      const whole = cents % 100 === 0;
      try {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: data.currency || 'GBP',
          minimumFractionDigits: whole ? 0 : 2,
          maximumFractionDigits: whole ? 0 : 2,
        }).format(cents / 100);
      } catch (e) {
        return `£${(cents / 100).toFixed(whole ? 0 : 2)}`;
      }
    };

    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => Array.from(root.querySelectorAll(sel));

    const els = {
      id: $('[data-vant-id]'),
      price: $('[data-vant-price]'),
      total: $('[data-vant-total]'),
      qty: $('[data-vant-qty-input]'),
      add: $('[data-vant-add]'),
      addLabel: $('[data-vant-add-label]'),
      error: $('[data-vant-error]'),
      form: $('[data-vant-form]'),
      colourLabel: $('[data-vant-colour-label]'),
      swatchLink: $('[data-vant-swatch-link]'),
      mainImg: $('.vant-pdp__main-img'),
      caption: $('[data-vant-caption]'),
      thumbVariant: $('[data-vant-thumb="variant"]'),
      thumbCloseup: $('[data-vant-thumb="closeup"]'),
      thumbCompanion: $('[data-vant-thumb="companion"]'),
      alt: $('[data-vant-alt]'),
      note: $('[data-vant-gallery-note]'),
      diagramTpl: $('template[data-vant-diagram]'),
      videoTpl: $('template[data-vant-video]'),
      bar: $('[data-vant-bar]'),
      barName: $('[data-vant-bar-name]'),
      barPrice: $('[data-vant-bar-price]'),
      barAdd: $('[data-vant-bar-add]'),
    };

    const variants = data.variants || [];
    const fabricName = (fabric) => (data.fabricNames && data.fabricNames[fabric]) || fabric;
    const currentId = Number(els.id && els.id.value);
    let variant = variants.find((v) => v.id === currentId) || variants[0];
    if (!variant) return;

    // ?colour=velvet-sand-storm (from swatch and size links) picks the colour when no ?variant= is set.
    const params = new URLSearchParams(window.location.search);
    const wantedColour = params.get('colour');
    if (wantedColour && !params.get('variant')) {
      const key = handleize(wantedColour);
      const match =
        variants.find((v) => v.key === key && v.available) ||
        variants.find((v) => v.key === key) ||
        variants.find((v) => handleize(`${v.fabric} ${v.colour}`) === key) ||
        variants.find((v) => v.swatchHandle === key) ||
        variants.find((v) => key.endsWith(handleize(v.colour)) && v.available);
      if (match) variant = match;
    }

    let fabric = variant.fabric;
    let galleryMode = 'variant';

    const quantity = () => Math.max(1, Math.min(50, parseInt(els.qty && els.qty.value, 10) || 1));

    const showAlt = (template) => {
      if (!els.alt) return;
      els.alt.innerHTML = '';
      if (template) {
        els.alt.appendChild(template.content.cloneNode(true));
        const video = els.alt.querySelector('video');
        if (video) {
          video.muted = true;
          video.play().catch(() => {});
        }
      }
      els.alt.hidden = !template;
    };

    const setNote = (text) => {
      if (!els.note) return;
      els.note.textContent = text || '';
      els.note.hidden = !text;
    };

    const setMainImage = (src, srcset, cover) => {
      showAlt(null);
      setNote('');
      if (!els.mainImg || !src) return;
      if (els.mainImg.getAttribute('src') === src) return;
      els.mainImg.classList.add('is-loading');
      const done = () => els.mainImg.classList.remove('is-loading');
      els.mainImg.addEventListener('load', done, { once: true });
      els.mainImg.addEventListener('error', done, { once: true });
      if (srcset) els.mainImg.setAttribute('srcset', srcset);
      else els.mainImg.removeAttribute('srcset');
      els.mainImg.setAttribute('src', src);
      els.mainImg.classList.toggle('is-cover', Boolean(cover));
    };

    const setActiveThumb = (thumb) => {
      $$('[data-vant-thumb]').forEach((t) => t.classList.toggle('is-active', t === thumb));
    };

    const label = () => `${fabricName(variant.fabric)} · ${variant.colour}`;

    const updateTotals = () => {
      const qty = quantity();
      if (els.total) {
        const unit = data.unit ? ` for ${qty} ${data.unit}${qty > 1 && data.unit === 'box' ? 'es' : qty > 1 ? 's' : ''}` : '';
        els.total.textContent = `${money(variant.price * qty)}${unit}`;
      }
      if (els.barPrice) {
        els.barPrice.textContent = data.unit
          ? `${money(variant.price * qty)} · ${qty} ${data.unit}${qty > 1 && data.unit === 'box' ? 'es' : qty > 1 ? 's' : ''}`
          : money(variant.price);
      }
    };

    const render = ({ pushUrl = true } = {}) => {
      // Fabric tabs
      $$('[data-vant-fabric]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.vantFabric === fabric)));

      // Colour circles for this fabric
      $$('[data-vant-colour]').forEach((btn) => {
        const inFabric = btn.dataset.fabric === fabric;
        btn.hidden = !inFabric;
        btn.setAttribute('aria-pressed', String(inFabric && btn.dataset.vantColour === variant.colour));
      });

      if (els.id) els.id.value = variant.id;
      if (els.price) els.price.textContent = money(variant.price);
      if (els.colourLabel) els.colourLabel.textContent = variant.colour;

      if (els.add) {
        els.add.disabled = !variant.available;
        if (els.addLabel) els.addLabel.textContent = variant.available ? data.addLabel : 'Sold out';
      }
      if (els.barAdd) els.barAdd.disabled = !variant.available;
      if (els.error) els.error.hidden = true;

      if (els.swatchLink) {
        const key = variant.swatchHandle || variant.key;
        els.swatchLink.href = `${data.swatchUrl}?colour=${encodeURIComponent(key)}`;
      }

      // Size links keep the chosen colour
      $$('[data-vant-size-link]').forEach((a) => {
        try {
          const url = new URL(a.href, window.location.origin);
          url.searchParams.set('colour', variant.key);
          const view = params.get('view');
          if (view && !url.searchParams.get('view')) url.searchParams.set('view', view);
          a.href = url.pathname + url.search;
        } catch (e) {}
      });

      // Gallery: variant photo + fabric close-up
      if (els.thumbVariant && variant.thumb) {
        els.thumbVariant.innerHTML = `<img src="${variant.thumb}" alt="" loading="lazy">`;
      }
      if (els.thumbCloseup) {
        if (variant.closeupThumb) {
          els.thumbCloseup.hidden = false;
          els.thumbCloseup.innerHTML = `<img src="${variant.closeupThumb}" alt="" loading="lazy">`;
        } else {
          els.thumbCloseup.hidden = true;
          if (galleryMode === 'closeup') galleryMode = 'variant';
        }
      }
      if (els.thumbCompanion) {
        if (variant.companionThumb) {
          els.thumbCompanion.hidden = false;
          els.thumbCompanion.innerHTML = `<img src="${variant.companionThumb}" alt="" loading="lazy">`;
        } else {
          els.thumbCompanion.hidden = true;
          if (galleryMode === 'companion') galleryMode = 'variant';
        }
      }
      if (galleryMode === 'companion' && variant.companion) {
        setMainImage(variant.companion, variant.companionSrcset, false);
        if (els.caption) els.caption.textContent = els.thumbCompanion.dataset.caption || label();
        setActiveThumb(els.thumbCompanion);
      } else if (galleryMode === 'closeup' && variant.closeup) {
        setMainImage(variant.closeup, '', true);
        if (els.caption) els.caption.textContent = `${label()} close-up`;
        setActiveThumb(els.thumbCloseup);
      } else if (galleryMode === 'variant') {
        setMainImage(variant.img, variant.srcset, false);
        if (els.caption) els.caption.textContent = label();
        setActiveThumb(els.thumbVariant);
      }

      // Anything on the page that names the colour (e.g. "Match your Sand Storm panels")
      document.querySelectorAll('[data-vant-colour-name]').forEach((el) => {
        el.textContent = variant.colour;
      });

      if (els.barName) els.barName.textContent = label();
      updateTotals();

      if (pushUrl) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          url.searchParams.delete('colour');
          history.replaceState(history.state, '', url.pathname + url.search + url.hash);
        } catch (e) {}
      }
    };

    // Fabric tabs
    $$('[data-vant-fabric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        fabric = btn.dataset.vantFabric;
        if (variant.fabric !== fabric) {
          const inFabric = variants.filter((v) => v.fabric === fabric);
          variant =
            inFabric.find((v) => v.colour === variant.colour && v.available) ||
            inFabric.find((v) => v.available) ||
            inFabric[0] ||
            variant;
        }
        render();
      });
    });

    // Colour circles
    $$('[data-vant-colour]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const match = variants.find((v) => v.fabric === btn.dataset.fabric && v.colour === btn.dataset.vantColour);
        if (!match) return;
        variant = match;
        fabric = match.fabric;
        render();
      });
    });

    // Thumbnails
    $$('[data-vant-thumb]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const kind = thumb.dataset.vantThumb;
        galleryMode = kind;
        if (kind === 'diagram' || kind === 'video') {
          showAlt(kind === 'diagram' ? els.diagramTpl : els.videoTpl);
          if (els.caption) els.caption.textContent = thumb.dataset.caption || '';
          setNote(thumb.dataset.note || '');
          setActiveThumb(thumb);
          return;
        }
        if (kind === 'extra') {
          setMainImage(thumb.dataset.src, thumb.dataset.srcset, true);
          if (els.caption) els.caption.textContent = thumb.dataset.caption || '';
          setActiveThumb(thumb);
          return;
        }
        render({ pushUrl: false });
      });
    });

    // Quantity
    $$('[data-vant-qty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!els.qty) return;
        els.qty.value = Math.max(1, Math.min(50, quantity() + Number(btn.dataset.vantQty)));
        updateTotals();
      });
    });
    if (els.qty) {
      els.qty.addEventListener('input', updateTotals);
      els.qty.addEventListener('change', () => {
        els.qty.value = quantity();
        updateTotals();
      });
    }

    // Add to basket
    const addToBasket = async () => {
      if (!variant.available || !els.add) return;
      if (!window.VantCart) {
        els.form.submit();
        return;
      }
      els.add.classList.add('is-busy');
      if (els.barAdd) els.barAdd.classList.add('is-busy');
      try {
        await window.VantCart.add([{ id: variant.id, quantity: quantity() }], els.add);
      } catch (error) {
        if (els.error) {
          els.error.textContent = error && error.message ? error.message : 'Sorry, that could not be added. Please try again.';
          els.error.hidden = false;
        }
      } finally {
        els.add.classList.remove('is-busy');
        if (els.barAdd) els.barAdd.classList.remove('is-busy');
      }
    };

    if (els.form) {
      els.form.addEventListener('submit', (event) => {
        event.preventDefault();
        addToBasket();
      });
    }
    if (els.barAdd) els.barAdd.addEventListener('click', addToBasket);

    // Mobile sticky bar: visible when the main button has scrolled above the screen
    if (els.bar && els.add && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          const above = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          els.bar.classList.toggle('is-visible', above);
          els.bar.setAttribute('aria-hidden', String(!above));
          if (els.barAdd) els.barAdd.tabIndex = above ? 0 : -1;
        },
        { threshold: 0 }
      );
      observer.observe(els.add);
    }

    // "How many do I need?" pop-up
    const help = $('[data-vant-help]');
    const helpOpen = $('[data-vant-help-open]');
    if (help && helpOpen && typeof help.showModal === 'function') {
      helpOpen.addEventListener('click', () => help.showModal());
      help.addEventListener('click', (event) => {
        if (event.target === help || event.target.closest('[data-vant-help-close]')) help.close();
      });
    }

    render({ pushUrl: Boolean(wantedColour) });
  };

  const start = () => document.querySelectorAll('[data-vant-product]').forEach(init);
  start();
  document.addEventListener('shopify:section:load', start);
})();
