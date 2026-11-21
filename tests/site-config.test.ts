import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Env } from '../src/env.ts';
import {
  getSiteConfig,
  renderAnalyticsTags,
  renderAdsenseLoader,
  renderAdSlot,
} from '../src/lib/site-config.ts';

function env(overrides: Partial<Env> = {}): Env {
  return {
    GA_ID: '',
    ADSENSE_CLIENT: '',
    TURNSTILE_SITE_KEY: '',
    ...overrides,
  } as Env;
}

test('site config reads identifiers from the environment', () => {
  const config = getSiteConfig(
    env({ GA_ID: 'G-NNFPYD7CWG', ADSENSE_CLIENT: 'ca-pub-7046934020222763' })
  );

  assert.equal(config.gaId, 'G-NNFPYD7CWG');
  assert.equal(config.adsenseClient, 'ca-pub-7046934020222763');
  assert.equal(config.adsensePublisherId, 'pub-7046934020222763');
});

test('analytics tags come from the configured GA id', () => {
  const tags = renderAnalyticsTags(getSiteConfig(env({ GA_ID: 'G-NNFPYD7CWG' })));
  assert.match(tags, /gtag\/js\?id=G-NNFPYD7CWG/);
  assert.match(tags, /gtag\('config', 'G-NNFPYD7CWG'\)/);
});

test('no analytics tags are emitted when GA is unset', () => {
  assert.equal(renderAnalyticsTags(getSiteConfig(env())), '');
});

test('ads load and ad slots come from the configured client id', () => {
  const config = getSiteConfig(env({ ADSENSE_CLIENT: 'ca-pub-7046934020222763' }));
  assert.match(renderAdsenseLoader(config), /ca-pub-7046934020222763/);
  assert.match(renderAdSlot(config, 'ad-header'), /data-ad-client="ca-pub-7046934020222763"/);
  assert.match(renderAdSlot(config, 'ad-header'), /class="ad-slot ad-header"/);
});

test('no ads are emitted when AdSense is unset', () => {
  const config = getSiteConfig(env());
  assert.equal(renderAdsenseLoader(config), '');
  assert.equal(renderAdSlot(config, 'ad-header'), '');
});

test('ads.txt advertises the publisher id matching the client id', () => {
  const config = getSiteConfig(env({ ADSENSE_CLIENT: 'ca-pub-7046934020222763' }));
  assert.equal(
    config.adsTxt,
    'google.com, pub-7046934020222763, DIRECT, f08c47fec0942fa0\n'
  );
});

test('identifiers with quote characters are stripped before templating', () => {
  const config = getSiteConfig(env({ GA_ID: 'G-1\';alert(1);//' }));
  assert.equal(config.gaId, 'G-1alert1');
});
