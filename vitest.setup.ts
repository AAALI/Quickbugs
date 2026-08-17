/**
 * jsdom shims for browser APIs the capture engine touches.
 *
 * jsdom throws "Not implemented" for these rather than returning a value, which
 * floods test output with stack traces for behaviour the code already handles.
 * Each shim below matches what a real browser would do in the degraded case, so
 * the fallback paths stay under test rather than being mocked away.
 */

// jsdom ships no canvas backend. Returning null is what a browser does when the
// context type is unavailable, and ScreenshotCapturer already falls back to
// encoding the uncropped canvas in that case.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];

// jsdom does not lay out content, so scrolling is a no-op rather than an error.
window.scrollTo = (() => {}) as typeof window.scrollTo;
