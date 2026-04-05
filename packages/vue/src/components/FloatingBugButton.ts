import { defineComponent, ref, computed, onMounted, onUnmounted, h, Teleport } from "vue";
import { useQuickBugs } from "../composables/useQuickBugs";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export const FloatingBugButton = defineComponent({
  name: "FloatingBugButton",
  setup() {
    const ctx = useQuickBugs();
    const menuOpen = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    const elapsed = computed(() => formatElapsed(ctx.elapsedMs.value));
    const maxElapsed = computed(() => formatElapsed(ctx.maxDurationMs));
    const disabled = computed(() => ctx.isCapturingScreenshot.value || ctx.isSelectingRegion.value);

    function onPointerDown(event: PointerEvent) {
      if (!menuOpen.value) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.value?.contains(target)) menuOpen.value = false;
    }

    onMounted(() => { window.addEventListener("pointerdown", onPointerDown); });
    onUnmounted(() => { window.removeEventListener("pointerdown", onPointerDown); });

    async function handleQuickScreenshot() {
      menuOpen.value = false;
      await ctx.captureQuickScreenshot();
      ctx.openModal();
    }

    async function handleStartRecording() {
      menuOpen.value = false;
      await ctx.startRecording();
    }

    async function handleStopRecording() {
      const ok = await ctx.stopRecording();
      if (ok) ctx.openModal();
    }

    return () => {
      if (ctx.availableProviders.value.length === 0) return null;

      const children: ReturnType<typeof h>[] = [];

      if (ctx.isRecording.value) {
        children.push(
          h("div", { style: "display: flex; flex-direction: column; gap: 0.5rem;" }, [
            h("button", {
              type: "button",
              onClick: () => void handleStopRecording(),
              style: "display: inline-flex; align-items: center; gap: 0.5rem; height: 2.75rem; padding: 0 1rem; border-radius: 9999px; background: #dc2626; color: white; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 500; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); font-family: inherit;",
            }, [
              h("span", { innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>' }),
              "Stop recording",
            ]),
            h("p", {
              style: "border-radius: 9999px; border: 1px solid #fca5a5; background: #fef2f2; padding: 0.25rem 0.75rem; font-size: 0.75rem; color: #b91c1c; text-align: center; margin: 0;",
            }, `Recording ${elapsed.value} / ${maxElapsed.value}`),
          ])
        );
      } else {
        if (menuOpen.value) {
          const menuItems = [
            h("button", {
              type: "button", disabled: disabled.value,
              onClick: () => void handleQuickScreenshot(),
              style: "display: flex; align-items: center; gap: 0.5rem; width: 100%; height: 2.5rem; padding: 0 0.75rem; border-radius: 0.75rem; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; text-align: left; font-family: inherit;",
            }, "Full page screenshot"),
            h("button", {
              type: "button", disabled: disabled.value,
              onClick: () => { menuOpen.value = false; ctx.startRegionSelection(); },
              style: "display: flex; align-items: center; gap: 0.5rem; width: 100%; height: 2.5rem; padding: 0 0.75rem; border-radius: 0.75rem; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; text-align: left; font-family: inherit;",
            }, "Select area"),
            h("button", {
              type: "button", disabled: disabled.value,
              onClick: () => void handleStartRecording(),
              style: "display: flex; align-items: center; gap: 0.5rem; width: 100%; height: 2.5rem; padding: 0 0.75rem; border-radius: 0.75rem; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; text-align: left; font-family: inherit;",
            }, "Record flow video"),
          ];

          if (ctx.hasDraft.value) {
            menuItems.push(
              h("button", {
                type: "button", disabled: disabled.value,
                onClick: () => { menuOpen.value = false; ctx.openModal(); },
                style: "display: flex; align-items: center; gap: 0.5rem; width: 100%; height: 2.5rem; padding: 0 0.75rem; border-radius: 0.75rem; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; text-align: left; font-family: inherit;",
              }, [
                "Continue draft",
                h("span", { style: "margin-left: auto; font-size: 0.75rem; color: #6b7280;" },
                  ctx.draftMode.value === "screenshot" ? "Screenshot" : "Video"),
              ])
            );
          }

          children.push(
            h("div", {
              "data-bug-reporter-ui": "true",
              style: "margin-bottom: 0.5rem; width: 18rem; border-radius: 1rem; border: 1px solid #e5e7eb; background: white; padding: 0.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);",
            }, menuItems)
          );
        }

        children.push(
          h("button", {
            type: "button",
            disabled: disabled.value,
            onClick: () => { menuOpen.value = !menuOpen.value; },
            style: "display: inline-flex; align-items: center; gap: 0.5rem; height: 2.75rem; padding: 0 1rem; border-radius: 9999px; background: #18181b; color: white; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 500; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.15); font-family: inherit;",
          }, [
            h("span", {
              innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            }),
            "Report Bug",
          ])
        );
      }

      return h("div", {
        ref: containerRef,
        "data-bug-reporter-ui": "true",
        style: "position: fixed; bottom: 1rem; right: 1rem; z-index: 1100; display: flex; flex-direction: column; align-items: flex-end; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
      }, children);
    };
  },
});
