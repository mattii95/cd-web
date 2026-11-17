import { Suspense } from "react";
import { AccountMenu } from "./account-menu";

export function AdminTopbar() {
  return (
    <header className="flex min-h-[68px] items-center justify-end gap-3 border-b border-cms-line pb-5">
      <Suspense fallback={<div aria-hidden="true" className="h-12 w-48 rounded-full bg-cms-head" />}>
        <AccountMenu />
      </Suspense>
    </header>
  );
}
