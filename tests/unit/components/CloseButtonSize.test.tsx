/**
 * @vitest-environment jsdom
 */
// Spec AR A3: nút X mặc định của Dialog/Sheet có vùng chạm 44px trên điện thoại, icon vẫn 16px.
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

function expectTouchSize(btn: HTMLElement) {
  for (const c of ["size-11", "md:size-9", "flex", "items-center", "justify-center"]) expect(btn.className).toContain(c)
  expect(btn.querySelector("svg")!.getAttribute("class")).toContain("h-4 w-4")
}

describe("nút đóng Dialog/Sheet", () => {
  it("DialogContent", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Tiêu đề</DialogTitle>
          <DialogDescription>Mô tả</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    expectTouchSize(screen.getByRole("button", { name: "Close" }))
  })

  it("SheetContent", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Tiêu đề</SheetTitle>
          <SheetDescription>Mô tả</SheetDescription>
        </SheetContent>
      </Sheet>
    )
    expectTouchSize(screen.getByRole("button", { name: "Close" }))
  })
})
