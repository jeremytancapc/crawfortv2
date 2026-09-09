"use client";

import { useEffect } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";

import { Row, Rows } from "@/app/v2/ui/controls";
import { PendingIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import { formatOfferAmount } from "@/lib/approval-display";
import { leadReference } from "@/lib/lead-id";
import type { PendingDisplay } from "@/lib/pending-display";

const WHATSAPP_URL =
  "https://wa.me/6560119380?text=Hi%20My%20application%20is%20pending%20review";

export function PendingScreen({ pending }: { pending: PendingDisplay }) {
  useEffect(() => {
    markApplyStepVisited("pending");
  }, []);

  const isForeigner = pending.idType === "foreigner";

  return (
    <V2Screen>
      <V2Header progress={{ stage: "review", fraction: 1 }} />
      <V2Body justify="between">
        <div className="flex flex-col gap-4">
          <V2Illustration>
            <PendingIllustration />
          </V2Illustration>
          <V2Title
            title="We're reviewing your application"
            subtitle="We'll WhatsApp you within 2 business days."
          />
        </div>
        <Rows className="v2-enter">
          <Row label="Amount requested" value={formatOfferAmount(pending.amount)} />
          {pending.leadId ? <Row label="Reference" value={leadReference(pending.leadId)} /> : null}
          <Row label="Office hours" value="Mon to Sat, 10:30am to 7:30pm" />
        </Rows>
      </V2Body>
      <V2Footer
        note={
          isForeigner
            ? "Foreigners need a minimum annual income of S$40,000. Send your latest payslips if that has changed."
            : "We may ask for supporting documents. Nothing else to do for now."
        }
      >
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
