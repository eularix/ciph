export type Status = 'idle' | 'success' | 'error'

export type ApiResponse = 
  | { received?: { message: string; timestamp: string } }
  | { message?: string; timestamp?: string }
  | { error?: string }

export type Employee = {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  joined: string
  status: 'active' | 'inactive'
}
