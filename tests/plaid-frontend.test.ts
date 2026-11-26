import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConnectButton from "@/components/connectBank/ConnectButtonComponent";
import AddAccountButton from "@/components/addAccounts/AddAccountButton";

// Existing tests use the node renderer. Capture Link callbacks and preserve
// state across explicit renders without adding a DOM or test-only app API.
const ui = vi.hoisted(() => ({
  state: [] as unknown[], index: 0,
  onSuccess: undefined as undefined | ((token: string, metadata: object) => Promise<void>),
  onExit: undefined as undefined | ((error: null) => void),
  linkToken: "",
  push: vi.fn(), refresh: vi.fn(), success: vi.fn(), info: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: vi.fn(),
  useRef: <T,>(initial: T) => {
    const index = ui.index++;
    if (!(index in ui.state)) ui.state[index] = { current: initial };
    return ui.state[index];
  },
  useState: <T,>(initial: T) => {
    const index = ui.index++;
    if (!(index in ui.state)) ui.state[index] = initial;
    return [ui.state[index], (value: T) => { ui.state[index] = value; }];
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: ui.push, refresh: ui.refresh }) }));
vi.mock("react-plaid-link", () => ({ usePlaidLink: (options: { token: string; onSuccess: typeof ui.onSuccess; onExit: typeof ui.onExit }) => {
  ui.onSuccess = options.onSuccess;
  ui.onExit = options.onExit;
  ui.linkToken = options.token;
  return { open: vi.fn(), ready: true, error: null };
} }));
vi.mock("sonner", () => ({ toast: { success: ui.success, info: ui.info, error: vi.fn() } }));

