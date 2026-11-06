import { Link } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  CreditCard,
  Video,
  ShieldCheck,
  Clock,
  Globe,
  ArrowRight,
  FileText,
  Stethoscope,
  AlertCircle,
} from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Fill Your Details",
    desc: "complete our simple intake form with your current symptoms",
    badgeIcon: Clock,
    badgeText: "Takes 2 Minutes",
    badgeColor: "bg-slate-50 text-slate-600 border-slate-200/80",
    icon: ClipboardList,
  },
  {
    num: "02",
    title: "Choose & Pay",
    desc: "select standard or priority consultation, pay seamlessly online with international cards.",
    badgeIcon: ShieldCheck,
    badgeText: "Secure Checkout",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    icon: CreditCard,
  },
  {
    num: "03",
    title: "Get Consulted",
    desc: "receive a secure private and secure consultation link directly on your phone and speak with your doctor.",
    badgeIcon: FileText,
    badgeText: "Official digital prescription",
    badgeColor: "bg-sky-50 text-sky-700 border-sky-200/70",
    icon: Video,
  },
];

const features = [
  {
    icon: "/Overlay (5).svg",
    title: "Simple Intake",
    desc: "quick, structured medical forms made specifically for international travelers on the move.",
  },
  {
    icon: "/Overlay (4).svg",
    title: "Secure & Private",
    desc: "medical intake and records encrypted strictly compliant to gdpr and international privacy standards.",
  },
  {
    icon: "/Overlay (3).svg",
    title: "Easy Payment",
    desc: "seamless payment with foreign debit or credit cards via stripe, apple pay, and google pay.",
  },
  {
    icon: "/Overlay (2).svg",
    title: "Virtual Consult",
    desc: "connect in crystal clear hd video from your hotel room or villa anywhere across sri lanka.",
  },
  {
    icon: "/Overlay (1).svg",
    title: "Priority Access",
    desc: "expedited electronic prescriptions, direct private hospital referrals & pharmacy delivery support.",
  },
  {
    icon: "/Overlay.svg",
    title: "Multilingual Care",
    desc: "fluent english consultations with german, french, and russian communication coordinators on standby.",
  },
];

