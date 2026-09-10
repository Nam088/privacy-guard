import { browser } from '#imports';

/**
 * Reads the extension version from the manifest, which is generated from
 * package.json at build time. Kept in one place so no view hardcodes a version
 * that then drifts on the next release.
 *
 * Returns an empty string when the manifest is unavailable, so callers can
 * simply omit the version rather than render a wrong one.
 */
export function getExtensionVersion(): string {
  try {
    return browser.runtime.getManifest().version ?? '';
  } catch {
    return '';
  }
}

/**
 * Formats the version for display, for example "0.12.0" becomes "v0.12.0".
 * An unavailable version formats to an empty string.
 */
export function formatVersionBadge(version: string): string {
  return version ? `v${version}` : '';
}
