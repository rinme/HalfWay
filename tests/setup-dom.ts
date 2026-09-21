import { GlobalWindow } from "happy-dom";

const win = new GlobalWindow();
for (const key of Object.getOwnPropertyNames(win)) {
  if (!(key in globalThis)) {
    try {
      (globalThis as any)[key] = (win as any)[key];
    } catch {}
  }
}
(globalThis as any).window = globalThis;
(globalThis as any).document = win.document;
(globalThis as any).navigator = win.navigator;
(globalThis as any).HTMLElement = win.HTMLElement;
(globalThis as any).Element = win.Element;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).__happyDoc = win.document;
(globalThis as any).__happyWin = win;

