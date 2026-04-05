const STYLE_ID = "quickbugs-injected-styles";

const CSS = `
.qb-floating-root {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.qb-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  transition: opacity 0.15s;
}
.qb-btn:hover { opacity: 0.9; }
.qb-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.qb-btn-main {
  height: 2.75rem;
  padding: 0 1rem;
  border-radius: 9999px;
  background: #18181b;
  color: #fff;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.15);
}

.qb-btn-stop {
  height: 2.75rem;
  padding: 0 1rem;
  border-radius: 9999px;
  background: #dc2626;
  color: #fff;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
}

.qb-btn-outline {
  height: 2.25rem;
  padding: 0 0.75rem;
  border-radius: 0.375rem;
  background: #fff;
  color: #18181b;
  border: 1px solid #d1d5db;
}

.qb-recording-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
}

.qb-recording-timer {
  border-radius: 9999px;
  border: 1px solid #fca5a5;
  background: #fef2f2;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  color: #b91c1c;
  text-align: center;
  margin: 0;
}

.qb-menu {
  position: fixed;
  bottom: 4.5rem;
  right: 1rem;
  z-index: 1101;
  width: 18rem;
  border-radius: 1rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  padding: 0.5rem;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.qb-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: 0.75rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  font-family: inherit;
  text-align: left;
}
.qb-menu-item:hover { background: #f3f4f6; }

.qb-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.qb-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}

.qb-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  padding: 1.5rem;
}

.qb-modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.qb-modal-sub {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 1rem;
}

.qb-modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.qb-label {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: -0.5rem;
}

.qb-input {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  box-sizing: border-box;
}
.qb-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }

.qb-textarea {
  width: 100%;
  min-height: 4rem;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}
.qb-textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }

.qb-select {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  box-sizing: border-box;
}

.qb-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.qb-progress {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}
`;

let injected = false;

export function injectStyles(): void {
  if (injected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) { injected = true; return; }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  injected = true;
}
