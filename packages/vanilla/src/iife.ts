/**
 * IIFE entry point for CDN / script-tag usage.
 * Exposes window.QuickBugs.init(), .showReporter(), .submit(), .destroy()
 * and integration constructors.
 */
export { init, showReporter, submit, destroy } from "./index";
export { CloudIntegration } from "@quick-bug-reporter/core";
export { LinearIntegration } from "@quick-bug-reporter/core";
export { JiraIntegration } from "@quick-bug-reporter/core";
