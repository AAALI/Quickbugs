import { defineComponent, ref, computed, h, Teleport } from "vue";
import type { BugTrackerProvider } from "@quick-bug-reporter/core";
import { useQuickBugs } from "../composables/useQuickBugs";

/**
 * Format a duration in milliseconds as a zero-padded `MM:SS` string.
 *
 * @param ms - Duration in milliseconds (negative values are treated as zero)
 * @returns The formatted duration as `MM:SS`, where minutes and seconds are zero-padded to two digits
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Return a user-facing label for a bug tracker provider identifier.
 *
 * @param provider - Provider identifier to map to a display name
 * @returns A human-readable provider name: `"Linear"` for `"linear"`, `"Jira"` for `"jira"`, `"QuickBugs Cloud"` for `"cloud"`, otherwise the original `provider` value
 */
function providerLabel(provider: BugTrackerProvider): string {
  if (provider === "linear") return "Linear";
  if (provider === "jira") return "Jira";
  if (provider === "cloud") return "QuickBugs Cloud";
  return provider;
}

const CHAR_LIMIT = 4000;

const S = {
  overlay: "position: fixed; inset: 0; z-index: 1200; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  backdrop: "position: absolute; inset: 0; background: rgba(0,0,0,0.5);",
  dialog: "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%; max-width: 42rem; max-height: 90vh; overflow-y: auto; background: white; border-radius: 0.75rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); padding: 1.5rem;",
  form: "display: flex; flex-direction: column; gap: 1rem;",
  title: "font-size: 1.125rem; font-weight: 600; margin: 0;",
  sub: "font-size: 0.875rem; color: #6b7280; margin: 0.25rem 0 0;",
  label: "font-size: 0.875rem; font-weight: 500;",
  input: "width: 100%; height: 2.25rem; padding: 0 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; margin-top: 0.25rem; box-sizing: border-box; font-family: inherit;",
  textarea: "width: 100%; min-height: 6rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; margin-top: 0.5rem; resize: vertical; box-sizing: border-box; font-family: inherit;",
  select: "width: 100%; height: 2.25rem; padding: 0 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; margin-top: 0.25rem; box-sizing: border-box; font-family: inherit;",
  footer: "display: flex; justify-content: flex-end; gap: 0.5rem;",
  btnOutline: "padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: white; cursor: pointer; font-size: 0.875rem; font-family: inherit;",
  btnPrimary: "padding: 0.5rem 1rem; border-radius: 0.375rem; border: none; background: #18181b; color: white; cursor: pointer; font-size: 0.875rem; font-family: inherit;",
  btnDisabled: "padding: 0.5rem 1rem; border-radius: 0.375rem; border: none; background: #9ca3af; color: white; cursor: not-allowed; font-size: 0.875rem; font-family: inherit;",
  error: "font-size: 0.875rem; color: #dc2626; margin: 0;",
  success: "font-size: 0.875rem; color: #059669; margin: 0;",
  notice: "font-size: 0.875rem; color: #92400e; margin: 0;",
};

