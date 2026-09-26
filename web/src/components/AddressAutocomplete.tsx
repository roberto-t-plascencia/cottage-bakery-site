"use client";

import { useId, useRef, useState } from "react";
import { cityLine, formatAddress, streetLine, type GeoapifyAddress } from "@/lib/address";

/**
 * Address field with Geoapify Address Autocomplete suggestions as the
 * customer types. Without NEXT_PUBLIC_GEOAPIFY_KEY it's a plain text
 * field, so local dev and any environment without a key still work.
 *
 * Geoapify's free plan allows 3,000 requests a day, one per lookup call.
 * The 250 ms pause and 3-letter minimum below keep an address to a
 * handful of calls. The key is meant to be public (it ships to the
 * browser); restrict it to this site's URLs in the Geoapify project.
 */
const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
const ENDPOINT = "https://api.geoapify.com/v1/geocode/autocomplete";

// Results favor the bakery's area and stay inside where we can go:
// San Diego County for delivery, California for shipping.
const SAN_DIEGO = "proximity:-117.1611,32.7157";
const AREA_FILTER: Record<Area, string> = {
  LOCAL_DELIVERY: "rect:-117.61,32.53,-116.08,33.51",
  IN_STATE_SHIPPING: "rect:-124.48,32.53,-114.13,42.01",
};

type Area = "LOCAL_DELIVERY" | "IN_STATE_SHIPPING";

type Props = {
  value: string;
  onChange: (value: string) => void;
  area: Area;
  id?: string;
};

export function AddressAutocomplete({ value, onChange, area, id }: Props) {
  const listId = useId();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const [results, setResults] = useState<GeoapifyAddress[]>([]);
  const [active, setActive] = useState(-1);

  function close() {
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setResults([]);
    setActive(-1);
  }

  function search(text: string) {
    clearTimeout(timerRef.current);
    if (!API_KEY || text.trim().length < 3) {
      close();
      return;
    }
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const params = new URLSearchParams({
        text,
        format: "json",
        lang: "en",
        limit: "5",
        filter: `countrycode:us|${AREA_FILTER[area]}`,
        bias: SAN_DIEGO,
        apiKey: API_KEY,
      });
      try {
        const res = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Geoapify ${res.status}`);
        const data = (await res.json()) as { results?: GeoapifyAddress[] };
        setResults(data.results ?? []);
        setActive(-1);
      } catch {
        // Aborted, offline, or over the daily limit: suggestions are a
        // convenience, typing the address still works.
        if (!controller.signal.aborted) setResults([]);
      }
    }, 250);
  }

  function choose(result: GeoapifyAddress) {
    onChange(formatAddress(result));
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  const open = results.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        required
        type="text"
        autoComplete="street-address"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Start typing your street address"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
        className="input"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-white text-sm shadow-lg dark:border-white/20 dark:bg-neutral-900">
          <ul id={listId} role="listbox">
            {results.map((r, i) => (
              <li
                key={r.place_id ?? i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: it fires before the input's blur
                // closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${i === active ? "bg-amber-100 dark:bg-white/10" : ""}`}
              >
                <span className="font-medium">{streetLine(r)}</span>{" "}
                <span className="text-black/60 dark:text-white/60">{cityLine(r)}</span>
              </li>
            ))}
          </ul>
          {/* Attribution Geoapify's terms ask for next to its results. */}
          <p className="border-t border-black/10 px-3 py-1 text-right text-xs text-black/40 dark:border-white/10 dark:text-white/40">
            Powered by{" "}
            <a
              href="https://www.geoapify.com/"
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={(e) => e.preventDefault()}
              className="underline"
            >
              Geoapify
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
