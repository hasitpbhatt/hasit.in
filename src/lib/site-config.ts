/**
 * Site-wide configuration read from the Worker environment.
 *
 * GA4 and AdSense identifiers are public by nature (they end up in every
 * visitor's page source), so they live in `wrangler.toml [vars]`. Hardcoding
 * them in templates is how we ended up shipping a GA id that does not exist,
 * so every template reads them from here instead.
 */

import type { Env } from '../env';

/** Characters that are legal in a GA4 measurement id / AdSense client id. */
function safeIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '');
}

export interface SiteConfig {
  /** GA4 measurement id, e.g. "G-XXXXXXX". Empty disables analytics. */
  gaId: string;
  /** AdSense client id, e.g. "ca-pub-123". Empty disables ads. */
  adsenseClient: string;
  /** AdSense publisher id, e.g. "pub-123". Used for ads.txt. */
  adsensePublisherId: string;
  /** Cloudflare Turnstile site key. */
  turnstileSiteKey: string;
  /** Contents of ads.txt, empty when ads are disabled. */
  adsTxt: string;
}

export function getSiteConfig(env: Env): SiteConfig {
  const adsenseClient = safeIdentifier(env.ADSENSE_CLIENT || '');
  // AdSense client ids are ca-pub-123; the publisher id is the same digits.
  const adsensePublisherId = adsenseClient.replace(/^ca-/, '');

  return {
    gaId: safeIdentifier(env.GA_ID || ''),
    adsenseClient,
    adsensePublisherId,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    adsTxt: adsensePublisherId
      ? `google.com, ${adsensePublisherId}, DIRECT, f08c47fec0942fa0\n`
      : '',
  };
}

/** GA4 loader. Returns an empty string when analytics is disabled. */
export function renderAnalyticsTags(config: SiteConfig): string {
  if (!config.gaId) return '';
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${config.gaId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${config.gaId}');
  </script>`;
}

/** AdSense loader. Returns an empty string when ads are disabled. */
export function renderAdsenseLoader(config: SiteConfig): string {
  if (!config.adsenseClient) return '';
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" crossorigin="anonymous"></script>
  <script>
    (adsbygoogle = window.adsbygoogle || []).push({
      google_ad_client: "${config.adsenseClient}",
      enable_page_level_ads: true
    });
  </script>`;
}

/**
 * A single ad slot. Returns an empty string when ads are disabled so we do
 * not ship empty reserved space for ads that cannot render.
 */
export function renderAdSlot(config: SiteConfig, slot: string): string {
  if (!config.adsenseClient) return '';
  return `<div class="ad-slot ${slot}">
    <ins class="adsbygoogle" style="display:block" data-ad-client="${config.adsenseClient}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  </div>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`;
}
