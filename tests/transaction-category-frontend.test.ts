import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const ui = vi.hoisted(() => ({ state: [true, false] as unknown[], index: 0, update: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T,>(initial: T) => {
    const index = ui.index++;
    if (!(index in ui.state)) ui.state[index] = initial;
    return [ui.state[index], (value: T) => { ui.state[index] = value; }];
  },
}));
vi.mock("@/features/transactions/server-actions", () => ({ updateTransactionCategory: ui.update }));
vi.mock("sonner", () => ({ toast: { success: ui.success, error: ui.error } }));
import TransactionDetailPageClient from "@/features/transactions/components/TransactionDetailPageClient";
import EditCategoryComponent from "@/features/transactions/components/EditCategoryComponent";
import type { TransactionDetail } from "@/features/transactions/types";
function handler() {
  const tree = TransactionDetailPageClient({ transaction: { id: "pending", amount: -50, postedDate: "2026-11-01", pending: true } as TransactionDetail, categories: [] });
  type Props = { children?: ReactNode; changeCategory?: (id: string | null) => Promise<void> };
  function find(node: ReactNode): Props["changeCategory"] {
    if (!isValidElement<Props>(node)) return;
    if (node.type === EditCategoryComponent) return node.props.changeCategory;
    for (const child of Children.toArray(node.props.children)) {
      const result = find(child); if (result) return result;
    }
  }
  const result = find(tree); expect(result).toBeDefined(); return result!;
}
beforeEach(() => { vi.resetAllMocks(); ui.state = [true, false]; ui.index = 0; vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
it("shows recovery instructions and retains editor after a zero-row failure", async () => {
  ui.update.mockRejectedValue(new Error("This transaction is no longer available"));
  await handler()(null);
  expect(ui.success).not.toHaveBeenCalled();
  expect(ui.error).toHaveBeenCalledWith(expect.stringContaining("Refresh the transaction list"));
  expect(ui.state).toEqual([true, false]);
});
it("closes editor and reports success after confirmed update", async () => {
  ui.update.mockResolvedValue({ ok: true });
  await handler()("category");
  expect(ui.update).toHaveBeenCalledWith({ transactionId: "pending", categoryId: "category" });
  expect(ui.success).toHaveBeenCalledOnce(); expect(ui.error).not.toHaveBeenCalled();
  expect(ui.state).toEqual([false, false]);
});