const request = vi.fn();
function render(kind: "connect" | "refresh") {
  ui.index = 0;
  return renderToStaticMarkup(kind === "connect"
    ? createElement(ConnectButton, { title: "Connect bank" })
    : createElement(AddAccountButton, { plaidItemUuid: "synthetic-item" }));
}
function response(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function button(label: string) {
  ui.index = 0;
  const tree = AddAccountButton({ plaidItemUuid: "synthetic-item" });
  type Props = { children?: ReactNode; onClick?: () => void; disabled?: boolean };
  function find(node: ReactNode): Props | undefined {
    if (!isValidElement<Props>(node)) return;
    if (node.type === "button" && node.props.children === label) return node.props;
    for (const child of Children.toArray(node.props.children)) {
      const found = find(child);
      if (found) return found;
    }
  }
  const found = find(tree);
  expect(found, `Button ${label} should be rendered`).toBeDefined();
  return found!;
}
async function completeLink() {
  await ui.onSuccess!("synthetic-public-token", {});
}
beforeEach(() => {
  ui.state = [];
  ui.index = 0;
  request.mockReset();
  vi.stubGlobal("fetch", request);
});

describe("Connection outcome UI", () => {
  it.each(["503", "gateway", "transport", "malformed", "unknown409", "malformed409", "null409"])("keeps %s unconfirmed, ends loading, prevents reconnect and offers dashboard", async (failure) => {
    render("connect");
    if (failure === "transport") request.mockRejectedValue(new TypeError("Network unavailable"));
    else if (failure === "gateway") request.mockResolvedValue(response(502, { error: "Bad gateway" }));
    else if (failure === "unknown409") request.mockResolvedValue(response(409, { error: "Conflict" }));
    else if (failure === "malformed409") request.mockResolvedValue(new Response("invalid JSON", { status: 409 }));
    else if (failure === "null409") request.mockResolvedValue(new Response("null", { status: 409 }));
    else if (failure === "malformed") request.mockResolvedValue(new Response("invalid JSON"));
    else request.mockResolvedValue(response(503, { code: "CONNECTION_OUTCOME_UNCONFIRMED" }));
    await completeLink();
    const html = render("connect");
    expect(html).toContain("outcome is unconfirmed");
    expect(html).toContain("Check dashboard");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Connecting bank...");
    expect(html).not.toContain("Retry transaction sync");
    expect(request).toHaveBeenCalledTimes(1);
    expect(ui.push).not.toHaveBeenCalled();
    expect(ui.refresh).not.toHaveBeenCalled();
  });
  it("keeps the confirmed duplicate dashboard contract without another sync", async () => {
    render("connect");
    request.mockResolvedValue(response(409, { error: "already connected", code: "ALREADY_CONNECTED" }));
    await completeLink();
    expect(ui.push).toHaveBeenCalledWith("/dashboard");
    expect(request).toHaveBeenCalledTimes(1);
    expect(render("connect")).not.toContain("Connecting bank...");
  });
  it("syncs only after confirmed initialization", async () => {
    render("connect");
    request.mockResolvedValueOnce(response(200, { plaid_item_uuid: "synthetic-item" }))
      .mockResolvedValueOnce(response(200, {}));
    await completeLink();
    expect(request).toHaveBeenCalledTimes(2);
    expect(ui.push).toHaveBeenCalledWith("/dashboard");
    expect(ui.refresh).toHaveBeenCalledOnce();
  });
});

describe("Account refresh outcome UI", () => {
  const cases = [
    [409, { error: "SYNC_BUSY", accountRefreshSucceeded: false, accountRefreshStatus: "not_completed", transactionSyncStatus: "busy" }, "sync is already in progress", false],
    [409, { error: "SYNC_SUPERSEDED", accountRefreshSucceeded: false, accountRefreshStatus: "not_completed" }, "sync was superseded", false],
    [409, { error: "SYNC_SUPERSEDED", accountRefreshSucceeded: true, accountRefreshStatus: "succeeded" }, "Accounts were updated.", true],
    [500, { accountRefreshSucceeded: false, accountRefreshStatus: "not_completed" }, "Accounts could not be refreshed", false],
    [500, { accountRefreshSucceeded: true, accountRefreshStatus: "succeeded" }, "Accounts were updated, but transaction sync did not complete", true],
    [500, { error: "TRANSACTION_SYNC_OUTCOME_UNCONFIRMED", accountRefreshSucceeded: true, accountRefreshStatus: "succeeded", transactionSyncStatus: "unconfirmed" }, "Accounts were updated, but the transaction sync outcome is unconfirmed", true],
    [500, { accountRefreshSucceeded: false, accountRefreshStatus: "unconfirmed" }, "outcome is unconfirmed", false],
    [409, { error: "ITEM_LOGIN_REQUIRED", accountRefreshSucceeded: false, accountRefreshStatus: "not_completed" }, "Use Update bank connection", true],
    [409, { error: "ITEM_LOGIN_REQUIRED", accountRefreshSucceeded: true, accountRefreshStatus: "succeeded" }, "Accounts were updated.", true],
    [502, {}, "outcome is unconfirmed", false],
    [200, {}, "outcome is unconfirmed", false],
  ] as const;
  it.each(cases)("handles HTTP %i %j truthfully", async (status, body, message, refresh) => {
    render("refresh");
    request.mockResolvedValue(response(status, body));
    await completeLink();
    const html = render("refresh");
    expect(html).toContain(message);
    expect(html).not.toContain("Syncing...");
    expect(html).not.toContain("Preparing Link...");
    expect(ui.info).toHaveBeenCalledOnce();
    expect(ui.success).not.toHaveBeenCalled();
    expect(ui.refresh).toHaveBeenCalledTimes(refresh ? 1 : 0);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("shows complete success and refreshes committed balances", async () => {
    render("refresh");
    request.mockResolvedValue(response(200, {
      accountRefreshSucceeded: true, accountRefreshStatus: "succeeded", transactionSyncStatus: "synced",
      addedCount: 2, removedCount: 0, modifiedCount: 1,
    }));
    await completeLink();
    expect(ui.success).toHaveBeenCalledWith("2 added, 0 removed, 1 modified");
    expect(ui.info).not.toHaveBeenCalled();
    expect(ui.refresh).toHaveBeenCalledOnce();
    expect(render("refresh")).toContain("Add Account");
  });
  it("does not turn a lost refresh response into failure or retry", async () => {
    render("refresh");
    request.mockRejectedValue(new TypeError("Network unavailable"));
    await completeLink();
    expect(render("refresh")).toContain("outcome is unconfirmed");
    expect(ui.success).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(["busy", "superseded", "partial"])("recovers from %s through Dismiss without remounting or double submission", async (kind) => {
    render("refresh");
    request.mockResolvedValueOnce(response(kind === "partial" ? 500 : 409, {
      error: kind === "busy" ? "SYNC_BUSY" : kind === "superseded" ? "SYNC_SUPERSEDED" : "Failed to sync transactions",
      accountRefreshSucceeded: kind === "partial",
      accountRefreshStatus: kind === "partial" ? "succeeded" : "not_completed",
    }));
    await completeLink();
    expect(button("Add Account").disabled).toBe(true);
    expect(ui.linkToken).toBe("");
    button("Dismiss").onClick!();
    const add = button("Add Account");
    expect(add.disabled).toBe(false);
    let resolveLink!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveLink = resolve; }));
    add.onClick!();
    add.onClick!(); // Same render: the ref must prevent a second POST.
    expect(request).toHaveBeenCalledTimes(2);
    expect(button("Preparing Link...").disabled).toBe(true);
    resolveLink(response(200, { link_token: "synthetic-link-token" }));
    await vi.waitFor(() => expect(render("refresh")).toContain("Adding Account..."));
    expect(ui.linkToken).toBe("synthetic-link-token");
    let resolveSync!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSync = resolve; }));
    const syncing = completeLink();
    await completeLink(); // Repeated Link callback during the request.
    ui.onExit!(null); // Closing Link must not unlock an active sync.
    expect(button("Syncing...").disabled).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
    resolveSync(response(200, { accountRefreshSucceeded: true, accountRefreshStatus: "succeeded", transactionSyncStatus: "synced", addedCount: 0, removedCount: 0, modifiedCount: 0 }));
    await syncing;
    expect(button("Add Account").disabled).toBe(false);
    expect(ui.linkToken).toBe("");
    expect(ui.success).toHaveBeenCalledOnce();
  });

  it.each(["account", "transaction", "transport"])("keeps %s uncertainty blocked until dashboard review, without retry", async (kind) => {
    render("refresh");
    if (kind === "transport") request.mockRejectedValueOnce(new TypeError("Lost response"));
    else request.mockResolvedValueOnce(response(500, kind === "account"
      ? { accountRefreshStatus: "unconfirmed", accountRefreshSucceeded: false }
      : { accountRefreshStatus: "succeeded", accountRefreshSucceeded: true, transactionSyncStatus: "unconfirmed" }));
    await completeLink();
    expect(button("Add Account").disabled).toBe(true);
    button("Add Account").onClick!();
    expect(render("refresh")).not.toContain("Dismiss");
    button("Check dashboard").onClick!();
    expect(ui.push).toHaveBeenCalledWith("/dashboard");
    expect(request).toHaveBeenCalledTimes(1);
    expect(ui.success).not.toHaveBeenCalled();
    expect(ui.refresh).toHaveBeenCalledTimes(kind === "transaction" ? 1 : 0);
  });

  it("preserves the Accounts repair route instead of enabling another refresh", async () => {
    render("refresh");
    request.mockResolvedValueOnce(response(409, { error: "ITEM_LOGIN_REQUIRED", accountRefreshStatus: "not_completed", accountRefreshSucceeded: false }));
    await completeLink();
    expect(button("Add Account").disabled).toBe(true);
    button("Review bank connection").onClick!();
    expect(ui.push).toHaveBeenCalledWith("/accounts");
    expect(ui.refresh).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
