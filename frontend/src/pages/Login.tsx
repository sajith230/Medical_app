import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Sparkles } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

export default function Login() {
  const [email, setEmail] = useState("doctor@medilanka.com");
  const [password, setPassword] = useState("doctor123");
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Authenticating...");

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowLoading(true);
    setLoadingMessage("Authenticating Doctor Credentials...");
    setLoading(true);

    const { data, error } = await api.auth.signInWithPassword({
      email,
      password,
      asAdmin: true, // Doctor is admin
    });

    if (error) {
      setShowLoading(false);
      setLoading(false);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } else {
      setLoadingMessage("Access Granted! Launching Doctor Dashboard...");
      // Let the progress bar animation finish smoothly
      setTimeout(() => {
        toast({
          title: "Welcome Back",
          description: `Signed in as ${data?.user?.full_name || email}`,
        });
        navigate("/dashboard");
      }, 1200);
    }
  };

  const handleGoogleLogin = async () => {
    setShowLoading(true);
    setLoadingMessage("Connecting to Google Authentication...");
    const { error } = await api.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setShowLoading(false);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <PublicLayout>
      {/* Full-screen Loading Screen only active during Login */}
      {showLoading && <LoadingScreen message={loadingMessage} />}

      <div className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md shadow-xl border-border/60">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Stethoscope className="h-7 w-7" />
            </div>

            <CardTitle className="font-display text-2xl font-bold">Doctor Login</CardTitle>
            <CardDescription className="text-sm">
              Sign in to access your doctor dashboard, consultation queue & clinical management.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {/* Quick credentials auto-fill */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 border text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Doctor (Admin):</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => {
                  setEmail("doctor@medilanka.com");
                  setPassword("doctor123");
                }}
              >
                doctor@medilanka.com
              </Button>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or with credentials</span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Doctor Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@medilanka.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full font-medium gradient-primary text-white"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In to Doctor Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
