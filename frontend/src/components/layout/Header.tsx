import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact Us" },
  { href: "/login", label: "" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl print:hidden">
      <div className="flex h-12 md:h-13 items-center justify-between rounded-full bg-white/95 px-3 md:px-5 shadow-sm border border-slate-200/80 backdrop-blur-md">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0 pl-1">
          <img
            src="/image 26.svg"
            alt="ChatDr Logo"
            className="h-10 md:h-11 w-auto object-contain transition-transform hover:scale-105"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`rounded-full px-3.5 py-1 text-xs md:text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#e0f2fe] text-[#0284c7]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center md:flex shrink-0">
          <Link to="/consultation/intake">
            <Button
              size="sm"
              className="rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs md:text-sm font-semibold px-4 md:px-5 py-1.5 shadow-sm transition-all"
            >
              Start Consultation
            </Button>
          </Link>
        </div>

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-3 pt-8">
              <Link to="/" onClick={() => setOpen(false)} className="mb-2">
                <img src="/Group 5 (1).svg" alt="ChatDr Logo" className="h-8 w-auto" />
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    location.pathname === link.href
                      ? "bg-[#e0f2fe] text-[#0284c7]"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <hr className="border-border my-2" />
              <Link to="/consultation/intake" onClick={() => setOpen(false)}>
                <Button className="w-full rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white text-sm">
                  Start Consultation
                </Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
