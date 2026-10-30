'use client';

import { useEffect } from 'react';

import { gaMeasurementId, watchAnalyticsConsent } from '../lib/analytics';
import { readConsent } from './ConsentGate';

/**
 * Google Analytics 4, behind the consent bar.
 *
 * Renders nothing. After hydration it applies the stored answer and follows new ones
 * (`lib/analytics.ts`) — the same contract as `WebVitals`. A build without a measurement id
 * never subscribes at all.
 */
export function Analytics() {
  const id = gaMeasurementId();

  useEffect(() => (id ? watchAnalyticsConsent(id, readConsent) : undefined), [id]);

  return null;
}
