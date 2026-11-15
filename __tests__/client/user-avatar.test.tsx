import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/components/auth/user-avatar";

const PHOTO = "https://avatars.githubusercontent.com/u/1?v=4";

describe("UserAvatar", () => {
  it("con foto muestra la imagen decorativa", () => {
    const { container } = render(<UserAvatar name="Ana Pérez" image={PHOTO} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img?.getAttribute("src")).toContain(encodeURIComponent(PHOTO));
  });

  it("sin foto muestra la inicial", () => {
    const { container } = render(<UserAvatar name="  ana pérez" image={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("A");
  });

  it("si la imagen falla al cargar cae a la inicial", () => {
    const { container } = render(<UserAvatar name="Ana Pérez" image={PHOTO} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
