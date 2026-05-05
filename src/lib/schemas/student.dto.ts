export interface StudentDTO {
  id: number
  userId: number
  fullName: string
  grade: number
  parentPhone: string | null
  parentName: string | null
  notes: string | null
  isActive: boolean
  tuitionFee: number
  createdAt: string | Date
  updatedAt: string | Date
}
