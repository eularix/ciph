# API Reference — @ciph/client

## `createClient(config)`

Satu-satunya entry point package ini. Mengembalikan instance client dengan semua method HTTP.

```ts
import { createClient } from "@ciph/client"

export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  secret: import.meta.env.VITE_CIPH_SECRET,
})
```

### Config Options

```ts
interface CiphClientConfig {
  /**
   * Base URL untuk semua request. Wajib.
   * Contoh: "https://api.eularix.com"
   */
  baseURL: string

  /**
   * Shared secret key. Harus sama dengan CIPH_SECRET di backend.
   * Minimum 32 karakter. Diambil dari env var, bukan hardcode.
   */
  secret: string

  /**
   * Opsi fingerprint generation.
   */
  fingerprintOptions?: {
    includeScreen?: boolean      // default: true
    includeTimezone?: boolean    // default: true
    customFields?: Record<string, string>
  }

  /**
   * Aksi saat fingerprint mismatch (CIPH003) setelah retry gagal.
   * - "retry"  : retry sekali dengan fingerprint baru (default)
   * - "throw"  : langsung throw CiphError
   * - "ignore" : lanjut tanpa enkripsi (TIDAK direkomendasikan untuk production)
   */
  onFingerprintMismatch?: "retry" | "throw" | "ignore"

  /**
   * Jika true, fallback ke plain request kalau enkripsi gagal.
   * Default: false. Jangan pakai di production.
   */
  fallbackToPlain?: boolean

  /**
   * Route yang tidak di-encrypt. Bisa exact string atau glob pattern.
   * Default: ["/health"]
   * Contoh: ["/health", "/public/*"]
   */
  excludeRoutes?: string[]

  /**
   * Header default yang ditambahkan ke semua request.
   * Contoh: Authorization token.
   */
  headers?: Record<string, string>
}
```

---

## HTTP Methods

Semua method punya signature identik dengan axios. Return type adalah `Promise<T>` dimana `T` adalah tipe plain response dari server (sudah di-decrypt).

```ts
// GET — tidak ada request body, tetap inject X-Fingerprint
ciph.get<T>(url: string, config?: RequestConfig): Promise<CiphResponse<T>>

// POST, PUT, PATCH — body di-encrypt otomatis
ciph.post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<CiphResponse<T>>
ciph.put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<CiphResponse<T>>
ciph.patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<CiphResponse<T>>

// DELETE — body opsional
ciph.delete<T>(url: string, config?: RequestConfig): Promise<CiphResponse<T>>
```

### `RequestConfig`

Extends konfigurasi axios standar, dengan tambahan:

```ts
interface RequestConfig extends AxiosRequestConfig {
  /**
   * Override encrypt untuk request ini saja.
   * Default: ikut config global.
   */
  encrypt?: boolean

  /**
   * Tambah custom fingerprint fields khusus untuk request ini.
   */
  fingerprintFields?: Record<string, string>
}
```

### `CiphResponse<T>`

```ts
interface CiphResponse<T> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  /** Header Ciph yang dikembalikan server */
  ciph: {
    coinsUsed?: number        // X-Coins-Used (untuk produk Eularix)
    coinsRemaining?: number   // X-Coins-Remaining
    modelUsed?: string        // X-Model-Used
  }
}
```

---

## Contoh Usage Lengkap

### Setup (`lib/ciph.ts`)

```ts
import { createClient } from "@ciph/client"

export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  secret: import.meta.env.VITE_CIPH_SECRET,
  excludeRoutes: ["/health"],
})
```

### Di service layer

```ts
import { ciph } from "@/lib/ciph"

// GET
const listMaterials = async (params?: { page?: number; limit?: number }) => {
  const res = await ciph.get("/materials-list", { params })
  return res.data
}

// POST
const createMaterial = async (payload: CreateMaterialDto) => {
  const res = await ciph.post("/materials", payload)
  return res.data
}

// PATCH
const updateMaterial = async (id: string, payload: UpdateMaterialDto) => {
  const res = await ciph.patch(`/materials/${id}`, payload)
  return res.data
}

// DELETE
const deleteMaterial = async (id: string) => {
  await ciph.delete(`/materials/${id}`)
}
```

### Kombinasi dengan TanStack Query

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Query
export const useMaterials = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ["materials", params],
    queryFn: () => listMaterials(params),
  })

// Mutation
export const useCreateMaterial = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMaterial,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  })
}
```

---

## Error Handling

`@ciph/client` melempar `CiphError` (dari `@ciph/core`) untuk semua error terkait enkripsi. Error HTTP biasa (4xx, 5xx non-Ciph) tetap di-throw sebagai `AxiosError` seperti biasa.

```ts
import { CiphError } from "@ciph/core"
import { isAxiosError } from "axios"

try {
  const res = await ciph.get("/protected-resource")
} catch (err) {
  if (err instanceof CiphError) {
    // Error dari lapisan enkripsi Ciph
    // err.code: "CIPH001" | "CIPH002" | "CIPH003" | "CIPH004" | "CIPH005" | "CIPH006"
  } else if (isAxiosError(err)) {
    // Error HTTP biasa dari server
    // err.response?.status, err.response?.data
  }
}
```

Referensi lengkap error code: lihat `packages/core/ERROR_CODES.md`.
