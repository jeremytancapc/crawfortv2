"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, HandCoins, type Icon } from "@phosphor-icons/react";

import {
  DISBURSEMENT_ACK_STATEMENT,
  DISBURSEMENT_NOTICE_ITEMS,
  KEY_TERM_ACKS,
  TC_CLOSING,
  TC_ITEMS,
} from "@/app/apply/accept/accept-content";
import type { SelectedPlanData } from "@/app/apply/accept/load-selected-plan";
import { V2SignaturePad } from "@/app/v2/ui/signature-pad";
import { useApplyPath } from "@/app/use-apply-path";
import { Pill, Row, Rows } from "@/app/v2/ui/controls";
import { PlanIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import { formatOfferAmount } from "@/lib/approval-display";
import { leadReference } from "@/lib/lead-id";

type Screen = "receipt" | "terms" | "sign";

interface TermCard {
  key: string;
  Icon: Icon;
  title: string;
  lines: readonly string[];
  footnote?: string;
}

/**
 * The customer confirms the terms one card at a time. The three key
 * acknowledgements come first, then disbursement, then the contract terms in
 * two readable halves - every card fits a 375x667 viewport without scrolling.
 */
function buildTermCards(): TermCard[] {
  const half = Math.ceil(TC_ITEMS.length / 2);
  return [
    ...KEY_TERM_ACKS.map((ack) => ({
      key: ack.key,
      Icon: ack.Icon,
      title: ack.title,
      lines: ack.terms,
    })),
    {
      key: "disbursement",
      Icon: HandCoins,
      title: DISBURSEMENT_ACK_STATEMENT,
      lines: DISBURSEMENT_NOTICE_ITEMS,
    },
    {
      key: "contract-1",
      Icon: FileText,
      title: "I have read the loan terms",
      lines: TC_ITEMS.slice(0, half),
    },
    {
      key: "contract-2",
      Icon: FileText,
      title: "I have read the loan terms",
      lines: TC_ITEMS.slice(half),
      footnote: TC_CLOSING,
    },
  ];
}

export function AcceptScreens({
  plan,
  leadId,
}: {
  plan: SelectedPlanData;
  leadId: string;
}) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const [screen, setScreen] = useState<Screen>("receipt");
  const [cardIndex, setCardIndex] = useState(0);
  const [signature, setSignature] = useState<string | null>(null);
  const cards = useMemo(() => buildTermCards(), []);

  useEffect(() => {
    markApplyStepVisited("accept");
  }, []);

  if (screen === "terms") {
    const card = cards[cardIndex];
    const isLast = cardIndex === cards.length - 1;
    return (
      <V2Screen key={`terms-${card.key}`}>
        <V2Header
          onBack={() => (cardIndex === 0 ? setScreen("receipt") : setCardIndex((i) => i - 1))}
          progress={{ stage: "accept", fraction: 0.2 + (cardIndex / cards.length) * 0.6 }}
          right={
            <span className="text-[13px] font-semibold tabular-nums text-[var(--v2-ink-3)]">
              {cardIndex + 1}/{cards.length}
            </span>
          }
        />
        <V2Body justify="center">
          <div className="v2-enter flex flex-col gap-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--v2-accent-soft)] text-[var(--v2-accent)]">
              <card.Icon size={24} weight="duotone" />
            </span>
            <h1 className="v2-title">{card.title}</h1>
            <ul className="flex flex-col gap-3">
              {card.lines.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 text-[15px] leading-[1.4] text-[var(--v2-ink-2)]"
                >
                  <span
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--v2-accent)]"
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {card.footnote ? <p className="v2-note">{card.footnote}</p> : null}
          </div>
        </V2Body>
        <V2Footer>
          <Pill
            onClick={() => {
              if (isLast) {
                setScreen("sign");
                return;
              }
              setCardIndex((i) => i + 1);
            }}
          >
            I understand
          </Pill>
        </V2Footer>
      </V2Screen>
    );
  }

  if (screen === "sign") {
    return (
      <V2Screen key="sign">
        <V2Header
          onBack={() => setScreen("terms")}
          progress={{ stage: "accept", fraction: 0.9 }}
        />
        <V2Body justify="start">
          <V2Title
            title="Sign to accept"
            subtitle={`${formatOfferAmount(plan.amount)} over ${plan.tenure} months at ${formatOfferAmount(plan.monthlyInstalment)} a month.`}
          />
          <V2SignaturePad
            className="v2-enter"
            onChange={setSignature}
          />
        </V2Body>
        <V2Footer note="Next, book a 30-minute visit to collect your funds.">
          <Pill disabled={!signature} onClick={() => router.push(applyHref("/apply/book"))}>
            Accept and continue
          </Pill>
        </V2Footer>
      </V2Screen>
    );
  }

  return (
    <V2Screen key="receipt">
      <V2Header
        backHref={applyHref("/apply/choose-plan")}
        progress={{ stage: "accept", fraction: 0.15 }}
      />
      <V2Body justify="between">
        <div className="flex flex-col gap-4">
          <V2Illustration>
            <PlanIllustration />
          </V2Illustration>
          <V2Title title="Your loan" subtitle={`${plan.planTitle} · ref ${leadReference(leadId)}`} />
        </div>
        <Rows className="v2-enter">
          <Row label="Amount" value={formatOfferAmount(plan.amount)} />
          <Row label="Term" value={`${plan.tenure} months`} />
          <Row label="Monthly" value={formatOfferAmount(plan.monthlyInstalment)} />
          <Row label="Total repayable" value={formatOfferAmount(plan.totalRepayment)} />
          <Row label="Rate" value={`${(plan.monthlyRate * 100).toFixed(2)}% a month`} />
          {plan.additionalRequests.length ? (
            <Row label="Also requested" value={plan.additionalRequests.join(", ")} wrap />
          ) : null}
        </Rows>
      </V2Body>
      <V2Footer note={`${cards.length} short terms to confirm, then sign.`}>
        <Pill onClick={() => setScreen("terms")}>Review terms</Pill>
      </V2Footer>
    </V2Screen>
  );
}
