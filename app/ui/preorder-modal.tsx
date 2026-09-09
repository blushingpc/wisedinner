"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { APP_STORE_IS_LIVE, APP_STORE_URL, PLAY_IS_LIVE, PLAY_URL } from "@/lib/links";
import { BadgeImg } from "./store-badges";
import { track } from "./track";

// THE PRE-ORDER CONTROL (FRONTEND-V4.1 §2): every primary CTA on the site is this one forest button. It opens a
// native <dialog> titled "Choose your phone" with two option cards, iPhone (App Store) and Android (Google Play),
// each linking to its store URL ("#" until the env var is set). showModal() gives Esc, the inert page behind and
// focus return for free, onTab wraps focus inside the panel; a click on the backdrop closes; 200ms scale-in on desktop, a bottom sheet
// on phones (globals.css .preorder-dialog). No library.
const OPTIONS = [
  { key: "ios", phone: "iPhone", label: "Pre-order on the App Store", href: APP_STORE_URL, live: APP_STORE_IS_LIVE, badge: "apple" as const },
  { key: "android", phone: "Android", label: "Pre-register on Google Play", href: PLAY_URL, live: PLAY_IS_LIVE, badge: "play" as const },
];

export function PreorderButton({ placement, className = "cta", tabIndex, children = "Pre-order now" }: { placement: string; className?: string; tabIndex?: number; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  const open = () => {
    dialog.current?.showModal();
    track("preorder_open", { placement });
  };
  const close = useCallback(() => dialog.current?.close(), []);
  // the backdrop is the dialog element itself; anything inside the panel is a descendant
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close();
  };
  // showModal() makes the page inert, but Chrome still routes Tab past the last control through the browser UI before
  // it comes back; wrapping here keeps focus inside the panel the whole time
  const onTab = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("a[href], button")];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button type="button" onClick={open} data-placement={placement} tabIndex={tabIndex} className={className}>
        {children}
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-title`} onClick={onBackdrop} onKeyDown={onTab} className="preorder-dialog">
        <div className="relative rounded-card bg-white p-6 shadow-card sm:p-8">
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid size-11 place-items-center rounded-[10px] text-ink-2 transition-colors duration-200 hover:bg-surface hover:text-ink">
            <X size={22} weight="bold" aria-hidden="true" />
          </button>
          <h2 id={`${id}-title`} className="pr-12 font-display text-h3 font-bold">
            Choose your phone
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
            {OPTIONS.map((o) => (
              <a
                key={o.key}
                href={o.href}
                {...(o.live ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                data-placement={`${placement}-${o.key}`}
                onClick={() => track("preorder_pick", { placement, phone: o.key })}
                className="lift flex flex-col items-center gap-4 rounded-card border border-border bg-white px-3 py-6 text-center transition-[border-color] duration-200 hover:border-ink-2 sm:px-5 sm:py-8"
              >
                <BadgeImg kind={o.badge} height={40} />
                <span>
                  <span className="block font-display text-[1.125rem] font-bold tracking-[-0.01em]">{o.phone}</span>
                  <span className="mt-1 block text-sm text-ink-2">{o.label}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
