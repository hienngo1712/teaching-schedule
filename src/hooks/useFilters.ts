import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

export function useFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedGrade = useMemo(() => {
    const grade = searchParams.get("grade")
    return grade ? parseInt(grade, 10) : null
  }, [searchParams])

  const toYear = useMemo(() => {
    const y = searchParams.get("toYear")
    return y ? parseInt(y, 10) : null
  }, [searchParams])

  const toMonth = useMemo(() => {
    const m = searchParams.get("toMonth")
    return m ? parseInt(m, 10) : null
  }, [searchParams])

  const filterType = useMemo(() => {
    return searchParams.get("type") || "month"
  }, [searchParams])

  const searchStudentName = useMemo(() => {
    return searchParams.get("studentName") || ""
  }, [searchParams])

  const selectedStudentId = useMemo(() => {
    const id = searchParams.get("studentId")
    return id ? parseInt(id, 10) : null
  }, [searchParams])

  const selectedStatus = useMemo(() => {
    return searchParams.get("status") || "all"
  }, [searchParams])

  const createQueryString = useCallback(
    (params: Record<string, string | number | null>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "") {
          newSearchParams.delete(key)
        } else {
          newSearchParams.set(key, String(value))
        }
      }

      return newSearchParams.toString()
    },
    [searchParams]
  )

  const setGrade = useCallback(
    (grade: number | null) => {
      const queryString = createQueryString({ 
        grade, 
        studentId: null 
      })
      router.push(`${pathname}?${queryString}`)
    },
    [router, pathname, createQueryString]
  )

  const setStatus = useCallback(
    (status: string | null) => {
      const queryString = createQueryString({ 
        status: status === "all" ? null : status,
        studentId: null 
      })
      router.push(`${pathname}?${queryString}`)
    },
    [router, pathname, createQueryString]
  )

  const setSearch = useCallback(
    (name: string) => {
      const queryString = createQueryString({ 
        studentName: name, 
        studentId: null 
      })
      router.push(`${pathname}?${queryString}`)
    },
    [router, pathname, createQueryString]
  )

  const setStudentId = useCallback(
    // replace=true: dùng khi đóng sheet để không tạo thêm entry lịch sử — bấm Back
    // không quay lại được URL còn studentId (mở sheet lại ngoài ý muốn).
    (id: number | null, options?: { replace?: boolean }) => {
      const queryString = createQueryString({
        studentId: id
      })
      const url = `${pathname}?${queryString}`
      if (options?.replace) router.replace(url)
      else router.push(url)
    },
    [router, pathname, createQueryString]
  )

  const setRange = useCallback(
    (params: { year?: number; month?: number; toYear?: number | null; toMonth?: number | null; type?: string }) => {
      const queryString = createQueryString({
        ...params,
        studentId: null
      })
      router.push(`${pathname}?${queryString}`)
    },
    [router, pathname, createQueryString]
  )

  const resetFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const filterParams = useMemo(() => {
    return {
      grade: selectedGrade || undefined,
      studentName: searchStudentName || undefined,
      studentId: selectedStudentId || undefined,
      status: selectedStatus || undefined,
    }
  }, [selectedGrade, searchStudentName, selectedStudentId, selectedStatus])

  const hasActiveFilter = useMemo(() => {
    return selectedGrade !== null || searchStudentName !== "" || selectedStudentId !== null || selectedStatus !== "all"
  }, [selectedGrade, searchStudentName, selectedStudentId, selectedStatus])

  return {
    selectedGrade,
    searchStudentName,
    selectedStudentId,
    selectedStatus,
    setGrade,
    setSearch,
    setStudentId,
    setStatus,
    resetFilters,
    filterParams,
    hasActiveFilter,
    toYear,
    toMonth,
    filterType,
    setRange,
  }
}
