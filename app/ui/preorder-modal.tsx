"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { AppleLogo, GooglePlayLogo, X } from "@phosphor-icons/react/dist/ssr";
import { APP_STORE_IS_LIVE, APP_STORE_URL, BADGES_LIVE, PLAY_IS_LIVE, PLAY_URL } from "@/lib/links";
import { BadgeImg } from "./badge-img";
import { track } from "./track";

// THE PRE-ORDER CONTROL (FRONTEND-V4.1 §2, MOBILE FIX PASS v2 §A): every primary CTA on the site is this one forest
// button. It opens a native <dialog> titled "Choose your phone" with two option cards, iPhone and Android: a Phosphor
// store logo, the title and a forest button ("Pre-order on the App Store" / "Pre-register on Google Play") linking to
// the store URL ("#" until the env var is set). While BADGES_LIVE the button gives way to the official badge artwork.
// The cards stack on phones and sit side by side from 640px. showModal() gives Esc, the inert page behind and focus
// return for free, onTab wraps focus inside the panel; a click on the backdrop closes; 200ms scale-in on desktop, a
// bottom sheet on phones (globals.css .preorder-dialog). No library.
const OPTIONS = [
  { key: "ios", phone: "iPhone", label: "Pre-order on the App Store", href: APP_STORE_URL, live: APP_STORE_IS_LIVE, badge: "apple" as const, Icon: AppleLogo },
  { key: "android", phone: "Android", label: "Pre-register on Google Play", href: PLAY_URL, live: PLAY_IS_LIVE, badge: "play" as const, Icon: GooglePlayLogo },
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
          <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
            {OPTIONS.map((o) => (
              <div key={o.key} className="flex flex-col gap-4 rounded-card border border-border bg-white p-4 sm:p-5">
                <span className="flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center">
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-surface text-ink">
                    <o.Icon size={24} weight="fill" />
                  </span>
                  <span className="font-display text-[1.125rem] font-bold tracking-[-0.01em]">{o.phone}</span>
                </span>
                <a
                  href={o.href}
                  {...(o.live ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  data-placement={`${placement}-${o.key}`}
                  onClick={() => track("preorder_pick", { placement, phone: o.key })}
                  aria-label={`${o.label} (${o.phone})`}
                  className={BADGES_LIVE ? "inline-block self-start rounded-[8px] sm:self-center" : "cta cta-sm w-full"}
                >
                  {BADGES_LIVE ? <BadgeImg kind={o.badge} height={40} /> : o.label}
                </a>
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
