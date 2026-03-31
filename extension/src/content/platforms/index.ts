import { PlatformExtractor } from '../../types';
import { CarousellExtractor } from './carousell';

/**
 * Registry of platform extractors.
 * To add a new platform, create a new extractor class implementing PlatformExtractor
 * and register it here.
 */
const extractors: PlatformExtractor[] = [
  new CarousellExtractor(),
];

export function getExtractorForCurrentSite(): PlatformExtractor | null {
  const hostname = window.location.hostname;

  if (hostname.includes('carousell')) {
    return extractors.find((e) => e.platform === 'carousell') || null;
  }

  // Add more platform checks here:
  // if (hostname.includes('facebook')) return extractors.find(e => e.platform === 'facebook');

  return null;
}

export { CarousellExtractor };
