/**
 * Standardize Best Practice codes across the application.
 * Normalizes legacy project-scoped identifiers (e.g. "BP-A-GCP-lens-wafr-gcp-security-IAM")
 * into clean, standard Well-Architected Framework identifiers (e.g. "BP-SEC-IAM").
 */
export function formatBpCode(raw: string): string {
  if (!raw) return '';
  // Convert long assessment-embedded IDs like "BP-A-GCP-lens-wafr-gcp-security-IAM" to "BP-SEC-IAM"
  const m = raw.match(/BP-A-[A-Za-z0-9]+-(?:.*?)-(security|reliability|cost|operations|performance|sustainability)-([A-Za-z0-9]+)/i);
  if (m) {
    const pillarShort = m[1].slice(0, 3).toUpperCase();
    const domain = m[2].toUpperCase();
    return `BP-${pillarShort}-${domain}`;
  }
  if (raw.startsWith('BP-A-')) {
    const parts = raw.split('-');
    if (parts.length >= 3) {
      const domain = parts[parts.length - 1];
      const p = parts[parts.length - 2];
      return `BP-${p.slice(0, 3).toUpperCase()}-${domain.toUpperCase()}`;
    }
  }
  return raw;
}
