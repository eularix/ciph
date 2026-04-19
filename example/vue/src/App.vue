<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCiph } from '@ciph/vue'
import vueLogo from './assets/vue.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'

const ciph = useCiph()

// ─── Echo ─────────────────────────────────────────────────────────────────────

type ApiResponse = {
  received?: { message: string; timestamp: string }
  message?: string
  timestamp?: string
  error?: string
}

const echoResponse = ref<ApiResponse | null>(null)
const echoLoading = ref(false)
const echoStatus = ref<'idle' | 'success' | 'error'>('idle')

async function testCiph(): Promise<void> {
  echoLoading.value = true
  echoResponse.value = null
  echoStatus.value = 'idle'
  try {
    const res = await ciph.post<ApiResponse>('/api/echo', {
      message: 'Hello from Ciph v2 (ECDH)!',
      timestamp: new Date().toISOString(),
    })
    echoResponse.value = res.data
    echoStatus.value = 'success'
  } catch (err) {
    echoResponse.value = { error: (err as Error).message || 'Request failed' }
    echoStatus.value = 'error'
  }
  echoLoading.value = false
}

// ─── Employees ────────────────────────────────────────────────────────────────

type Employee = {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  joined: string
  status: 'active' | 'inactive'
}

const employees = ref<Employee[]>([])
const empLoading = ref(false)
const empError = ref<string | null>(null)

async function fetchEmployees(): Promise<void> {
  empLoading.value = true
  empError.value = null
  try {
    const res = await ciph.get<{ data: Employee[]; total: number }>('/api/employees')
    employees.value = res.data.data
  } catch (err) {
    empError.value = (err as Error).message || 'Failed to fetch employees'
  }
  empLoading.value = false
}

onMounted(fetchEmployees)
</script>

<template>
  <section id="center">
    <div class="hero">
      <img :src="heroImg" class="base" width="170" height="179" alt="" />
      <img :src="vueLogo" class="framework" alt="Vue logo" />
      <img :src="viteLogo" class="vite" alt="Vite logo" />
    </div>

    <div style="text-align: center">
      <h1>Ciph Example</h1>
      <p style="color: var(--text-2); margin-bottom: 24px">
        Click the button to send an encrypted POST request to the backend.<br />
        Body is AES-256-GCM encrypted — plain text never touches the network.
      </p>
      <button class="counter" :disabled="echoLoading" @click="testCiph">
        {{ echoLoading ? 'Encrypting & sending…' : 'Test Ciph → POST /api/echo' }}
      </button>
    </div>

    <div
      v-if="echoResponse"
      :style="{
        width: '100%',
        maxWidth: '520px',
        padding: '20px 24px',
        background: echoStatus === 'error' ? '#fff1f2' : '#f0fdf4',
        border: `1px solid ${echoStatus === 'error' ? '#fecdd3' : '#bbf7d0'}`,
        borderRadius: '10px',
        textAlign: 'left',
      }"
    >
      <p
        :style="{
          margin: '0 0 12px',
          fontWeight: 600,
          fontSize: '14px',
          color: echoStatus === 'error' ? '#dc2626' : '#16a34a',
        }"
      >
        {{
          echoStatus === 'error'
            ? '❌ Error'
            : '✅ Response received (decrypted by @ciph/vue — ECDH v2)'
        }}
      </p>
      <pre style="margin: 0; fontSize: 13px; lineHeight: 1.6; overflowX: auto; color: #111827; background: transparent">{{
        JSON.stringify(echoResponse, null, 2)
      }}</pre>
    </div>

    <!-- Employees table -->
    <div style="width: 100%; max-width: 860px; margin-top: 32px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
        <h2 style="margin: 0; font-size: 16px; font-weight: 600">
          Employees
          <span style="color: var(--text-2); font-weight: 400; font-size: 13px">
            GET /api/employees (encrypted)
          </span>
        </h2>
        <button
          :disabled="empLoading"
          style="padding: 5px 12px; font-size: 12px; cursor: pointer; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff"
          @click="fetchEmployees"
        >
          {{ empLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <p v-if="empError" style="color: #dc2626; font-size: 13px; margin-bottom: 8px">{{ empError }}</p>

      <div
        v-if="!empLoading && employees.length > 0"
        style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden"
      >
        <table style="width: 100%; border-collapse: collapse; font-size: 13px">
          <thead>
            <tr style="background: #f9fafb">
              <th
                v-for="col in ['ID', 'Name', 'Role', 'Dept', 'Salary', 'Joined', 'Status']"
                :key="col"
                style="padding: 10px 14px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; white-space: nowrap"
              >{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(emp, i) in employees"
              :key="emp.id"
              :style="{ background: i % 2 === 0 ? '#fff' : '#fafafa' }"
            >
              <td style="padding: 9px 14px; color: #6b7280">{{ emp.id }}</td>
              <td style="padding: 9px 14px; font-weight: 500; color: #111827">{{ emp.name }}</td>
              <td style="padding: 9px 14px; color: #374151">{{ emp.role }}</td>
              <td style="padding: 9px 14px; color: #374151">{{ emp.dept }}</td>
              <td style="padding: 9px 14px; color: #374151">${{ emp.salary.toLocaleString() }}</td>
              <td style="padding: 9px 14px; color: #6b7280">{{ emp.joined }}</td>
              <td style="padding: 9px 14px">
                <span
                  :style="{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: emp.status === 'active' ? '#dcfce7' : '#f3f4f6',
                    color: emp.status === 'active' ? '#16a34a' : '#6b7280',
                  }"
                >{{ emp.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        v-if="empLoading"
        style="text-align: center; color: var(--text-2); font-size: 13px; padding: 20px 0"
      >
        Loading encrypted data…
      </p>
    </div>
  </section>

  <div class="ticks" />

  <section id="next-steps">
    <div id="docs">
      <svg class="icon" role="presentation" aria-hidden="true">
        <use href="/icons.svg#documentation-icon" />
      </svg>
      <h2>Debug</h2>
      <p>Use Ciph devtools to inspect encrypted traffic in plain text.</p>
      <ul>
        <li>
          <a href="http://localhost:4321" target="_blank" rel="noopener noreferrer">
            Backend Inspector (port 4321)
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
