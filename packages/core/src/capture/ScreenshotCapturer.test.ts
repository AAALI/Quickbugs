import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScreenshotCapturer } from "./ScreenshotCapturer";

type OnCloneFn = (doc: Document) => void;

/** Options html2canvas was last called with, so tests can drive its clone hook. */
let lastOptions: { onclone?: OnCloneFn } | undefined;

vi.mock("html2canvas-pro", () => ({
  default: vi.fn(async (_target: HTMLElement, options: { onclone?: OnCloneFn }) => {
    lastOptions = options;
    return {
      width: 800,
      height: 600,
      // jsdom has no canvas backend, so stand in for the encode step.
      toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
    } as unknown as HTMLCanvasElement;
  }),
}));

/**
 * Run a capture and return the document html2canvas was handed to clone,
 * after the capturer's privacy pass has been applied to it.
 */
async function captureAndGetCloneResult(capturer: ScreenshotCapturer): Promise<Document> {
  await capturer.capture();

  const clone = document.implementation.createHTMLDocument("clone");
  clone.body.innerHTML = document.body.innerHTML;
  lastOptions?.onclone?.(clone);

  return clone;
}

describe("ScreenshotCapturer privacy", () => {
  beforeEach(() => {
    lastOptions = undefined;
    document.body.innerHTML = "";
  });

  it("blurs password fields with no configuration", async () => {
    document.body.innerHTML = `<input type="password" id="pw" value="hunter2" />`;

    const clone = await captureAndGetCloneResult(new ScreenshotCapturer());

    expect(clone.querySelector<HTMLElement>("#pw")!.style.filter).toContain("blur");
  });

  it("blurs one-time-code and payment fields with no configuration", async () => {
    document.body.innerHTML = `
      <input autocomplete="one-time-code" id="otp" />
      <input autocomplete="cc-number" id="card" />
      <input name="CardNumber" id="legacy-card" />
    `;

    const clone = await captureAndGetCloneResult(new ScreenshotCapturer());

    for (const id of ["#otp", "#card", "#legacy-card"]) {
      expect(clone.querySelector<HTMLElement>(id)!.style.filter).toContain("blur");
    }
  });

  it("blurs elements marked with the opt-in attribute", async () => {
    document.body.innerHTML = `<div data-quickbugs-mask id="salary">AED 1,000,000</div>`;

    const clone = await captureAndGetCloneResult(new ScreenshotCapturer());

    expect(clone.querySelector<HTMLElement>("#salary")!.style.filter).toContain("blur");
  });

  it("empties and fills elements marked for blocking", async () => {
    document.body.innerHTML = `<div data-quickbugs-block id="secret">classified</div>`;

    const clone = await captureAndGetCloneResult(new ScreenshotCapturer());
    const blocked = clone.querySelector<HTMLElement>("#secret")!;

    expect(blocked.textContent).toBe("");
    expect(blocked.style.background).not.toBe("");
  });

  it("applies caller selectors in addition to the defaults", async () => {
    document.body.innerHTML = `
      <input type="password" id="pw" />
      <div class="invoice" id="total">AED 40,000</div>
    `;

    const clone = await captureAndGetCloneResult(new ScreenshotCapturer({ maskSelectors: [".invoice"] }));

    expect(clone.querySelector<HTMLElement>("#pw")!.style.filter).toContain("blur");
    expect(clone.querySelector<HTMLElement>("#total")!.style.filter).toContain("blur");
  });

  it("leaves ordinary content untouched", async () => {
    document.body.innerHTML = `<p id="copy">Checkout is broken</p>`;

    const clone = await captureAndGetCloneResult(new ScreenshotCapturer());

    expect(clone.querySelector<HTMLElement>("#copy")!.style.filter).toBe("");
    expect(clone.querySelector<HTMLElement>("#copy")!.textContent).toBe("Checkout is broken");
  });

  it("skips an invalid selector instead of disabling masking entirely", async () => {
    document.body.innerHTML = `<input type="password" id="pw" />`;

    const clone = await captureAndGetCloneResult(
      new ScreenshotCapturer({ maskSelectors: ["!!! not a selector"] }),
    );

    // The typo must not take the built-in password rule down with it.
    expect(clone.querySelector<HTMLElement>("#pw")!.style.filter).toContain("blur");
  });

  it("captures nothing when defaults are explicitly disabled", async () => {
    document.body.innerHTML = `<input type="password" id="pw" />`;

    const clone = await captureAndGetCloneResult(
      new ScreenshotCapturer({ disableDefaultMasking: true }),
    );

    expect(clone.querySelector<HTMLElement>("#pw")!.style.filter).toBe("");
  });

  it("restores scroll position and layout overrides after capture", async () => {
    document.body.innerHTML = `<div style="height: 3000px"></div>`;
    document.documentElement.style.height = "100%";

    await new ScreenshotCapturer().capture();

    expect(document.documentElement.style.height).toBe("100%");
  });
});
