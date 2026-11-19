/*
 * Vänt: page labels and shopping events for Microsoft Clarity.
 * Lets recordings be filtered by page type and by what the shopper did
 * (added a layout, opened the basket, clicked checkout...).
 * Uses the standard Clarity queue, so calls made before Clarity loads (or
 * without cookie consent) simply wait in the queue and nothing breaks.
 */
(function () {
  if (window.Shopify && window.Shopify.designMode) return;

  window.clarity =
    window.clarity ||
    function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };

  var page = window.VantPage || {};
  var sent = {};

  function tag(key, value) {
    if (value) window.clarity('set', key, String(value));
  }

  function event(name, once) {
    if (once && sent[name]) return;
    sent[name] = true;
    window.clarity('event', name);
  }

  function kindOfProduct(type) {
    var t = String(type || '').toLowerCase();
    if (t === 'box') return 'pack';
    if (t === 'swatch') return 'swatch';
    if (t === 'bed' || t === 'bench' || t === 'table') return 'furniture';
    if (t === 'accent wall' || t === 'king' || t === 'double' || t === 'twin') return 'layout';
    return 'other';
  }

  // ---- Page labels ----
  var params = new URLSearchParams(window.location.search);
  var type = page.type;
  var label = type;

  if (type === 'index') label = 'home';
  else if (type === 'cart') label = 'basket';
  else if (type === 'search') label = 'search';
  else if (type === 'product') label = 'product-' + kindOfProduct(page.productType);
  else if (type === 'collection') {
    var handle = page.handle || '';
    if (handle === 'panels') label = 'headboard-walls';
    else if (handle === 'pre-configured-layouts') label = 'layouts';
    else if (handle === 'order-swatches') label = 'swatches';
    else if (handle === 'platform-beds' || page.suffix === 'beds') label = 'furniture';
    else label = 'collection-' + handle;
  } else if (type === 'page') {
    label = 'page-' + (params.get('view') || page.suffix || page.handle || 'other');
  }

  tag('page_type', label);
  if (page.productTitle) tag('product', page.productTitle);
  if (params.get('bed')) tag('bed_size', params.get('bed'));
  if (params.get('type')) tag('furniture_type', params.get('type'));

  // ---- Added to basket (all Vänt add buttons go through VantCart) ----
  document.addEventListener('vant:added', function (e) {
    var items = (e.detail && e.detail.items) || [];
    var kinds = {};
    items.forEach(function (item) {
      kinds[kindOfProduct(item.product_type)] = true;
    });
    Object.keys(kinds).forEach(function (kind) {
      event('added_' + kind);
    });
    event('added_to_basket');
  });

  // ---- Clicks ----
  document.addEventListener(
    'click',
    function (e) {
      var el = e.target && e.target.closest ? e.target : null;
      if (!el) return;

      if (el.closest('button[name="checkout"], a[href*="/checkout"]')) event('checkout_clicked');
      else if (el.closest('[data-vant-video], [data-vant-thumb="video"], .vant-vf__play')) event('video_played', true);
      else if (el.closest('.vant-size__card')) event('size_card_clicked');
      else if (el.closest('a[href^="tel:"]')) event('phone_tapped');
      else if (el.closest('a[href^="mailto:"]')) event('email_tapped');
      else if (el.closest('a[href*="order-swatches"]')) event('swatch_link_clicked');
    },
    true
  );

  // ---- FAQ opened ----
  document.addEventListener(
    'toggle',
    function (e) {
      var d = e.target;
      if (!d || !d.open || !d.classList) return;
      if (d.classList.contains('vant-faq__item')) event('faq_opened');
      else if (d.classList.contains('vant-pdp__detail')) {
        // Product detail tabs: "Fire safety" -> opened_fire_safety
        var summary = d.querySelector('summary');
        var name = summary ? summary.textContent.trim().toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '') : '';
        if (name) event('opened_' + name.slice(0, 30));
      }
    },
    true
  );

  // ---- Basket drawer opened ----
  // The drawer markup can be re-rendered, so watch the whole page for a dialog opening.
  function watchDrawer() {
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var el = records[i].target;
        if (el.open && el.getAttribute && el.getAttribute('aria-labelledby') === 'cart-drawer-heading') {
          event('basket_opened');
          return;
        }
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchDrawer);
  else watchDrawer();
})();
