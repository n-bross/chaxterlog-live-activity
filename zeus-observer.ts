// Injected into the user's own WebView. Never reads forms, cookies or network traffic.
export const OBSERVER_SCRIPT = `
(() => {
  if (location.origin !== 'https://zeiterfassung.grafing.de' || !document.documentElement || window.__zeusObserverInstalled) return;
  window.__zeusObserverInstalled = true;
  let activeTap = null;
  let previous = '';
  let changes = 0;
  const snapshot = () => {
    const result = document.getElementById('TerminalResult');
    if (!result) return null;
    return {
      text: (result.innerText || result.textContent || '').trim().slice(0, 4000),
      fields: Array.from(result.querySelectorAll('.term-result-status, .term-result-action, .term-result-time, .term-result-value, .term-result-type'))
        .slice(0, 30).map(e => ({ tag: e.tagName, className: e.className, text: (e.textContent || '').trim().slice(0, 300) })),
    };
  };
  const send = (kind, result) => {
    if (!activeTap) return;
    try {
      const reply = window.webkit.messageHandlers.zeusObservation.postMessage({
        kind, at: new Date().toISOString(), tapAt: activeTap,
        button: 'Kommt/Geht', result,
      });
      if (reply && reply.catch) reply.catch(() => {});
    } catch (_) {}
  };
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const button = event.target?.closest?.('#uiBookingActions button');
    if (!button || button.textContent.trim() !== 'Kommt/Geht') return;
    activeTap = new Date().toISOString();
    changes = 0;
    const result = snapshot();
    previous = JSON.stringify(result);
    send('tap', result);
  }, true);
  new MutationObserver(() => {
    if (!activeTap || changes >= 60) return;
    const result = snapshot();
    if (!result) return;
    const serialized = JSON.stringify(result);
    if (serialized === previous) return;
    previous = serialized;
    changes++;
    send('result', result);
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
})();`

export type Observation = {
  kind: "tap" | "result"
  at: string
  tapAt: string
  button: "Kommt/Geht"
  result: null | { text: string; fields: { tag: string; className: string; text: string }[] }
}

// The native side only accepts the small, explicit observation schema.
export function normalizeObservation(value: unknown): Observation | null {
  if (!value || typeof value !== "object") return null
  const data = value as Record<string, unknown>
  if ((data.kind !== "tap" && data.kind !== "result") || data.button !== "Kommt/Geht"
    || typeof data.at !== "string" || !Number.isFinite(Date.parse(data.at))
    || typeof data.tapAt !== "string" || !Number.isFinite(Date.parse(data.tapAt))) return null
  let result: Observation["result"] = null
  if (data.result && typeof data.result === "object") {
    const raw = data.result as Record<string, unknown>
    if (typeof raw.text !== "string" || !Array.isArray(raw.fields)) return null
    result = {
      text: raw.text.slice(0, 4000),
      fields: raw.fields.slice(0, 30).filter((f) => f && typeof f.tag === "string" && typeof f.className === "string" && typeof f.text === "string")
        .map((f) => ({ tag: f.tag.slice(0, 20), className: f.className.slice(0, 150), text: f.text.slice(0, 300) })),
    }
  }
  return { kind: data.kind, at: data.at, tapAt: data.tapAt, button: "Kommt/Geht", result }
}
