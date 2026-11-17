import { Suspense } from "react";
import { AccountMenu } from "./account-menu";
import { AdminDrawer } from "./admin-drawer";
import { AdminLogo } from "./admin-sidebar";

export function AdminTopbar() {
  return (
    <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-cms-line pb-5">
      {/* Debajo de lg la barra lateral no se ve: el cajón y el logo ocupan su lugar */}
      <div className="flex items-center gap-1 lg:hidden">
        <AdminDrawer />
        <AdminLogo className="text-cms-ink" />
      </div>
      <div className="ml-auto">
        <Suspense fallback={<div aria-hidden="true" className="h-12 w-48 rounded-full bg-cms-head" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}
