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

  const searchStudentName = useMemo(() => {
    return searchParams.get("studentName") || ""
  }, [searchParams])

  const selectedStudentId = useMemo(() => {
    const id = searchParams.get("studentId")
    return id ? parseInt(id, 10) : null
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
    (id: number | null) => {
      const queryString = createQueryString({ 
        studentId: id 
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
    }
  }, [selectedGrade, searchStudentName, selectedStudentId])

  const hasActiveFilter = useMemo(() => {
    return selectedGrade !== null || searchStudentName !== "" || selectedStudentId !== null
  }, [selectedGrade, searchStudentName, selectedStudentId])

  return {
    selectedGrade,
    searchStudentName,
    selectedStudentId,
    setGrade,
    setSearch,
    setStudentId,
    resetFilters,
    filterParams,
    hasActiveFilter,
  }
}
