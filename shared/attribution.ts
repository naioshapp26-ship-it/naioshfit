// Small utility to parse coach attribution from a URL search string.
export function parseCoachAttribution(search: string): number | undefined {
  try {
    const params = new URLSearchParams(search);
    const coachIdStr = params.get('coachId');
    const refStr = params.get('ref');
    const pick = coachIdStr ?? refStr ?? undefined;
    if (!pick) return undefined;
    if (!/^\d+$/.test(pick)) return undefined;
    const id = parseInt(pick, 10);
    return id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}
