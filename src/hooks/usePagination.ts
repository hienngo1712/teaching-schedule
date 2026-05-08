"use client"

import { useState, useMemo, useEffect } from "react"

export function usePagination<T>(data: T[] | undefined, initialPageSize: number = 5) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Reset to page 1 when data length changes (e.g. after filtering)
  useEffect(() => {
    setCurrentPage(1)
  }, [data?.length])

  const paginatedData = useMemo(() => {
    if (!data) return []
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return data.slice(start, end)
  }, [data, currentPage, pageSize])

  const totalItems = data?.length || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalItems,
    totalPages,
  }
}
