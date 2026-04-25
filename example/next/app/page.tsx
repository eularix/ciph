"use client"

import { useCiph } from "./client-provider"
import { useState, useEffect } from "react"

interface Employee {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  joined: string
  status: "active" | "inactive"
}

interface ApiResponse {
  received?: { message: string; timestamp: string }
  message?: string
  timestamp?: string
  error?: string
}

export default function Home() {
  const ciph = useCiph()
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [empError, setEmpError] = useState<string | null>(null)

  const testCiph = async () => {
    setLoading(true)
    setResponse(null)
    setStatus("idle")
    try {
      const res = await ciph.post<ApiResponse>("/api/echo", {
        message: "Hello from Ciph + Next.js!",
        timestamp: new Date().toISOString(),
      })
      setResponse(res.data)
      setStatus("success")
    } catch (error) {
      setResponse({ error: (error as Error).message || "Request failed" })
      setStatus("error")
    }
    setLoading(false)
  }

  const fetchEmployees = async () => {
    setEmpLoading(true)
    setEmpError(null)
    try {
      const res = await ciph.get<{ data: Employee[]; total: number }>("/api/employees")
      setEmployees(res.data.data)
    } catch (error) {
      setEmpError((error as Error).message || "Failed to fetch employees")
    }
    setEmpLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setEmpLoading(true)
      setEmpError(null)
      try {
        const res = await ciph.get<{ data: Employee[]; total: number }>("/api/employees")
        if (!cancelled) setEmployees(res.data.data)
      } catch (error) {
        if (!cancelled) setEmpError((error as Error).message || "Failed to fetch employees")
      }
      if (!cancelled) setEmpLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [ciph])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-4">Ciph + Next.js</h1>
          <p className="text-xl text-slate-300">
            Transparent HTTP encryption with automatic request/response decryption
          </p>
        </div>

        {/* Echo Test Section */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 mb-8">
          <h2 className="text-2xl font-bold mb-6">Test Encrypted Echo</h2>
          <p className="text-slate-300 mb-6">
            Click to send an encrypted POST request to the backend. Body is AES-256-GCM encrypted — plain
            text never touches the network.
          </p>
          <button
            onClick={testCiph}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-6 py-3 rounded-lg font-semibold transition mb-6"
          >
            {loading ? "Encrypting & sending…" : "Test Ciph → POST /api/echo"}
          </button>

          {response && (
            <div
              className={`p-6 rounded-lg border ${
                status === "error"
                  ? "bg-red-900/20 border-red-700 text-red-300"
                  : "bg-green-900/20 border-green-700 text-green-300"
              }`}
            >
              <p className="font-bold mb-3">
                {status === "error"
                  ? "❌ Error"
                  : "✅ Response received (decrypted by @ciph/react)"}
              </p>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Employees Table Section */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Employees <span className="text-slate-400 text-lg font-normal">GET /api/employees (encrypted)</span>
            </h2>
            <button
              onClick={fetchEmployees}
              disabled={empLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 px-4 py-2 rounded font-semibold transition"
            >
              {empLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {empError && <p className="text-red-400 mb-4">{empError}</p>}

          {!empLoading && employees.length > 0 && (
            <div className="overflow-x-auto border border-slate-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Dept</th>
                    <th className="px-4 py-3 text-left font-semibold">Salary</th>
                    <th className="px-4 py-3 text-left font-semibold">Joined</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr
                      key={emp.id}
                      className={`border-b border-slate-700 ${i % 2 === 0 ? "bg-slate-800" : "bg-slate-750"}`}
                    >
                      <td className="px-4 py-3 text-slate-400">{emp.id}</td>
                      <td className="px-4 py-3 font-semibold">{emp.name}</td>
                      <td className="px-4 py-3 text-slate-300">{emp.role}</td>
                      <td className="px-4 py-3 text-slate-300">{emp.dept}</td>
                      <td className="px-4 py-3 text-slate-300">${emp.salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-400">{emp.joined}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            emp.status === "active"
                              ? "bg-green-900 text-green-200"
                              : "bg-slate-600 text-slate-300"
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {empLoading && (
            <div className="text-center text-slate-400 py-8">Loading encrypted data…</div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-700 text-sm text-slate-300">
          <h3 className="font-bold mb-3 text-white">🔐 How Ciph Works:</h3>
          <ul className="space-y-2 list-disc list-inside">
            <li>All requests/responses encrypted with AES-256-GCM</li>
            <li>Fingerprint validation ensures device-specific encryption</li>
            <li>Open DevTools Network tab to see ciphertext (not readable)</li>
            <li>No manual encrypt/decrypt in app code — fully transparent</li>
            <li>v1 symmetric mode using shared secret (CIPH_SECRET)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
