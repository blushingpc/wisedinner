import { site } from "@/content/site";
import { PreorderButton } from "./preorder-modal";

// SECTION 7, THE PRE-ORDER BAND (REDESIGN-V4 §6, FRONTEND-V4.1 §2, SITE-V5 §1b): forest field, white type. H2
// "Pre-order now on the App Store" and the pre-order button (white on forest; its modal carries both store badges).
// The mobile sticky bar hides while this band is in view, so no extra padding here.
export function PreorderBand() {
  return (
    <section id="preorder" className="cv-auto bg-forest py-band text-white">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center px-6 text-center lg:px-12">
        <h2 className="max-w-[18ch] text-h2 text-white text-balance lg:text-[2.75rem]">{site.preorder.h2}</h2>
        <div className="mt-8">
          <PreorderButton placement="final" className="cta cta-light cta-wide min-w-[200px]" />
        </div>
      </div>
    </section>
  );
}
