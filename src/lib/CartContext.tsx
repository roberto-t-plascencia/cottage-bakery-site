"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  addToCart,
  cartItemCount,
  cartSubtotalCents,
  removeFromCart,
  updateQuantity,
  type CartLine,
} from "./cart";

const STORAGE_KEY = "bakery-cart-v1";
const EMPTY_CART: CartLine[] = [];

/**
 * Cart lives in an external store (module-level state + localStorage),
 * read via useSyncExternalStore rather than "useState + useEffect that
 * reads localStorage on mount". That older pattern renders once with an
 * empty cart, then setState-in-an-effect immediately re-renders with the
 * real cart — a cascading render React's own lint rules now flag.
 * useSyncExternalStore is the mechanism React ships specifically for
 * syncing from something outside React (here, the browser's storage) and
 * sidesteps that problem: the server snapshot and the pre-hydration client
 * snapshot are both the empty cart, so there's no mismatch to reconcile.
 */
let cartState: CartLine[] = EMPTY_CART;
let hydrated = false;
const listeners = new Set<() => void>();

function loadFromStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : EMPTY_CART;
  } catch {
    // Corrupt or inaccessible storage shouldn't crash the page — worst
    // case the shopper starts with an empty cart.
    return EMPTY_CART;
  }
}

function persist(next: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/availability errors — non-critical convenience state.
  }
}

function setCartState(next: CartLine[]) {
  cartState = next;
  persist(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  if (!hydrated) {
    // First subscriber only runs on the client (subscribe is never called
    // during server rendering), so this is where we pull in whatever was
    // saved from a previous visit.
    hydrated = true;
    cartState = loadFromStorage();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CartLine[] {
  return cartState;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY_CART;
}

type CartContextValue = {
  cart: CartLine[];
  itemCount: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setCartState(addToCart(cartState, line, quantity));
  }, []);

  const remove = useCallback((productId: string) => {
    setCartState(removeFromCart(cartState, productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setCartState(updateQuantity(cartState, productId, quantity));
  }, []);

  const clear = useCallback(() => setCartState(EMPTY_CART), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cartItemCount(cart),
      subtotalCents: cartSubtotalCents(cart),
      add,
      remove,
      setQuantity,
      clear,
    }),
    [cart, add, remove, setQuantity, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
