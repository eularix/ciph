import { ciphHandler } from "@ciph/nextjs/server"
import { NextResponse } from "next/server"

interface Employee {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  joined: string
  status: "active" | "inactive"
}

const EMPLOYEES: Employee[] = [
  { id: 1, name: "Dimas Maulana", role: "Lead Engineer", dept: "Engineering", salary: 120000, joined: "2022-01-15", status: "active" },
  { id: 2, name: "John Smith", role: "Backend Dev", dept: "Engineering", salary: 95000, joined: "2022-03-10", status: "active" },
  { id: 3, name: "Sarah Lee", role: "Product Manager", dept: "Product", salary: 110000, joined: "2021-08-20", status: "active" },
  { id: 4, name: "Ali Hassan", role: "DevOps Engineer", dept: "Infrastructure", salary: 105000, joined: "2023-02-01", status: "active" },
  { id: 5, name: "Maria Garcia", role: "UX Designer", dept: "Design", salary: 90000, joined: "2022-07-14", status: "active" },
  { id: 6, name: "Tom Chen", role: "Data Analyst", dept: "Analytics", salary: 85000, joined: "2023-05-22", status: "active" },
  { id: 7, name: "Nina Patel", role: "Frontend Dev", dept: "Engineering", salary: 92000, joined: "2021-11-03", status: "inactive" },
  { id: 8, name: "Lucas Müller", role: "Security Engineer", dept: "Security", salary: 115000, joined: "2020-09-18", status: "active" },
]

export const GET = ciphHandler({
  privateKey: process.env.CIPH_PRIVATE_KEY,
})(async (req, ctx) => {
  return NextResponse.json({ data: EMPLOYEES, total: EMPLOYEES.length })
})
