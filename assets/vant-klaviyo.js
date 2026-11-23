/*
 * Vänt: tell Klaviyo what is in the basket whenever something is added.
 *
 * Klaviyo's own Shopify tracking does not see our basket, because we add items
 * with a direct request rather than a form submit. Without this, the "Added to
 * Cart" metric never fires and any flow built on it never runs.
 *
 * We send the WHOLE basket, not just the item just added, so an abandonment
 * email can list everything the shopper left behind. The payload uses Klaviyo's
 * standard property names so their templates read it without custom code.
 *
 * Klaviyo only records this for visitors it can already identify (someone who
 * arrived from one of our emails, or signed up to a form). For everyone else the
 * call is queued and discarded. That is Klaviyo's behaviour, not a bug here.
 */
(function () {
  if (window.Shopify && window.Shopify.designMode) return;

  // Klaviyo's own queue: calls made before their script loads are replayed.
  window.klaviyo = window.klaviyo || [];

  var money = function (cents) {
    var n = Number(cents);
    return isFinite(n) ? Math.round(n) / 100 : 0;
  };

  var absolute = function (path) {
    if (!path) return '';
    var url = String(path);
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('http') === 0) return url;
    return window.location.origin + (url.charAt(0) === '/' ? url : '/' + url);
  };

  // A link that rebuilds this basket on any device, for the email's button.
  var basketLink = function (items) {
    var parts = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].variant_id) parts.push(items[i].variant_id + ':' + items[i].quantity);
    }
    return parts.length ? window.location.origin + '/cart/' + parts.join(',') : window.location.origin + '/cart';
  };

  var line = function (item) {
    return {
      ProductID: item.product_id,
      VariantID: item.variant_id,
      SKU: item.sku || '',
      ProductName: item.product_title || item.title || '',
      VariantName: item.variant_title || '',
      Quantity: item.quantity,
      ItemPrice: money(item.price),
      RowTotal: money(item.line_price),
      ProductURL: absolute(item.url),
      ImageURL: absolute(item.image),
      ProductCategories: item.product_type ? [item.product_type] : [],
    };
  };

  function send(cart, added) {
    if (!cart || !cart.items || !cart.items.length) return;

    var names = [];
    var lines = [];
    for (var i = 0; i < cart.items.length; i++) {
      lines.push(line(cart.items[i]));
      names.push(cart.items[i].product_title || cart.items[i].title || '');
    }

    var payload = {
      // The basket as a whole — this is what an abandonment email lists.
      $value: money(cart.total_price),
      ItemNames: names,
      Items: lines,
      CheckoutURL: basketLink(cart.items),
      TotalQuantity: cart.item_count,
      Currency: cart.currency || 'GBP',
    };

    // The one just added, so an email can open with "you added X".
    if (added) {
      payload.AddedItemProductID = added.ProductID;
      payload.AddedItemProductName = added.ProductName;
      payload.AddedItemSKU = added.SKU;
      payload.AddedItemQuantity = added.Quantity;
      payload.AddedItemPrice = added.ItemPrice;
      payload.AddedItemURL = added.ProductURL;
      payload.AddedItemImageURL = added.ImageURL;
      payload.AddedItemCategories = added.ProductCategories;
    }

    try {
      window.klaviyo.push(['track', 'Added to Cart', payload]);
    } catch (error) {
      // Never let analytics break adding to the basket.
      if (window.console) console.warn('[vant-klaviyo] could not send Added to Cart', error);
    }
  }

  // Match the item just added against the basket, so its line carries the
  // basket's own quantity and totals rather than the single add.
  function matchAdded(cart, addedItems) {
    if (!addedItems || !addedItems.length) return null;
    var wanted = String(addedItems[0].variant_id || addedItems[0].id || '');
    for (var i = 0; i < cart.items.length; i++) {
      if (String(cart.items[i].variant_id) === wanted) return line(cart.items[i]);
    }
    return line(addedItems[0]);
  }

  document.addEventListener('vant:added', function (event) {
    var detail = (event && event.detail) || {};
    var cart = detail.cart;

    if (cart && cart.items) {
      send(cart, matchAdded(cart, detail.items));
      return;
    }

    // Older callers did not pass the basket; ask Shopify for it.
    fetch('/cart.js', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (fetched) {
        if (fetched) send(fetched, matchAdded(fetched, detail.items));
      })
      .catch(function () {
        /* basket unavailable; nothing to report */
      });
  });
})();
