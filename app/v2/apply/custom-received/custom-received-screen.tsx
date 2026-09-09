"use client";

import { useEffect } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";

import { Row, Rows } from "@/app/v2/ui/controls";
import { ReceivedIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import { formatOfferAmount } from "@/lib/approval-display";
import type { CustomOfferDisplay } from "@/lib/custom-offer-display";
import { leadReference } from "@/lib/lead-id";

const WHATSAPP_URL =
  "https://wa.me/6560119380?text=Hi%20I%20just%20requested%20a%20custom%20loan%20offer";

export function CustomReceivedScreen({ offer }: { offer: CustomOfferDisplay }) {
  useEffect(() => {
    markApplyStepVisited("customReceived");
  }, []);

  return (
    <V2Screen>
      <V2Header progress={{ stage: "offer", fraction: 1 }} />
      <V2Body justify="between">
        <div className="flex flex-col gap-4">
          <V2Illustration>
            <ReceivedIllustration />
          </V2Illustration>
          <V2Title
            title="Request received"
            subtitle="We'll call you within 1 business day to confirm."
          />
        </div>
        <Rows className="v2-enter">
          <Row label="Amount" value={formatOfferAmount(offer.amount)} />
          <Row label="Term" value={`${offer.tenure} ${offer.tenure === 1 ? "month" : "months"}`} />
          {offer.leadId ? <Row label="Reference" value={leadReference(offer.leadId)} /> : null}
        </Rows>
      </V2Body>
      <V2Footer note="A request, not an approval. Nothing is signed until we've spoken.">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="v2-pill v2-pill-ghost"
        >
          <WhatsappLogo size={20} weight="fill" />
          WhatsApp us
        </a>
      </V2Footer>
    </V2Screen>
  );
}
