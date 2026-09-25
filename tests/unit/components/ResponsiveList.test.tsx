/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"

type Row = { id: number; name: string }
const columns: Column<Row>[] = [{ header: "Tên", cell: (r) => r.name }]
const base = {
  getKey: (r: Row) => r.id,
  columns,
  renderCard: (r: Row) => <div>card-{r.name}</div>,
  emptyText: "Trống",
  errorText: "Lỗi tải",
  retryText: "Thử lại",
}

describe("ResponsiveList", () => {
  it("loading → skeleton, không hiện dữ liệu", () => {
    render(<ResponsiveList {...base} items={[]} isLoading isError={false} />)
    expect(screen.getAllByTestId("list-skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText("Trống")).toBeNull()
  })

  it("rỗng → hiện emptyText", () => {
    render(<ResponsiveList {...base} items={[]} isLoading={false} isError={false} />)
    expect(screen.getByText("Trống")).toBeTruthy()
  })

  it("lỗi → hiện errorText và nút thử lại gọi onRetry", () => {
    const onRetry = vi.fn()
    render(<ResponsiveList {...base} items={[]} isLoading={false} isError onRetry={onRetry} />)
    expect(screen.getByText("Lỗi tải")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("có dữ liệu → render cả hàng bảng và thẻ (CSS quyết định cái nào hiện)", () => {
    const onRowClick = vi.fn()
    render(
      <ResponsiveList {...base} items={[{ id: 1, name: "An" }]} isLoading={false} isError={false} onRowClick={onRowClick} />
    )
    expect(screen.getByRole("cell", { name: "An" })).toBeTruthy()
    expect(screen.getByText("card-An")).toBeTruthy()
    fireEvent.click(screen.getByRole("cell", { name: "An" }))
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: "An" })
  })
})
