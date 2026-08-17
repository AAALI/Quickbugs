import { describe, expect, it } from "vitest";

import { REDACTED } from "../privacy";
import { bugReportPayload, recordingFetch } from "../testing/payload";
import { JiraIntegration } from "./jira";
import { LinearIntegration } from "./linear";

/**
 * Both trackers are exercised through their submit-proxy path — the
 * configuration the docs recommend, since it keeps API credentials server-side.
 */

describe("JiraIntegration", () => {
  const okBody = { jira: { id: "10001", key: "BUG-42", url: "https://acme.atlassian.net/browse/BUG-42" } };

  it("posts the fields a Jira proxy expects", async () => {
    const { fetchImpl, sent } = recordingFetch(okBody);
    const jira = new JiraIntegration({
      submitProxyEndpoint: "/api/jira/submit",
      projectKey: "BUG",
      fetchImpl,
    });

    await jira.submit(bugReportPayload());
    const form = sent[0].init.body as FormData;

    expect(sent[0].url).toBe("/api/jira/submit");
    expect(form.get("provider")).toBe("jira");
    expect(form.get("title")).toBe("Checkout fails on submit");
    expect(form.get("projectKey")).toBe("BUG");
    expect(form.get("issueType")).toBeTruthy();
  });

  it("always attaches network logs and client metadata", async () => {
    const { fetchImpl, sent } = recordingFetch(okBody);
    const jira = new JiraIntegration({ submitProxyEndpoint: "/api/jira/submit", fetchImpl });

    await jira.submit(bugReportPayload());
    const form = sent[0].init.body as FormData;

    expect(form.get("networkLogsFile")).toBeInstanceOf(Blob);
    expect(form.get("clientMetadataFile")).toBeInstanceOf(Blob);
  });

  it("redacts credentials from the page URL written into the issue", async () => {
    const { fetchImpl, sent } = recordingFetch(okBody);
    const jira = new JiraIntegration({ submitProxyEndpoint: "/api/jira/submit", fetchImpl });

    await jira.submit(
      bugReportPayload({ pageUrl: "https://app.example.com/cb?access_token=sk_live_leak" }),
    );

    const description = String((sent[0].init.body as FormData).get("description"));
    expect(description).not.toContain("sk_live_leak");
    // Percent-encoded, as any query value would be.
    expect(description).toContain(encodeURIComponent(REDACTED));
  });

  it("returns the created issue identity", async () => {
    const { fetchImpl } = recordingFetch(okBody);
    const jira = new JiraIntegration({ submitProxyEndpoint: "/api/jira/submit", fetchImpl });

    const result = await jira.submit(bugReportPayload());

    expect(result).toMatchObject({
      provider: "jira",
      issueId: "10001",
      issueKey: "BUG-42",
      issueUrl: "https://acme.atlassian.net/browse/BUG-42",
    });
  });

  it("surfaces the proxy's error message", async () => {
    const { fetchImpl } = recordingFetch({ error: { message: "Project BUG not found" } }, 400);
    const jira = new JiraIntegration({ submitProxyEndpoint: "/api/jira/submit", fetchImpl });

    await expect(jira.submit(bugReportPayload())).rejects.toThrow(/Project BUG not found/);
  });

  it("rejects a success response that omits the issue identity", async () => {
    const { fetchImpl } = recordingFetch({ jira: {} });
    const jira = new JiraIntegration({ submitProxyEndpoint: "/api/jira/submit", fetchImpl });

    await expect(jira.submit(bugReportPayload())).rejects.toThrow(/invalid response/);
  });

  it("refuses to submit with no credentials and no proxy configured", async () => {
    const jira = new JiraIntegration({});

    await expect(jira.submit(bugReportPayload())).rejects.toThrow();
  });
});

describe("LinearIntegration", () => {
  const okBody = { linear: { id: "iss_1", identifier: "ENG-42", url: "https://linear.app/i/ENG-42" } };

  it("posts to the configured submit proxy", async () => {
    const { fetchImpl, sent } = recordingFetch(okBody);
    const linear = new LinearIntegration({ submitProxyEndpoint: "/api/linear/submit", fetchImpl });

    await linear.submit(bugReportPayload());

    expect(sent[0].url).toBe("/api/linear/submit");
    expect((sent[0].init.body as FormData).get("provider")).toBe("linear");
  });

  it("redacts credentials from the page URL written into the issue", async () => {
    const { fetchImpl, sent } = recordingFetch(okBody);
    const linear = new LinearIntegration({ submitProxyEndpoint: "/api/linear/submit", fetchImpl });

    await linear.submit(
      bugReportPayload({ pageUrl: "https://app.example.com/cb?access_token=sk_live_leak" }),
    );

    const description = String((sent[0].init.body as FormData).get("description"));
    expect(description).not.toContain("sk_live_leak");
    // Percent-encoded, as any query value would be.
    expect(description).toContain(encodeURIComponent(REDACTED));
  });

  it("surfaces the proxy's error message", async () => {
    const { fetchImpl } = recordingFetch({ error: "Team not found" }, 400);
    const linear = new LinearIntegration({ submitProxyEndpoint: "/api/linear/submit", fetchImpl });

    await expect(linear.submit(bugReportPayload())).rejects.toThrow(/Team not found/);
  });

  it("refuses to submit with no credentials and no proxy configured", async () => {
    const linear = new LinearIntegration({});

    await expect(linear.submit(bugReportPayload())).rejects.toThrow();
  });
});