export const BugReporterModal = defineComponent({
  name: "BugReporterModal",
  setup() {
    const ctx = useQuickBugs();

    const title = ref("");
    const stepsToReproduce = ref("");
    const expectedResult = ref("");
    const actualResult = ref("");
    const additionalContext = ref("");
    const step = ref<"review" | "context">("review");
    const activeTab = ref<"steps" | "expected" | "actual" | "context">("steps");

    const totalChars = computed(() => stepsToReproduce.value.length + expectedResult.value.length + actualResult.value.length + additionalContext.value.length);
    const isOverLimit = computed(() => totalChars.value > CHAR_LIMIT);
    const elapsedLabel = computed(() => formatElapsed(ctx.elapsedMs.value));
    const hasIntegrations = computed(() => ctx.availableProviders.value.length > 0);
    const canSubmit = computed(() =>
      !ctx.isSubmitting.value && !ctx.isCapturingScreenshot.value && hasIntegrations.value &&
      !!ctx.selectedProvider.value && ctx.hasDraft.value && title.value.trim().length > 0 && !isOverLimit.value
    );

    /**
     * Submit the current bug report draft to the configured provider and, if submission succeeds, clear all form fields and return the UI to the review step.
     *
     * @param e - The form submission event
     */
    async function handleSubmit(e: Event) {
      e.preventDefault();
      const result = await ctx.submitReport(title.value, {
        stepsToReproduce: stepsToReproduce.value, expectedResult: expectedResult.value,
        actualResult: actualResult.value, additionalContext: additionalContext.value,
      });
      if (result) {
        title.value = ""; stepsToReproduce.value = ""; expectedResult.value = ""; actualResult.value = ""; additionalContext.value = "";
        step.value = "review"; activeTab.value = "steps";
      }
    }

    /**
 * Closes the bug reporter modal and resets the flow to the initial "review" step.
 */
function handleClose() { ctx.closeModal(); step.value = "review"; }
    /**
 * Discards the current capture draft, clears status messages, closes the bug reporter modal, and resets the flow to the review step.
 */
function handleDiscard() { ctx.clearDraft(); ctx.resetMessages(); ctx.closeModal(); step.value = "review"; }

    /**
     * Create a tab button that switches the active bug-detail tab.
     *
     * @param tab - Identifier of the tab to activate (`"steps"`, `"expected"`, `"actual"`, or `"context"`)
     * @param label - Visible text shown on the button
     * @returns A VNode for a button element that activates the given tab when clicked and visually indicates the active state
     */
    function tabBtn(tab: "steps" | "expected" | "actual" | "context", label: string) {
      const active = activeTab.value === tab;
      return h("button", {
        type: "button", onClick: () => { activeTab.value = tab; },
        style: `padding: 0.5rem 0.75rem; font-size: 0.875rem; font-weight: 500; border: none; background: none; cursor: pointer; border-bottom: 2px solid ${active ? "#4f46e5" : "transparent"}; color: ${active ? "#4f46e5" : "#6b7280"}; font-family: inherit;`,
      }, label);
    }

    /**
     * Render the textarea for the currently selected bug-detail tab.
     *
     * @returns A textarea VNode bound to the active tab's text ref, with the matching placeholder and an input handler that updates that ref.
     */
    function currentTextarea() {
      const map = { steps: stepsToReproduce, expected: expectedResult, actual: actualResult, context: additionalContext };
      const placeholders = { steps: "1. Go to...", expected: "What should happen...", actual: "What actually happened...", context: "Any extra info..." };
      const m = map[activeTab.value];
      return h("textarea", {
        value: m.value, style: S.textarea,
        placeholder: placeholders[activeTab.value],
        onInput: (e: Event) => { m.value = (e.target as HTMLTextAreaElement).value; },
      });
    }

    return () => {
      if (!ctx.isOpen.value) return null;

      const content = step.value === "review"
        ? renderReview()
        : renderContext();

      return h(Teleport, { to: "body" },
        h("div", { "data-bug-reporter-ui": "true", style: S.overlay }, [
          h("div", { style: S.backdrop, onClick: () => { if (!ctx.isSubmitting.value) handleClose(); } }),
          h("div", { style: S.dialog }, [
            h("form", { style: S.form, onSubmit: handleSubmit }, content),
          ]),
        ])
      );
    };

    /**
     * Builds the VNode array for the "Review capture" step of the bug reporter modal.
     *
     * The returned nodes render the header, capture preview or placeholder (depending on whether
     * a screenshot or video draft exists), any error message, and the footer action buttons
     * ("Discard draft" and "Next →").
     *
     * @returns An array of VNodes representing the Review capture UI (header, preview/controls, status, and footer actions)
     */
    function renderReview(): ReturnType<typeof h>[] {
      const nodes: ReturnType<typeof h>[] = [
        h("div", {}, [
          h("h2", { style: S.title }, "Review capture"),
          h("p", { style: S.sub }, `Step 1 of 2. Review your ${ctx.draftMode.value === "video" ? "video" : "screenshot"}, or retake.`),
        ]),
      ];

      if (!ctx.hasDraft.value) {
        nodes.push(h("div", { style: "border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.75rem 1rem; font-size: 0.875rem;" }, [
          h("p", { style: "font-weight: 500; margin: 0;" }, "No capture draft yet"),
          h("p", { style: "color: #6b7280; margin: 0.25rem 0 0;" }, "Start from the Report Bug button and choose Quick screenshot or Record flow first."),
        ]));
      } else if (ctx.draftMode.value === "screenshot") {
        const retakeButtons = h("div", { style: "display: flex; gap: 0.5rem;" }, [
          h("button", { type: "button", style: S.btnOutline, onClick: () => { ctx.closeModal(); void ctx.captureQuickScreenshot().then(() => ctx.openModal()); } }, "Full page"),
          h("button", { type: "button", style: S.btnOutline, onClick: () => { ctx.closeModal(); ctx.startRegionSelection(); } }, "Select area"),
        ]);
        nodes.push(h("div", { style: "display: flex; flex-direction: column; gap: 0.75rem;" }, [
          h("div", { style: "display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;" }, [
            h("p", { style: "font-size: 0.875rem; color: #6b7280; margin: 0;" }, "Screenshot captured. Retake if needed."),
            retakeButtons,
          ]),
          ctx.screenshotPreviewUrl.value
            ? h("img", { src: ctx.screenshotPreviewUrl.value, style: "width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;", alt: "Screenshot preview" })
            : null,
          h("p", { style: "font-size: 0.75rem; color: #6b7280; margin: 0;" }, `Highlights added: ${ctx.screenshotHighlightCount.value}`),
        ]));
      } else {
        nodes.push(h("div", { style: "display: flex; flex-direction: column; gap: 0.75rem;" }, [
          h("div", { style: "display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;" }, [
            h("p", { style: "font-size: 0.875rem; color: #6b7280; margin: 0;" }, `Duration: ${elapsedLabel.value}. Screen + microphone attached.`),
            h("button", { type: "button", style: S.btnOutline, onClick: () => { ctx.closeModal(); void ctx.startRecording(); } }, "Record again"),
          ]),
          ctx.videoPreviewUrl.value
            ? h("video", { src: ctx.videoPreviewUrl.value, controls: true, playsinline: true, preload: "metadata", style: "width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb; background: black;" })
            : null,
          h("p", { style: "font-size: 0.75rem; color: #92400e; margin: 0;" }, "Video recording uses the browser share prompt each time by web platform design."),
        ]));
      }

      if (ctx.error.value) nodes.push(h("p", { style: S.error }, ctx.error.value));

      nodes.push(h("div", { style: S.footer }, [
        h("button", { type: "button", style: S.btnOutline, onClick: handleDiscard }, "Discard draft"),
        h("button", {
          type: "button",
          disabled: !ctx.hasDraft.value || ctx.isCapturingScreenshot.value,
          style: ctx.hasDraft.value && !ctx.isCapturingScreenshot.value ? S.btnPrimary : S.btnDisabled,
          onClick: () => { ctx.resetMessages(); step.value = "context"; },
        }, "Next →"),
      ]));

      return nodes;
    }

    /**
     * Builds the virtual DOM nodes for the "Add context" (step 2) view of the bug reporter modal.
     *
     * The returned nodes include a title and subtitle, an input for the bug title, a tabbed
     * "Bug Details" textarea area with a live character counter, a provider selection dropdown,
     * a capture summary (screenshot/video/none), optional status notices (auto-stop, error, success),
     * and footer actions for navigating back or submitting the report.
     *
     * @returns An array of VNodes composing the "Add context" UI for rendering inside the modal
     */
    function renderContext(): ReturnType<typeof h>[] {
      const nodes: ReturnType<typeof h>[] = [
        h("div", {}, [
          h("h2", { style: S.title }, "Add context"),
          h("p", { style: S.sub }, "Step 2 of 2. Describe the issue and submit. Metadata and network logs are attached automatically."),
        ]),
        h("div", { style: "display: flex; flex-direction: column; gap: 1rem;" }, [
          // Title
          h("div", {}, [
            h("label", { style: S.label }, "Title"),
            h("input", { style: S.input, maxlength: 140, placeholder: "Short summary of the bug", value: title.value, onInput: (e: Event) => { title.value = (e.target as HTMLInputElement).value; } }),
          ]),
          // Tabs
          h("div", {}, [
            h("label", { style: S.label }, "Bug Details"),
            h("div", { style: "display: flex; gap: 0.25rem; border-bottom: 1px solid #e5e7eb; margin-top: 0.5rem;" }, [
              tabBtn("steps", "Steps"), tabBtn("expected", "Expected"), tabBtn("actual", "Actual"), tabBtn("context", "Context"),
            ]),
            currentTextarea(),
            h("p", { style: `font-size: 0.75rem; color: ${isOverLimit.value ? "#dc2626" : "#6b7280"}; margin-top: 0.25rem;` },
              `${totalChars.value}/${CHAR_LIMIT} characters ${isOverLimit.value ? "(over limit)" : ""}`),
          ]),
          // Provider
          h("div", {}, [
            h("label", { style: S.label }, "Submit to"),
            h("select", {
              style: S.select,
              value: ctx.selectedProvider.value ?? "",
              onChange: (e: Event) => { ctx.setSelectedProvider((e.target as HTMLSelectElement).value as BugTrackerProvider); },
            }, ctx.availableProviders.value.map((p) =>
              h("option", { value: p, key: p }, providerLabel(p))
            )),
          ]),
          // Summary
          h("div", { style: "border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.5rem 0.75rem;" }, [
            h("div", { style: "display: flex; align-items: center; justify-content: space-between; font-size: 0.875rem;" }, [
              h("span", { style: "font-weight: 500;" }, "Capture"),
              h("span", { style: "color: #6b7280;" }, ctx.draftMode.value === "screenshot" ? "Screenshot" : ctx.draftMode.value === "video" ? "Video" : "None"),
            ]),
            h("p", { style: "font-size: 0.75rem; color: #6b7280; margin: 0.25rem 0 0;" },
              ctx.draftMode.value === "screenshot"
                ? `${ctx.screenshotHighlightCount.value} highlight${ctx.screenshotHighlightCount.value === 1 ? "" : "s"} added`
                : ctx.draftMode.value === "video" ? `Duration: ${elapsedLabel.value}` : "Missing capture"),
          ]),
        ]),
      ];

      if (ctx.autoStopNotice.value) nodes.push(h("p", { style: S.notice }, ctx.autoStopNotice.value));
      if (ctx.error.value) nodes.push(h("p", { style: S.error }, ctx.error.value));
      if (ctx.success.value) nodes.push(h("p", { style: S.success }, ctx.success.value));

      nodes.push(h("div", { style: S.footer }, [
        h("button", {
          type: "button", style: S.btnOutline, disabled: ctx.isSubmitting.value,
          onClick: () => { ctx.resetMessages(); step.value = "review"; },
        }, "← Back"),
        h("button", {
          type: "submit",
          disabled: !canSubmit.value,
          style: canSubmit.value ? S.btnPrimary : S.btnDisabled,
        }, ctx.isSubmitting.value ? (ctx.submissionProgress.value || "Submitting...") : `Submit to ${ctx.selectedProvider.value ? providerLabel(ctx.selectedProvider.value) : "tracker"}`),
      ]));

      return nodes;
    }
  },
});
