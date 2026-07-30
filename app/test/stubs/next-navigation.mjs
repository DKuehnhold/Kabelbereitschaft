// Ersatz fuer `next/navigation` in den Einheitentests der Sitzungssperre.
//
// `redirect()` wirkt in Next durch eine Ausnahme. Hier wird dieselbe Form
// nachgebildet, damit der Test das ZIEL der Umleitung pruefen kann, statt sich
// auf einen Rueckgabewert zu verlassen, den es nicht gibt.

export class RedirectSignal extends Error {
  constructor(target) {
    super(`REDIRECT ${target}`);
    this.name = "RedirectSignal";
    this.target = target;
  }
}

export function redirect(target) {
  throw new RedirectSignal(target);
}

export function notFound() {
  throw new Error("NOT_FOUND");
}
