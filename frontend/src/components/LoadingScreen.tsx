import { useEffect, useState } from "react";

interface LoadingScreenProps {
  message?: string;
  onComplete?: () => void;
  speed?: number;
}

export default function LoadingScreen({
  message,
  onComplete,
  speed = 80,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(5);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => {
              onComplete?.();
            }, 300);
          }, 250);
          return 100;
        }
        // Smooth random increment matching video playback
        const step = Math.floor(Math.random() * 10) + 6;
        return Math.min(prev + step, 100);
      });
    }, speed);

    return () => clearInterval(interval);
  }, [speed, onComplete]);

  const fillPercentage = Math.min(Math.max(progress, 0), 100);

  // Dynamic message matching the user screenshot
  const displayMessage =
    message ||
    (progress < 45
      ? "Authenticating & Initializing..."
      : "Access Granted! Launching Doctor Dashboard...");

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none transition-opacity duration-300 ease-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "radial-gradient(circle at 50% 35%, #185eb8 0%, #05358a 70%, #032563 100%)",
      }}
    >
      <div className="relative flex flex-col items-center justify-center max-w-lg w-full px-6 text-center animate-in zoom-in-95 duration-400">
        {/* Loading Branding Card */}
        <div className="relative w-full max-w-md aspect-[1280/1024] rounded-2xl overflow-hidden shadow-2xl drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)]">
          {/* Card background with Doctor icon, subtitle, and stethoscope graphic */}
          <img
            src="/Loading_bg.jpg"
            alt="ChatDr - A doctor when you need one"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />

          {/* Animated "ChatDr" Wordmark with Left-to-Right White Sweep */}
          <svg
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none"
            style={{
              top: "33.2%",
              width: "44%",
              height: "11.2%",
            }}
            viewBox="0 0 540 115"
          >
            <defs>
              {/* Left-to-right sweep gradient tied to progress */}
              <linearGradient id="chatdrProgressFill" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset={`${Math.max(0, fillPercentage - 4)}%`} stopColor="#ffffff" />
                <stop offset={`${Math.min(100, fillPercentage + 4)}%`} stopColor="rgba(255, 255, 255, 0.22)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.22)" />
              </linearGradient>

              {/* Card drop shadow for depth */}
              <filter id="chatdrShadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0, 0, 0, 0.3)" />
              </filter>

              {/* Shimmer sweep light that travels left-to-right across the text */}
              <linearGradient id="chatdrShimmer" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.75)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                <animate
                  attributeName="x1"
                  from="-100%"
                  to="200%"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x2"
                  from="0%"
                  to="300%"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </linearGradient>

              <clipPath id="chatdrFilledClip">
                <rect x="0" y="0" width={`${fillPercentage}%`} height="115" />
              </clipPath>
            </defs>

            {/* Base Letters with Left-to-Right White Fill Animation */}
            <text
              x="50%"
              y="88"
              textAnchor="middle"
              fontFamily="'Poppins', sans-serif"
              fontWeight="800"
              fontSize="94"
              letterSpacing="-1.5"
              fill="url(#chatdrProgressFill)"
              filter="url(#chatdrShadow)"
            >
              ChatDr
            </text>

            {/* Continuous dynamic shimmer shine traveling across filled letters */}
            {fillPercentage > 5 && (
              <text
                x="50%"
                y="88"
                textAnchor="middle"
                fontFamily="'Poppins', sans-serif"
                fontWeight="800"
                fontSize="94"
                letterSpacing="-1.5"
                fill="url(#chatdrShimmer)"
                clipPath="url(#chatdrFilledClip)"
                className="pointer-events-none mix-blend-overlay"
              >
                ChatDr
              </text>
            )}
          </svg>
        </div>

        {/* Animated Progress Bar (Matching Video & User Screenshot) */}
        <div className="mt-7 w-full max-w-xs sm:max-w-sm flex flex-col items-center">
          <div className="w-full h-3 rounded-full bg-white/15 border border-white/20 p-0.5 overflow-hidden backdrop-blur-sm shadow-inner relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-white to-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.8)] transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status text & percentage counter */}
          <div className="mt-3 flex items-center justify-between w-full text-xs font-medium text-sky-100/90 px-1">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
              {displayMessage}
            </span>
            <span className="font-mono text-sky-200 font-semibold">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
