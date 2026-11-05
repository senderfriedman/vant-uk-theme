/*
 * Vänt: add items to the basket and let Horizon's cart drawer, cart page and basket icon update themselves.
 * Usage: window.VantCart.add([{ id: 123, quantity: 1 }], sourceElement) -> Promise<cart>
 */
import { CartLinesUpdateEvent } from '@shopify/events';

const routes = () => (window.Theme && window.Theme.routes) || {};

async function getCart() {
  const url = `${routes().cart_url || '/cart'}.js`;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Cart request failed (${response.status})`);
  return response.json();
}

async function add(items, source = document.body) {
  const lines = items.map((item) => ({ merchandiseId: String(item.id), quantity: Number(item.quantity) || 1 }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const deferred = CartLinesUpdateEvent.createPromise();

  source.dispatchEvent(
    new CartLinesUpdateEvent({ action: 'add', context: 'product', lines, promise: deferred.promise })
  );

  try {
    const response = await fetch(routes().cart_add_url || '/cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items.map((i) => ({ id: Number(i.id), quantity: Number(i.quantity) || 1 })) }),
    });
    const result = await response.json();
    const cart = await getCart();
    const failed = Boolean(result && result.status);

    deferred.resolve({
      cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
      detail: { items: cart.items, source: 'vant', itemCount, didError: failed },
    });

    if (failed) {
      const error = new Error(result.description || result.message || 'Could not add to basket');
      error.isCartError = true;
      throw error;
    }
    return cart;
  } catch (error) {
    if (!error.isCartError) deferred.reject(error);
    throw error;
  }
}

window.VantCart = { add, getCart };
document.dispatchEvent(new CustomEvent('vant:cart-ready'));
