import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeriodTabs } from "@/app/(admin)/admin/_inicio/period-tabs";

describe("PeriodTabs", () => {
  it("marca el período activo con aria-current", () => {
    render(<PeriodTabs query={{ periodo: 30 }} />);
    expect(screen.getByRole("link", { name: "30 días" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "7 días" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "90 días" })).not.toHaveAttribute("aria-current");
  });

  it("30 días enlaza a /admin y los demás llevan ?periodo", () => {
    render(<PeriodTabs query={{ periodo: 7 }} />);
    expect(screen.getByRole("link", { name: "7 días" })).toHaveAttribute("href", "/admin?periodo=7");
    expect(screen.getByRole("link", { name: "30 días" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "90 días" })).toHaveAttribute("href", "/admin?periodo=90");
  });
});