export default function Index() {
  return (
    <PublicLayout>
      <div className="relative overflow-hidden bg-gradient-to-b from-[#f3f9fc] via-white to-[#f4f9fc]">
        {/* Soft background ambient gradient accents */}
        <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -left-24 h-96 w-96 rounded-full bg-blue-100/30 blur-3xl" />

        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-10 pb-14 md:pt-16 md:pb-18 max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Left Content */}
            <div className="flex flex-col items-start text-left lg:col-span-7">
              {/* Badge */}
              <div className="mb-3.5 sm:mb-4 inline-flex items-center rounded-full bg-[#e8f4f9] px-3.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-[#0578aa]">
                <span>Embassy-Recommended Doctor</span>
              </div>

              {/* Headline */}
              <h1 className="font-display text-[27px] sm:text-4xl lg:text-[3.25rem] font-bold leading-[1.18] sm:leading-[1.15] tracking-tight text-[#0b495c]">
                trusted medical care<span className="sm:hidden"><br />for everyone from<br />anywhere</span>
                <span className="hidden sm:inline"> for<br />everyone from anywhere</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-3.5 sm:mt-5 text-[14px] sm:text-base md:text-lg text-[#526b7a] leading-relaxed max-w-[285px] sm:max-w-lg">
                get professional medical care and online consultations whenever you need them.
              </p>

              {/* CTA Buttons */}
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <Link to="/consultation/intake" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto rounded-full bg-[#0a71bc] hover:bg-[#085e9e] text-white text-sm sm:text-base font-medium px-7 py-3.5 sm:py-6 shadow-md shadow-[#0a71bc]/25 inline-flex items-center justify-center gap-2 transition-all"
                  >
                    <span>Start Consultation</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <Link to="/track" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto rounded-full bg-white hover:bg-[#085e9e] text-[#0a71bc] border-slate-100 shadow-sm shadow-slate-200/60 text-sm sm:text-base font-medium px-6 py-3.5 sm:py-6 inline-flex items-center justify-center gap-2 transition-all"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#0a71bc]" />
                    <span>Track My Consultation</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="flex justify-center lg:col-span-5 lg:justify-end">
              <img
                src="/Group 14.png"
                alt="Trusted medical care for everyone from anywhere - Instant Care Wherever You Stay"
                className="w-full max-w-sm sm:max-w-md lg:max-w-[480px] h-auto object-contain transition-transform hover:scale-[1.01]"
              />
            </div>
          </div>
        </section>

        {/* Stats Section Bar */}
        <section className="container mx-auto px-4 my-6 md:my-10 max-w-5xl">
          <div className="rounded-2xl md:rounded-3xl bg-[#dbe8ee] p-6 md:p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 text-center">
              <div>
                <div className="font-display text-3xl md:text-4xl font-extrabold text-[#0284c7] tracking-tight">
                  500+
                </div>
                <p className="mt-1 text-xs md:text-sm font-medium text-slate-600">
                  travelers served across sri lanka
                </p>
              </div>

              <div>
                <div className="font-display text-3xl md:text-4xl font-extrabold text-[#0284c7] tracking-tight">
                  15<span className="text-xl md:text-2xl font-bold ml-0.5">min</span>
                </div>
                <p className="mt-1 text-xs md:text-sm font-medium text-slate-600">
                  average wait time to doctor connect
                </p>
              </div>

              <div>
                <div className="font-display text-3xl md:text-4xl font-extrabold text-[#0284c7] tracking-tight">
                  100%
                </div>
                <p className="mt-1 text-xs md:text-sm font-medium text-slate-600">
                  safe and convenient consultation payments
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
          <div className="text-center">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[#0f3d4c] tracking-tight">
              How It Works
            </h2>
            <p className="mx-auto mt-2 text-xs md:text-sm text-slate-500 max-w-xl">
              Three gentle steps to receive trusted medical advice from the comfort of your room
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              const BadgeIcon = step.badgeIcon;
              return (
                <div
                  key={step.num}
                  className="relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Top row with icon & large faint number */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e0f2fe] text-[#0284c7]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-display text-3xl md:text-4xl font-black text-slate-200 select-none">
                        {step.num}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-[#0f3d4c] mt-4">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-xs md:text-sm text-slate-500 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  {/* Bottom tag */}
                  <div
                    className={`mt-6 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium w-fit ${step.badgeColor}`}
                  >
                    <BadgeIcon className="h-3 w-3 shrink-0" />
                    <span>{step.badgeText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="container mx-auto px-4 py-12 md:py-18 max-w-6xl">
          <div className="text-center">
            <h2 className="font-display text-3xl sm:text-4xl md:text-[40px] font-bold text-[#004767] tracking-tight">
              Why Choose Us
            </h2>
            <p className="mx-auto mt-2.5 sm:mt-3 text-xs sm:text-sm md:text-base text-[#526b7a] max-w-xl">
              Clinical excellence tailored for foreign visitors and embassy personnel
            </p>
          </div>

          <div className="mt-10 md:mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col items-start text-left"
              >
                <img
                  src={f.icon}
                  alt={f.title}
                  className="h-11 w-11 object-contain shrink-0"
                />
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#0b2838] mt-5 sm:mt-6 tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-[#526b7a] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 pt-6 pb-4 max-w-4xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0284c7] via-[#0372ab] to-[#046193] p-8 md:p-14 text-center text-white shadow-lg">
            <h2 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight text-white">
              Need Medical Help?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-xs md:text-sm text-white/90 leading-relaxed">
              Don't wait — start your consultation now. our on-duty doctor is ready to assist you immediately.
            </p>
            <Link to="/consultation/intake">
              <Button
                size="sm"
                className="mt-6 rounded-full hover:bg-[#085e9e] bg-white text-[#0f3d4c] text-xs md:text-sm font-semibold px-6 py-2.5 shadow-md inline-flex items-center gap-1.5 transition-all"
              >
                start consultation now
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Emergency Alert Banner */}
        <section className="container mx-auto px-4 pb-14 max-w-4xl">
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-red-200/80 bg-[#fee2e2]/70 p-3.5 text-center text-xs text-red-900 shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>
              severe emergency warning: For life-threatening emergencies, dial{" "}
              <strong className="rounded bg-red-200/90 px-1 py-0.5 text-red-950 font-bold underline">
                1990
              </strong>{" "}
              (suwaseriya free national ambulance) immediately.
            </span>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
