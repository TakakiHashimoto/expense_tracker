import "server-only";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import {
  logPlaidError,
  type PlaidOperation,
} from "@/features/plaid/server/errors";

/** Prevent unexpected provider errors reaching Next's raw exception logger. */
export function withPlaidErrorBoundary<Args extends unknown[]>(
  operation: PlaidOperation,
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      unstable_rethrow(error);
      logPlaidError(operation, error);
      return NextResponse.json(
        { error: "Bank connection request failed" },
        { status: 500 },
      );
    }
  };
}
