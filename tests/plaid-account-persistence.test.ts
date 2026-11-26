import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountBase } from "plaid";

import { persistPlaidAccounts } from "@/features/plaid/server/persitstPlaidAccounts";

import {
  AccountFencingRejectedError,
  AccountCommitUnconfirmedError,
} from "@/features/plaid/server/rpcCommitOutcome";

vi.mock("server-only", () => ({}));

vi.mock("@/features/plaid/server/errors", () => ({ logPlaidError: vi.fn() }));

const account = {
  account_id: "account-A",
  name: "Checking",
  official_name: null,
  mask: "1234",
  type: "depository",
  subtype: "checking",
  balances: {
    current: 1500,
    available: 1200,
    limit: null,
    iso_currency_code: "CAD",
    unofficial_currency_code: null,
  },
} as AccountBase;

function setup(response: unknown = { data: true, error: null, status: 200 }) {
  const retry = vi.fn().mockResolvedValue(response);
  const rpc = vi.fn().mockReturnValue({ retry });

  const supabase = { rpc } as unknown as SupabaseClient;

  const args = {
    supabase,
    userId: "user-A",
    plaidItemUuid: "item-A",
    leaseToken: "lease-A",
    expectedCursor: "cursor-A",
    snapshotTime: "2026-11-26T12:00:00.000Z",
    accounts: [account],
  };

  return { rpc, retry, args };
}

describe("persistPlaidAccounts", () => {
  it("passes the correct payload and original lease", async () => {
    const { rpc, retry, args } = setup();

    await expect(persistPlaidAccounts(args)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledExactlyOnceWith("commit_plaid_accounts", {
      p_user_id: "user-A",
      p_item_id: "item-A",
      p_lease_token: "lease-A",
      p_expected_cursor: "cursor-A",
      p_snapshot_time: args.snapshotTime,
      p_accounts: [
        {
          plaid_account_id: "account-A",
          name: "Checking",
          official_name: null,
          mask: "1234",
          type: "depository",
          subtype: "checking",
          currency: "CAD",
          current_balance: 1500,
          available_balance: 1200,
        },
      ],
    });

    expect(retry).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("accepts a null expected cursor", async () => {
    const { rpc, args } = setup();

    await persistPlaidAccounts({ ...args, expectedCursor: null });

    expect(rpc).toHaveBeenCalledWith(
      "commit_plaid_accounts",
      expect.objectContaining({ p_expected_cursor: null }),
    );
  });

  it("rejects missing currency before calling RPC", async () => {
    const { rpc, args } = setup();

    await expect(
      persistPlaidAccounts({
        ...args,
        accounts: [
          {
            ...account,
            balances: {
              ...account.balances,
              iso_currency_code: null,
              unofficial_currency_code: null,
            },
          },
        ],
      }),
    ).rejects.toThrow("Plaid account currency is missing");

    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses unofficial currency when ISO currency is absent", async () => {
    const { rpc, args } = setup();

    await persistPlaidAccounts({
      ...args,
      accounts: [
        {
          ...account,
          balances: {
            ...account.balances,
            iso_currency_code: null,
            unofficial_currency_code: "TEST",
          },
        },
      ],
    });

    expect(rpc).toHaveBeenCalledWith(
      "commit_plaid_accounts",
      expect.objectContaining({
        p_accounts: [expect.objectContaining({ currency: "TEST" })],
      }),
    );
  });

  it("classifies false as a fencing rejection", async () => {
    const { args } = setup({ data: false, error: null, status: 200 });

    await expect(persistPlaidAccounts(args)).rejects.toBeInstanceOf(
      AccountFencingRejectedError,
    );
  });

  it("classifies a reviewed PostgreSQL rejection as confirmed", async () => {
    const error = {
      code: "P0001",
      message: "Invalid account payload",
      details: null,
      hint: null,
    };

    const { args } = setup({ data: null, error, status: 400 });

    await expect(persistPlaidAccounts(args)).rejects.toMatchObject({
      name: "Error",
      message: "Atomic Plaid account commit failed",
      cause: error,
    });
  });

  it("classifies a gateway failure as unconfirmed", async () => {
    const { args } = setup({
      data: null,
      error: {
        code: "PGRST000",
        message: "Connection unavailable",
        details: null,
        hint: null,
      },
      status: 503,
    });

    await expect(persistPlaidAccounts(args)).rejects.toBeInstanceOf(
      AccountCommitUnconfirmedError,
    );
  });

  it("does not trust a SQLSTATE with an unexpected HTTP status", async () => {
    const { args } = setup({
      data: null,
      error: {
        code: "P0001",
        message: "Unexpected gateway response",
        details: null,
        hint: null,
      },
      status: 503,
    });

    await expect(persistPlaidAccounts(args)).rejects.toBeInstanceOf(
      AccountCommitUnconfirmedError,
    );
  });

  it("classifies transport exceptions as unconfirmed", async () => {
    const { retry, args } = setup();
    const cause = new Error("Connection lost");

    retry.mockRejectedValueOnce(cause);

    await expect(persistPlaidAccounts(args)).rejects.toMatchObject({
      name: "AccountCommitUnconfirmedError",
      cause,
    });
  });

  it.each([
    ["null", null],
    ["string", "false"],
    ["number", 1],
    ["object", {}],
  ])("rejects an unexpected %s response", async (_, data) => {
    const { args } = setup({ data, error: null, status: 200 });

    await expect(persistPlaidAccounts(args)).rejects.toBeInstanceOf(
      AccountCommitUnconfirmedError,
    );
  });

  it("does not accept true with an unsuccessful HTTP status", async () => {
    const { args } = setup({ data: true, error: null, status: 502 });

    await expect(persistPlaidAccounts(args)).rejects.toBeInstanceOf(
      AccountCommitUnconfirmedError,
    );
  });
});
