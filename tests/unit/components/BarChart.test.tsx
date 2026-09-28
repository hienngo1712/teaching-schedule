/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BarChart, type ChartBar } from "@/components/admin/BarChart"

const bar = (key: string, values: Record<string, number>, faded = false): ChartBar => ({
  key,
  label: key,
  ariaLabel: `${key}: ${Object.values(values).join("+")}`,
  faded,
  segments: Object.entries(values).map(([k, v]) => ({ key: k, value: v, className: `bg-${k}` })),
})
const LEGEND = [{ key: "a", label: "A", className: "bg-primary" }]
const seg = (i: number, key: string) =>
  screen.getAllByTestId("chart-bar")[i].querySelector<HTMLElement>(`[data-seg="${key}"]`)?.style.height

describe("BarChart (spec K 8.4)", () => {
  it("stacked: max theo tổng cột; đoạn 0 không vẽ", () => {
    render(<BarChart testId="c" layout="stacked" legend={LEGEND} formatMax={String} emptyText="trống" bars={[bar("m1", { a: 60, b: 40 }), bar("m2", { a: 50, b: 0 })]} />)
    expect(seg(0, "a")).toBe("60%")
    expect(seg(0, "b")).toBe("40%")
    expect(seg(1, "a")).toBe("50%")
    expect(seg(1, "b")).toBeUndefined()
    expect(screen.getByText("100")).toBeTruthy()
  })
  it("grouped: max theo giá trị lớn nhất; cột mờ có data-faded", () => {
    render(<BarChart testId="c" layout="grouped" legend={LEGEND} formatMax={String} emptyText="trống" bars={[bar("d1", { a: 4, b: 2 }), bar("d2", { a: 1, b: 0 }, true)]} />)
    expect(seg(0, "a")).toBe("100%")
    expect(seg(0, "b")).toBe("50%")
    expect(seg(1, "a")).toBe("25%")
    const bars = screen.getAllByTestId("chart-bar")
    expect(bars[1].getAttribute("data-faded")).toBe("true")
    expect(bars[0].getAttribute("data-faded")).toBeNull()
    expect(screen.getByRole("img", { name: "d1: 4+2" })).toBeTruthy()
  })
  it("tất cả 0 → emptyText, không cột", () => {
    render(<BarChart testId="c" layout="grouped" legend={LEGEND} formatMax={String} emptyText="trống" bars={[bar("d1", { a: 0 })]} />)
    expect(screen.getByText("trống")).toBeTruthy()
    expect(screen.queryAllByTestId("chart-bar")).toHaveLength(0)
  })
})
