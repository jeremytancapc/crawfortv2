"use client";

import Image from "next/image";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell } from "@phosphor-icons/react";
import { fillTemplate, PAGE_CONTENT } from "./contract-content";
import {
  CALC,
  CUSTOMER,
  LANGS,
  LOAN,
  money,
  moneyWhole,
  type LangCode,
} from "./data";
import { IconMark, QrPlaceholder, SilhouetteIcon, TickIcon } from "./icons";
import { t } from "./i18n";
import "./kiosk.css";

type Disbursement = "cash" | "paynow" | null;

type LoadingState = { msg: string; sub: string } | null;

function ActionBar({
  info,
  children,
  hidden,
}: {
  info?: ReactNode;
  children?: ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div id="actionbar" style={{ display: "flex" }}>
      <div className="info">{info}</div>
      <div className="buttons">{children}</div>
    </div>
  );
}

function Topbar() {
  return (
    <div id="topbar">
      <div className="brand">
        <Image
          src="/images/crawfort-white.png"
          alt="Crawfort"
          width={151}
          height={20}
          className="h-5 w-auto"
          priority
        />
      </div>
    </div>
  );
}

function StepRail({
  step,
  labels,
}: {
  step: number;
  labels: readonly string[];
}) {
  // Language is outside the counter; Singpass = display step 1 of 6.
  if (step < 2) return null;
  return (
    <div className="steprail-zone">
      <div className="steprail" role="list" aria-label="Progress">
        {Array.from({ length: 6 }, (_, idx) => {
          const displayNum = idx + 1;
          const internalStep = idx + 2;
          const done = step > internalStep;
          const cur = step === internalStep;
          return (
            <div key={displayNum} style={{ display: "contents" }}>
              <div
                role="listitem"
                className={`step-dot ${done ? "done" : ""} ${cur ? "current" : ""}`}
                title={labels[idx]}
                aria-current={cur ? "step" : undefined}
              >
                {done ? "✓" : displayNum}
              </div>
              {displayNum < 6 && (
                <div className={`step-connector ${done ? "done" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingOverlay({ loading }: { loading: LoadingState }) {
  if (!loading) return null;
  return (
    <div id="loading-overlay" className="show">
      <div className="spin-wrap">
        <IconMark />
      </div>
      <div className="loading-msg">{loading.msg}</div>
      <div className="loading-sub">{loading.sub}</div>
    </div>
  );
}

function useSigPad(enabled: boolean, prefilled: boolean, onDraw: () => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#0033AA";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;

    if (prefilled) {
      ctx.beginPath();
      ctx.moveTo(30, 70);
      ctx.bezierCurveTo(70, 20, 110, 110, 150, 50);
      ctx.bezierCurveTo(180, 15, 220, 80, 260, 45);
      ctx.stroke();
    }

    function pos(e: MouseEvent | TouchEvent): [number, number] {
      const r = canvas!.getBoundingClientRect();
      const cx =
        ("touches" in e ? e.touches[0].clientX : e.clientX) - r.left;
      const cy =
        ("touches" in e ? e.touches[0].clientY : e.clientY) - r.top;
      return [cx, cy];
    }
    function start(e: MouseEvent | TouchEvent) {
      drawingRef.current = true;
      const hint = document.getElementById("sigHint");
      if (hint) hint.style.display = "none";
      const [x, y] = pos(e);
      ctx!.beginPath();
      ctx!.moveTo(x, y);
      e.preventDefault();
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawingRef.current) return;
      const [x, y] = pos(e);
      ctx!.lineTo(x, y);
      ctx!.stroke();
      onDraw();
      e.preventDefault();
    }
    function end() {
      drawingRef.current = false;
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [enabled, prefilled, onDraw]);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hint = document.getElementById("sigHint");
    if (hint) hint.style.display = "block";
  }

  return { canvasRef, clear };
}

export function KioskApp() {
  const [lang, setLang] = useState<LangCode>("en");
  const [step, setStep] = useState(1);
  const [langChosen, setLangChosen] = useState(false);
  const [singpassSignedIn, setSingpassSignedIn] = useState(false);
  const [myinfoPage, setMyinfoPage] = useState(1);
  const [myinfoAck, setMyinfoAck] = useState([false, false, false]);
  const [creditChecked, setCreditChecked] = useState(false);
  const [contractPage, setContractPage] = useState(1);
  const [contractSigned, setContractSigned] = useState(
    () => Array(7).fill(false) as boolean[],
  );
  const [sigHasDrawing, setSigHasDrawing] = useState(false);
  const [staffCalled, setStaffCalled] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [photoAcked, setPhotoAcked] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [disbursement, setDisbursement] = useState<Disbursement>(null);
  const [loading, setLoading] = useState<LoadingState>(null);

  const copy = t(lang);
  const camStreamRef = useRef<MediaStream | null>(null);
  const pageContent = PAGE_CONTENT;

  const showLoading = useEffectEvent(
    (msg: string, sub: string, ms: number, cb: () => void) => {
      setLoading({ msg, sub });
      window.setTimeout(() => {
        setLoading(null);
        cb();
      }, ms);
    },
  );

  const resetKiosk = useEffectEvent(() => {
    stopCamera();
    setLang("en");
    setStep(1);
    setLangChosen(false);
    setSingpassSignedIn(false);
    setMyinfoPage(1);
    setMyinfoAck([false, false, false]);
    setCreditChecked(false);
    setContractPage(1);
    setContractSigned(Array(7).fill(false));
    setSigHasDrawing(false);
    setStaffCalled(false);
    setStaffModalOpen(false);
    setPhotoAcked(false);
    setPhotoTaken(false);
    setPhotoData(null);
    setDisbursement(null);
    setLoading(null);
  });

  function stopCamera() {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((tr) => tr.stop());
      camStreamRef.current = null;
    }
  }

  useEffect(() => {
    if (step !== 3 || creditChecked) return;
    const T = t(lang).s3;
    setLoading({ msg: T.checking, sub: T.checkingSub });
    const timer = window.setTimeout(() => {
      setLoading(null);
      setCreditChecked(true);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [step, creditChecked, lang]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (step === 5 && photoAcked && !photoTaken) {
      startCamera();
    }
  }, [step, photoAcked, photoTaken]);

  const onSigDraw = useEffectEvent(() => setSigHasDrawing(true));
  const needsSign = pageContent[contractPage - 1]?.sign ?? false;
  const { canvasRef, clear: clearSig } = useSigPad(
    step === 4 && needsSign,
    contractSigned[contractPage - 1] && needsSign,
    onSigDraw,
  );

  function startCamera() {
    requestAnimationFrame(() => {
      const video = document.getElementById("camVideo") as HTMLVideoElement | null;
      if (!video || !navigator.mediaDevices?.getUserMedia) return;
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" } })
        .then((stream) => {
          camStreamRef.current = stream;
          video.srcObject = stream;
          const sil = document.getElementById("silhouette");
          if (sil) sil.style.display = "none";
        })
        .catch(() => {
          /* keep silhouette placeholder if camera unavailable */
        });
    });
  }

  function runCountdown() {
    const cd = document.getElementById("cdNum");
    if (!cd) return;
    let n = 3;
    cd.style.display = "block";
    cd.textContent = String(n);
    const iv = setInterval(() => {
      n--;
      if (n > 0) cd.textContent = String(n);
      else {
        clearInterval(iv);
        cd.style.display = "none";
        snapPhoto();
      }
    }, 900);
  }

  function snapPhoto() {
    const video = document.getElementById("camVideo") as HTMLVideoElement | null;
    const canvas = document.createElement("canvas");
    if (video && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      setPhotoData(canvas.toDataURL("image/png"));
    } else {
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, 400, 300);
      g.addColorStop(0, "#0B1330");
      g.addColorStop(1, "#1B2450");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = "#ffffff55";
      ctx.beginPath();
      ctx.arc(200, 120, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(200, 320, 110, 0, Math.PI * 2);
      ctx.fill();
      setPhotoData(canvas.toDataURL("image/png"));
    }
    setPhotoTaken(true);
    stopCamera();
  }

  function myinfoPageDef(n: number) {
    const T = copy.s2;
    if (n === 1) {
      return {
        title: T.p1title,
        desc: T.p1desc,
        fields: [
          [T.fields1.name, CUSTOMER.name],
          [T.fields1.nric, CUSTOMER.nric],
          [T.fields1.dob, CUSTOMER.dob],
          [T.fields1.nationality, CUSTOMER.nationality],
          [T.fields1.sex, CUSTOMER.sex],
        ] as [string, string][],
      };
    }
    if (n === 2) {
      return {
        title: T.p2title,
        desc: T.p2desc,
        fields: [
          [T.fields2.mobile, CUSTOMER.mobile],
          [T.fields2.email, CUSTOMER.email],
          [T.fields2.address, CUSTOMER.address],
        ] as [string, string][],
      };
    }
    return {
      title: T.p3title,
      desc: T.p3desc,
      fields: [
        [T.fields3.occupation, CUSTOMER.occupation],
        [T.fields3.employer, CUSTOMER.employer],
        [T.fields3.income, CUSTOMER.income],
      ] as [string, string][],
    };
  }

  function renderScreen() {
    const C = copy.common;

    /* ---- Screen 1: language + welcome ---- */
    if (step === 1) {
      if (!langChosen) {
        const T = copy.s1;
        return (
          <>
            <div className="screen">
              <div className="hero">
                <div className="hero-icon">
                  <IconMark />
                </div>
                <h1>{T.heroTitle}</h1>
                <p className="sub">{T.heroSub}</p>
                <div className="langgrid" role="radiogroup" aria-label="Language">
                  {LANGS.map((l) => {
                    const selected = l.code === lang;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`langcard ${selected ? "selected" : ""}`}
                        onClick={() => setLang(l.code)}
                      >
                        <span className="native">{l.native}</span>
                        <span className="eng">
                          {l.code === "en" ? "Default" : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <ActionBar>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setLangChosen(true)}
              >
                {T.proceed}
              </button>
            </ActionBar>
          </>
        );
      }
      const T = copy.s1;
      const initials = CUSTOMER.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("");
      return (
        <>
          <div className="screen">
            <div className="welcome-panel">
              <div className="avatar-ring">{initials}</div>
              <h1>
                {T.welcomeBack} {CUSTOMER.name}
              </h1>
              <p className="sub">{T.chooseAction}</p>
              <button
                type="button"
                className="action-tile"
                onClick={() => setStep(2)}
              >
                <div className="ico">＄</div>
                <div>
                  <p className="tt">{T.loanTitle}</p>
                  <p className="dd">{T.loanDesc}</p>
                </div>
                <div className="arrow">›</div>
              </button>
            </div>
          </div>
          <ActionBar>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setLangChosen(false)}
            >
              {C.back}
            </button>
          </ActionBar>
        </>
      );
    }

    /* ---- Screen 2: Singpass + Myinfo ---- */
    if (step === 2) {
      const T = copy.s2;
      if (!singpassSignedIn) {
        return (
          <>
            <div className="screen">
              <div className="center-wrap">
                <div
                  className="screen-head"
                  style={{ textAlign: "center", maxWidth: 520 }}
                >
                  <div
                    className="eyebrow"
                    style={{ justifyContent: "center" }}
                  >
                    <span className="dot" />
                    {T.eyebrow}
                  </div>
                  <h2>{T.title}</h2>
                  <p>{T.desc}</p>
                </div>
                <div className="singpass-card">
                  <div className="singpass-logo-row">
                    <span className="sp-badge">Singpass</span>
                  </div>
                  <div className="qr-box">
                    <QrPlaceholder />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      showLoading(T.connecting, T.connectingSub, 1700, () => {
                        showLoading(T.fetching, T.fetchingSub, 1500, () => {
                          setSingpassSignedIn(true);
                          setMyinfoPage(1);
                        });
                      });
                    }}
                  >
                    {T.signin}
                  </button>
                </div>
              </div>
            </div>
            <ActionBar>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(1)}
              >
                {C.back}
              </button>
            </ActionBar>
          </>
        );
      }

      const n = myinfoPage;
      const def = myinfoPageDef(n);
      const ok = myinfoAck[n - 1];
      return (
        <>
          <div className="screen">
            <div className="top-wrap">
              <div className="myinfo-wrap">
                <div className="page-dots">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`${i === n ? "active" : ""} ${myinfoAck[i - 1] ? "filled" : ""}`}
                    />
                  ))}
                </div>
                <div className="info-card">
                  <div className="info-card-head">
                    <div className="num">{n}</div>
                    <div>
                      <h3>{def.title}</h3>
                      <p>{def.desc}</p>
                    </div>
                  </div>
                  <div className="field-list">
                    {def.fields.map(([k, v]) => (
                      <div className="field-row" key={k}>
                        <div className="lbl">{k}</div>
                        <div className="val">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="myinfo-source">🔒 {T.myinfoTag}</div>
                  <div className="ack-row">
                    <label className="ack-check">
                      <input
                        type="checkbox"
                        checked={myinfoAck[n - 1]}
                        onChange={(e) => {
                          const next = [...myinfoAck];
                          next[n - 1] = e.target.checked;
                          setMyinfoAck(next);
                        }}
                      />
                      <span>{T.ackText}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ActionBar>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (n > 1) setMyinfoPage(n - 1);
                else setSingpassSignedIn(false);
              }}
            >
              {C.back}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ok}
              onClick={() => {
                if (n < 3) setMyinfoPage(n + 1);
                else {
                  setCreditChecked(false);
                  setStep(3);
                }
              }}
            >
              {T.confirmContinue}
            </button>
          </ActionBar>
        </>
      );
    }

    /* ---- Screen 3: loan offer ---- */
    if (step === 3) {
      const T = copy.s3;
      if (!creditChecked) {
        return (
          <>
            <div className="screen">
              <div className="center-wrap" />
            </div>
            <ActionBar hidden />
          </>
        );
      }
      return (
        <>
          <div className="screen">
            <div className="top-wrap">
              <div className="offer-wrap">
                <div className="offer-card">
                  <div className="offer-amount-lbl">{T.preApproved}</div>
                  <div className="offer-amount">{moneyWhole(LOAN.amount)}</div>
                  <div className="offer-grid">
                    <div className="offer-chip">
                      <div className="k">{T.tenure}</div>
                      <div className="v">
                        {LOAN.tenure}{" "}
                        {Number(LOAN.tenure) === 1
                          ? T.tenureMonth
                          : T.tenureMonths}
                      </div>
                    </div>
                    <div className="offer-chip">
                      <div className="k">{T.monthly}</div>
                      <div className="v">{money(CALC.monthly)}</div>
                    </div>
                  </div>
                </div>
                <div className="breakdown-card">
                  <div className="bd-row">
                    <span className="k">{T.principal}</span>
                    <span className="v">{moneyWhole(LOAN.amount)}</span>
                  </div>
                  <div className="bd-row">
                    <span className="k">{T.interest}</span>
                    <span className="v">{money(CALC.interest)}</span>
                  </div>
                  <div className="bd-row">
                    <span className="k">{T.fee}</span>
                    <span className="v">{moneyWhole(CALC.fee)}</span>
                  </div>
                  <div className="bd-row">
                    <span className="k">{T.monthlyInstalment}</span>
                    <span className="v">{money(CALC.monthly)}</span>
                  </div>
                  <div className="bd-row">
                    <span className="k">{T.netDisbursedToday}</span>
                    <span className="v">{moneyWhole(CALC.net)}</span>
                  </div>
                </div>
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--ink-soft)",
                    fontSize: "14.5px",
                    marginTop: 20,
                    fontWeight: 600,
                  }}
                >
                  {T.eligMsg}
                </p>
              </div>
            </div>
          </div>
          <ActionBar>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep(2);
                setMyinfoPage(3);
              }}
            >
              {C.back}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => setStep(4)}
            >
              {T.proceed}
            </button>
          </ActionBar>
        </>
      );
    }

    /* ---- Screen 4: contract ---- */
    if (step === 4) {
      const T = copy.s4;
      const n = contractPage;
      const page = T.pages[n - 1];
      const content = pageContent[n - 1];
      const done = contractSigned[n - 1];
      const signRequired = content.sign;
      const totalPages = pageContent.length;
      const allDone = contractSigned.every(Boolean);
      const canProceed = signRequired
        ? sigHasDrawing || contractSigned[n - 1]
        : contractSigned[n - 1];

      return (
        <>
          <div className="screen">
            <div className="top-wrap" style={{ paddingBottom: 0 }}>
              <div className="contract-shell">
                <div className="contract-toolbar">
                  <div className="contract-toolbar-left">
                    <h2 className="contract-toolbar-title">{T.toolbarTitle}</h2>
                    <div className="contract-pages" aria-label="Contract pages">
                      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div
                          key={i}
                          className={`cpage-pip ${contractSigned[i - 1] ? "signed" : ""} ${i === n ? "current" : ""}`}
                        >
                          {contractSigned[i - 1] ? "✓" : i}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`staff-btn ${staffCalled ? "called" : ""}`}
                    onClick={() => setStaffModalOpen(true)}
                  >
                    <Bell
                      size={20}
                      weight="fill"
                      className="staff-btn-bell"
                      aria-hidden
                    />
                    {staffCalled ? T.staffCalled : T.callStaff}
                  </button>
                </div>
                <div className="contract-disclaimer">
                  <span className="contract-disclaimer-mark" aria-hidden>
                    !
                  </span>
                  <p>{T.disclaimer}</p>
                </div>
                {staffModalOpen && (
                  <div
                    className="staff-modal-backdrop"
                    role="presentation"
                    onClick={() => setStaffModalOpen(false)}
                  >
                    <div
                      className="staff-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="staff-modal-title"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="staff-modal-icon" aria-hidden>
                        <Bell size={28} weight="fill" />
                      </div>
                      <h3 id="staff-modal-title">{T.staffModalTitle}</h3>
                      <p>{T.staffModalBody}</p>
                      <div className="staff-modal-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setStaffModalOpen(false)}
                        >
                          {T.staffModalCancel}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            setStaffCalled(true);
                            setStaffModalOpen(false);
                          }}
                        >
                          <Bell
                            size={18}
                            weight="fill"
                            className="staff-btn-bell"
                            aria-hidden
                          />
                          {T.callStaff}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="contract-doc" id="docBody">
                  <div className="doc-meta">{page.meta}</div>
                  <h3>{page.title}</h3>
                  {content.table && (
                    <table>
                      <tbody>
                        {content.table.map(([k, v]) => (
                          <tr key={k}>
                            <td>{k}</td>
                            <td>{fillTemplate(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div
                    dangerouslySetInnerHTML={{
                      __html: fillTemplate(content.bodyHtml),
                    }}
                  />
                </div>
                {signRequired ? (
                  <div className="sign-zone">
                    <div className="sign-zone-label">
                      <span>{done ? `✓ ${T.signedTag}` : T.signHere}</span>
                      <button
                        type="button"
                        onClick={() => {
                          clearSig();
                          setSigHasDrawing(false);
                          const next = [...contractSigned];
                          next[n - 1] = false;
                          setContractSigned(next);
                        }}
                      >
                        {T.clear}
                      </button>
                    </div>
                    <div style={{ position: "relative" }}>
                      <canvas className="sigpad" id="sigpad" ref={canvasRef} />
                      <div
                        className="sig-hint"
                        id="sigHint"
                        style={{
                          left: 16,
                          top: 44,
                          display: done ? "none" : undefined,
                        }}
                      >
                        ✍️
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="sign-zone">
                    <label className="ack-check">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => {
                          const next = [...contractSigned];
                          next[n - 1] = e.target.checked;
                          setContractSigned(next);
                        }}
                      />
                      <span>{T.readAck}</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
          <ActionBar info={`${n}/${totalPages}`}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (n > 1) {
                  setContractPage(n - 1);
                  setSigHasDrawing(false);
                } else setStep(3);
              }}
            >
              {C.back}
            </button>
            {!contractSigned[n - 1] ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canProceed}
                onClick={() => {
                  const next = [...contractSigned];
                  next[n - 1] = true;
                  setContractSigned(next);
                  setSigHasDrawing(false);
                }}
              >
                {signRequired ? T.signPage : T.continueAll}
              </button>
            ) : n < totalPages ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setContractPage(n + 1);
                  setSigHasDrawing(false);
                }}
              >
                {C.next}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={!allDone}
                onClick={() => setStep(5)}
              >
                {T.continueAll}
              </button>
            )}
          </ActionBar>
        </>
      );
    }

    /* ---- Screen 5: photo ---- */
    if (step === 5) {
      const T = copy.s5;
      if (!photoAcked) {
        return (
          <>
            <div className="screen">
              <div className="center-wrap">
                <div className="photo-wrap">
                  <div className="screen-head" style={{ textAlign: "center" }}>
                    <div
                      className="eyebrow"
                      style={{ justifyContent: "center" }}
                    >
                      <span className="dot" />
                      {T.eyebrow}
                    </div>
                    <h2>{T.title}</h2>
                  </div>
                  <div className="reg-notice">
                    <div className="ico">📷</div>
                    <div>
                      <b>{T.noticeTitle}</b>
                      <span>{T.noticeBody}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <ActionBar>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setStep(4);
                  setContractPage(5);
                }}
              >
                {C.back}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setPhotoAcked(true)}
              >
                {T.ack}
              </button>
            </ActionBar>
          </>
        );
      }
      return (
        <>
          <div className="screen">
            <div className="center-wrap">
              <div className="photo-wrap">
                <div className="cam-frame" id="camFrame">
                  <div className="cam-badge">
                    {photoTaken ? "" : T.getReady}
                  </div>
                  {photoTaken && photoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="shot"
                      src={photoData}
                      alt="Captured"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <>
                      <video id="camVideo" autoPlay playsInline muted />
                      <div className="silhouette" id="silhouette">
                        <SilhouetteIcon />
                      </div>
                    </>
                  )}
                  <div
                    className="countdown-num"
                    id="cdNum"
                    style={{ display: "none" }}
                  />
                </div>
                {photoTaken && (
                  <div className="captured-badge">✓ {T.captured}</div>
                )}
              </div>
            </div>
          </div>
          {!photoTaken ? (
            <ActionBar>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  stopCamera();
                  setPhotoAcked(false);
                }}
              >
                {C.back}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={runCountdown}
              >
                {T.ready}
              </button>
            </ActionBar>
          ) : (
            <ActionBar>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPhotoTaken(false);
                  startCamera();
                }}
              >
                {C.back}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPhotoTaken(false);
                  startCamera();
                }}
              >
                {T.retake}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  stopCamera();
                  setStep(6);
                }}
              >
                {T.continue}
              </button>
            </ActionBar>
          )}
        </>
      );
    }

    /* ---- Screen 6: disbursement ---- */
    if (step === 6) {
      const T = copy.s6;
      return (
        <>
          <div className="screen">
            <div className="top-wrap">
              <div
                className="screen-head"
                style={{ textAlign: "center", maxWidth: 640 }}
              >
                <div className="eyebrow" style={{ justifyContent: "center" }}>
                  <span className="dot" />
                  {T.eyebrow}
                </div>
                <h2>{T.title}</h2>
                <p>{T.desc}</p>
              </div>
              <div className="disb-wrap">
                <button
                  type="button"
                  className={`disb-card disb-card-paynow ${disbursement === "paynow" ? "selected" : ""}`}
                  onClick={() => setDisbursement("paynow")}
                >
                  <span className="badge">{T.paynowBadge}</span>
                  <div className="disb-card-main">
                    <div className="ico ico-paynow">
                      <Image
                        src="/images/paynow-logo.png"
                        alt="PayNow"
                        width={120}
                        height={80}
                        className="paynow-logo"
                      />
                    </div>
                    <div className="disb-card-copy">
                      <h3>{T.paynowTitle}</h3>
                      <p className="desc">{T.paynowDesc}</p>
                      <div className="disb-note good">✓ {T.paynowGood}</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`disb-card disb-card-cash ${disbursement === "cash" ? "selected" : ""}`}
                  onClick={() => setDisbursement("cash")}
                >
                  <div className="ico">💵</div>
                  <div className="disb-card-copy">
                    <h3>{T.cashTitle}</h3>
                    <p className="desc">{T.cashWarn}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <ActionBar>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(5)}
            >
              {C.back}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!disbursement}
              onClick={() => setStep(7)}
            >
              {T.confirm}
            </button>
          </ActionBar>
        </>
      );
    }

    /* ---- Screen 7: thank you ---- */
    const T = copy.s7;
    const msg = disbursement === "paynow" ? T.paynowMsg : T.cashMsg;
    return (
      <>
        <div className="screen">
          <div className="thanks-wrap">
            <div className="tick-circle">
              <TickIcon />
            </div>
            <h1>{T.thankTitle}</h1>
            <p className="msg">{msg}</p>
            <div className="ref-chip">
              {T.ref}: {LOAN.loanAccountNo}
            </div>
            <div className="signoff">
              {T.signoff} <b>Crawfort</b>
            </div>
          </div>
        </div>
        <ActionBar info={T.restart}>
          <button
            type="button"
            className="btn btn-teal btn-lg"
            onClick={() => resetKiosk()}
          >
            {T.finish}
          </button>
        </ActionBar>
      </>
    );
  }

  return (
    <div className="kiosk-root">
      {(step > 1 || langChosen) && <Topbar />}
      <div id="main">
        <div id="app">
          {step >= 2 && (
            <div className="screen-progress">
              <StepRail step={step} labels={copy.stepLabels} />
            </div>
          )}
          {renderScreen()}
        </div>
      </div>
      <LoadingOverlay loading={loading} />
    </div>
  );
}
