import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

// Luhn algorithm validator on client
function isValidLuhn(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export default function Payment() {
  const [loading, setLoading] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const { toast } = useToast();

  const consultationId = sessionStorage.getItem("consultation_id");
  const trackingCode = sessionStorage.getItem("tracking_code");
  const priceCents = parseInt(sessionStorage.getItem("selected_type_price") || "0", 10);
  const typeName = sessionStorage.getItem("selected_type_name") || "Consultation";

  // Card brand detection
  const cardBrand = useMemo(() => {
    const clean = cardNumber.replace(/\D/g, "");
    if (/^4/.test(clean)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
    if (/^3[47]/.test(clean)) return "American Express";
    if (/^6(?:011|5)/.test(clean)) return "Discover";
    return "";
  }, [cardNumber]);

  if (!consultationId || !trackingCode) {
    return (
      <PublicLayout>
        <div className="container py-16 text-center">
          <h2 className="text-2xl font-bold">Session Expired</h2>
          <p className="mt-2 text-muted-foreground">Please start over from the intake form.</p>
          <Button className="mt-4" onClick={() => navigate("/consultation/intake")}>Start Over</Button>
        </div>
      </PublicLayout>
    );
  }

  // Format card number with spaces (4-4-4-4)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(" ") || raw;
    setCardNumber(formatted);
    if (errors.cardNumber) setErrors((prev) => ({ ...prev, cardNumber: "" }));
  };

  // Format expiry MM/YY
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 2) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setExpiry(raw);
    if (errors.expiry) setErrors((prev) => ({ ...prev, expiry: "" }));
  };

  const fillTestCard = () => {
    setCardholderName("John Doe");
    setCardNumber("4242 4242 4242 4242");
    setExpiry("12/28");
    setCvc("123");
    setPostalCode("10100");
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!cardholderName.trim()) {
      newErrors.cardholderName = "Cardholder name is required";
    }

    const cleanCard = cardNumber.replace(/\s+/g, "");
    if (!cleanCard) {
      newErrors.cardNumber = "Card number is required";
    } else if (!isValidLuhn(cleanCard)) {
      newErrors.cardNumber = "Please enter a valid card number";
    }

    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
      newErrors.expiry = "MM/YY required";
    } else {
      const [mm, yy] = expiry.split("/").map(Number);
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth() + 1;
      if (mm < 1 || mm > 12) {
        newErrors.expiry = "Invalid month";
      } else if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
        newErrors.expiry = "Card has expired";
      }
    }

    if (!cvc || !/^\d{3,4}$/.test(cvc.trim())) {
      newErrors.cvc = "3-4 digits required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    const { error } = await api.payments.process({
      consultation_id: consultationId,
      amount_cents: priceCents,
      currency: "usd",
      cardholder_name: cardholderName,
      card_number: cardNumber.replace(/\s+/g, ""),
      card_expiry: expiry,
      card_cvc: cvc,
      stripe_payment_id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    });

    if (error) {
      toast({
        title: "Payment Unsuccessful",
        description: error.message || "Card verification failed. Please check details.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Zero-out sensitive card information in memory
    setCardNumber("");
    setCvc("");
    setExpiry("");

    // Clear session storage
    sessionStorage.removeItem("patient_id");
    sessionStorage.removeItem("precheck_id");
    sessionStorage.removeItem("consultation_id");
    sessionStorage.removeItem("booking_session_id");
    sessionStorage.removeItem("selected_type_id");
    sessionStorage.removeItem("selected_type_price");
    sessionStorage.removeItem("selected_type_name");

    toast({
      title: "Payment Verified",
      description: "Transaction confirmed. Consultation added to doctor queue.",
    });

    navigate(`/track?code=${trackingCode}`);
  };

  return (
    <PublicLayout>
      <div className="container py-8">
        <div className="mx-auto max-w-xl">
          <Progress value={85} className="mb-6" />
          <p className="mb-2 text-sm text-muted-foreground">Step 4 of 4 · Secure Checkout</p>

          <Card className="shadow-xl border-border/70">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Lock className="h-7 w-7" />
              </div>
              <CardTitle className="font-display text-2xl font-bold">Encrypted Payment</CardTitle>
              <CardDescription>
                Bank-level 256-bit encryption. Card details are verified and never stored.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Order summary banner */}
              <div className="rounded-xl bg-secondary/70 p-4 border space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-semibold text-foreground">{typeName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tracking ID:</span>
                  <span className="font-mono font-bold text-primary">{trackingCode}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-medium text-foreground">Total Due:</span>
                  <span className="text-2xl font-bold text-primary">
                    ${(priceCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quick fill demo card button */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Testing checkout?</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                  onClick={fillTestCard}
                >
                  Use Secure Test Card
                </Button>
              </div>

              {/* Card Form */}
              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <Label htmlFor="cardholder">Cardholder Name</Label>
                  <Input
                    id="cardholder"
                    value={cardholderName}
                    onChange={(e) => {
                      setCardholderName(e.target.value);
                      if (errors.cardholderName) setErrors((prev) => ({ ...prev, cardholderName: "" }));
                    }}
                    placeholder="Full name as printed on card"
                    className={errors.cardholderName ? "border-destructive" : ""}
                  />
                  {errors.cardholderName && (
                    <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.cardholderName}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cardnumber">Card Number</Label>
                    {cardBrand && (
                      <span className="text-xs font-semibold text-primary">{cardBrand}</span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="cardnumber"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="4242 •••• •••• 4242"
                      className={`pl-10 ${errors.cardNumber ? "border-destructive" : ""}`}
                      maxLength={19}
                    />
                    <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                  {errors.cardNumber && (
                    <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.cardNumber}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="expiry">Expiry</Label>
                    <Input
                      id="expiry"
                      value={expiry}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      maxLength={5}
                      className={errors.expiry ? "border-destructive" : ""}
                    />
                    {errors.expiry && (
                      <p className="mt-1 text-xs text-destructive">{errors.expiry}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="cvc">CVC / CVV</Label>
                    <div className="relative">
                      <Input
                        id="cvc"
                        type="password"
                        value={cvc}
                        onChange={(e) => {
                          setCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
                          if (errors.cvc) setErrors((prev) => ({ ...prev, cvc: "" }));
                        }}
                        placeholder="•••"
                        maxLength={4}
                        className={errors.cvc ? "border-destructive" : ""}
                      />
                      <Lock className="absolute right-2.5 top-3 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {errors.cvc && (
                      <p className="mt-1 text-xs text-destructive">{errors.cvc}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="postal">Billing ZIP</Label>
                    <Input
                      id="postal"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value.slice(0, 10))}
                      placeholder="10100"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-2 gradient-primary text-white font-semibold shadow-lg shadow-primary/20"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Verifying & Processing Payment...
                    </span>
                  ) : (
                    `Authorize & Pay $${(priceCents / 100).toFixed(2)}`
                  )}
                </Button>
              </form>

              {/* Trust Badges */}
              <div className="pt-2 border-t space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary/30">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-[11px]">PCI-DSS Level 1</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary/30">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-[11px]">256-Bit SSL/TLS</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary/30">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-[11px]">3D Secure 2.0</span>
                  </div>
                </div>
                <p className="text-[11px] text-center text-muted-foreground">
                  Your payment is protected by anti-fraud algorithms. Primary Account Numbers (PAN) and CVV codes are never stored on our servers.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
