import React from "react";

// Ad monetization configuration
// Set `enabled: true` whenever your app gets bigger and you want to turn on ads!
export const AD_CONFIG = {
  enabled: false, // Disabled for clean launch
  googleAdsenseClientId: "", // e.g. "ca-pub-1234567890123456"
  googleAdSlotId: "",        // e.g. "1234567890"
  sponsors: [
    {
      id: 1,
      title: "Host Your Web App Fast",
      subtitle: "Cloud Servers with 99.9% Uptime",
      badge: "Sponsored",
      cta: "Explore Cloud",
      url: "https://www.digitalocean.com/",
      gradient: "from-blue-600/30 to-indigo-600/30",
    },
    {
      id: 2,
      title: "Secure Fast VPN",
      subtitle: "Protect your privacy on any Wi-Fi network",
      badge: "Ad",
      cta: "Learn More",
      url: "https://nordvpn.com/",
      gradient: "from-cyan-600/30 to-teal-600/30",
    },
  ],
};

export default function AdBanner({ variant = "sidebar" }) {
  if (!AD_CONFIG.enabled) return null;

  if (AD_CONFIG.googleAdsenseClientId) {
    return (
      <div className="w-full my-2 overflow-hidden rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center">
        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Advertisement</span>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={AD_CONFIG.googleAdsenseClientId}
          data-ad-slot={AD_CONFIG.googleAdSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  const sponsor = AD_CONFIG.sponsors[0];
  return (
    <div className="w-full my-2 select-none">
      <a
        href={sponsor.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block rounded-2xl p-3 bg-gradient-to-r ${sponsor.gradient} border border-white/10 hover:border-white/20 transition-all duration-150 backdrop-blur-md group shadow-sm`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/15 text-white/90">
            {sponsor.badge}
          </span>
          <span className="text-[10px] text-cyan-300 font-medium group-hover:underline flex items-center gap-0.5">
            {sponsor.cta} &rarr;
          </span>
        </div>
        <p className="text-xs font-bold text-white truncate drop-shadow-sm">
          {sponsor.title}
        </p>
        <p className="text-[10px] text-slate-300 truncate mt-0.5">
          {sponsor.subtitle}
        </p>
      </a>
    </div>
  );
}
