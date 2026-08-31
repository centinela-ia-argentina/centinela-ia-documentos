import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach
} from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/getUserProfile", () => ({ getUserProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions/roles", () => ({ canUseAi: vi.fn() }));
vi.mock("@/lib/audit/createAuditLog", () => ({ createAuditLog: vi.fn() }));
// Mock the next/navigation redirect to throw an error so we can catch it
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url) => {
    throw new Error("REDIRECT:" + url);
  }),
}));
// Mock AI functions used in copiloto page to avoid extra dependency errors
vi.mock("@/lib/ai/copilotoInmobiliaria", () => ({
  generarBriefingInmobiliaria: vi
    .fn()
    .mockResolvedValue({ ok: true, data: "briefing_mock" }),
  responderPreguntaInmobiliaria: vi
    .fn()
    .mockResolvedValue({ ok: true, data: "pregunta_mock" }),
}));

import {
  getStrictIndustry,
  getStrictIndustryForOrganization,
} from "@/lib/auth/getStrictIndustry";
import { validarAcciones, responderAgenteLegajo } from "@/lib/ai/agente";
import { redactarEscritoIA, revisarEscritoIA } from "@/app/modelos/actions";
import { generarBriefing, preguntarCopiloto } from "@/app/copiloto/actions";
import CopilotoPage from "@/app/copiloto/page";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { createClient } from "@/lib/supabase/server";
import { canUseAi } from "@/lib/permissions/roles";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { redirect } from "next/navigation";

const mockGetUserProfile = getUserProfile as unknown as ReturnType<
  typeof vi.fn
>;
const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockCanUseAi = canUseAi as unknown as ReturnType<typeof vi.fn>;
const mockCreateAuditLog = createAuditLog as unknown as ReturnType<
  typeof vi.fn
>;

describe("AI Industry Guards (Phase 6)", () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanUseAi.mockReturnValue(true);
    process.env.GEMINI_API_KEY = "test_key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"puntuacion": 100, "semaforo": "verde", "acciones": []}',
                },
              ],
            },
          },
        ],
      }),
    });
  });

  afterEach(() => {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const setupMock = (industry: string | null, role: string = "admin") => {
    mockGetUserProfile.mockResolvedValue({
      user: { id: "u1" },
      profile: { organization_id: "org1", role },
    });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: industry ? { industry_type: industry } : null,
              error: industry ? null : { message: "Not found" },
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: industry ? { industry_type: industry } : null,
              error: null,
            }),
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
    return mockSupabase;
  };

  describe("A. PERSONA", () => {
    it("1. Legal produce persona Legal", async () => {
      setupMock("legal");
      await responderAgenteLegajo({
        industry: "legal",
        contextoLegajo: "",
        historial: [],
        pregunta: "x",
      });
      const callArgs = (global.fetch as any).mock.calls[0][1].body;
      expect(callArgs).toContain('Sos \\"Centinela\\", el agente jur');
    });
    it("2. Inmobiliaria produce persona Inmobiliaria", async () => {
      setupMock("inmobiliaria");
      await responderAgenteLegajo({
        industry: "inmobiliaria",
        contextoLegajo: "",
        historial: [],
        pregunta: "x",
      });
      const callArgs = (global.fetch as any).mock.calls[0][1].body;
      expect(callArgs).toContain("el agente inmobiliario");
    });
    it("3. Escribanía produce persona Notarial", async () => {
      setupMock("escribania");
      await responderAgenteLegajo({
        industry: "escribania",
        contextoLegajo: "",
        historial: [],
        pregunta: "x",
      });
      const callArgs = (global.fetch as any).mock.calls[0][1].body;
      expect(callArgs).toContain("el agente notarial");
    });
    it("4. Industria no soportada lanza error, sin fallback", async () => {
      setupMock("medical");
      await expect(
        responderAgenteLegajo({
          industry: "medical" as any,
          contextoLegajo: "",
          historial: [],
          pregunta: "x",
        }),
      ).rejects.toThrow("Invalid or unsupported industry");
    });
  });

  describe("B. REVISIÓN DE ESCRITOS", () => {
    it("5. Legal puede continuar con revisarEscritoIA", async () => {
      setupMock("legal");
      const res = await revisarEscritoIA({
        texto: "Un texto de 40 caracteres para pasar la validación inicial.",
      });
      expect(res).toEqual(expect.objectContaining({ ok: true, revision: expect.objectContaining({ puntuacion: 100, semaforo: "verde" }) }));
      expect(global.fetch).toHaveBeenCalled();
    });
    it("6. Inmobiliaria recibe sin_permiso", async () => {
      setupMock("inmobiliaria");
      const res = await revisarEscritoIA({
        texto: "Un texto de 40 caracteres para pasar la validación inicial.",
      });
      expect((res as any).motivo).toBe("sin_permiso");
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });
    it("7-10. Escribanía e industria desconocida reciben sin_permiso sin llamar API ni Audit", async () => {
      setupMock("escribania");
      let res = await revisarEscritoIA({
        texto: "Un texto de 40 caracteres para pasar la validación inicial.",
      });
      expect((res as any).motivo).toBe("sin_permiso");

      setupMock("unknown");
      res = await revisarEscritoIA({
        texto: "Un texto de 40 caracteres para pasar la validación inicial.",
      });
      expect((res as any).motivo).toBe("sin_permiso");

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("C. MODELO Y PAYLOAD", () => {
    it("11. Org Legal + payload inmobiliaria -> usa persona Legal, audita Legal", async () => {
      setupMock("legal");
      await redactarEscritoIA({
        titulo: "T",
        cuerpo: "C",
        valores: {},
        instruccion: "",
        industria: "inmobiliaria",
      });
      const callArgs = (global.fetch as any).mock.calls[0][1].body;
      // Persona used inside redactarEscritoIA
      expect(callArgs).toContain("asistente jur");

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { entity_id: "T", details: { industria: "legal" } },
        }),
      );
    });
    it("12. Org Inmobiliaria + payload legal -> usa persona Inmobiliaria, audita Inmobiliaria", async () => {
      setupMock("inmobiliaria");
      await redactarEscritoIA({
        titulo: "T",
        cuerpo: "C",
        valores: {},
        instruccion: "",
        industria: "legal",
      });
      const callArgs = (global.fetch as any).mock.calls[0][1].body;
      expect(callArgs).toContain("asesor/a inmobiliario");

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { entity_id: "T", details: { industria: "inmobiliaria" } },
        }),
      );
    });
    it("13. Industria desconocida + API key ausente -> falla por industria primero", async () => {
      setupMock("unknown");
      delete process.env.GEMINI_API_KEY;
      const res = await redactarEscritoIA({
        titulo: "T",
        cuerpo: "C",
        valores: {},
        instruccion: "",
      });
      expect((res as any).motivo).toBe("sin_permiso"); // NOT sin_key
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("D. COPILOTO", () => {
    it("14-15. Inmobiliaria llama al generador y devuelve el contrato", async () => {
      const mockDb = setupMock("inmobiliaria");
      const resB = await generarBriefing();
      expect(resB).toEqual({ ok: true, data: "briefing_mock" });
      expect(mockDb.from).toHaveBeenCalledWith("properties");

      const resP = await preguntarCopiloto("hola");
      expect(resP).toEqual({ ok: true, data: "pregunta_mock" });
    });
    it("16. Legal recibe sin_permiso y no consulta tablas de properties", async () => {
      const mockDb = setupMock("legal");
      const res = await generarBriefing();
      expect((res as any).motivo).toBe("sin_permiso");
      expect(mockDb.from).not.toHaveBeenCalledWith("properties");
      expect(mockDb.from).not.toHaveBeenCalledWith("clients");
      expect(mockDb.from).not.toHaveBeenCalledWith("rental_contracts");
    });
    it("17. Escribanía recibe sin_permiso", async () => {
      const mockDb = setupMock("escribania");
      const res = await preguntarCopiloto("hola");
      expect((res as any).motivo).toBe("sin_permiso");
      expect(mockDb.from).not.toHaveBeenCalledWith("properties");
      expect(mockDb.from).not.toHaveBeenCalledWith("clients");
      expect(mockDb.from).not.toHaveBeenCalledWith("rental_contracts");
    });
    it("18. Sin sesión", async () => {
      const mockDb = setupMock("inmobiliaria");
      mockGetUserProfile.mockResolvedValue({ user: null, profile: null });
      const res = await generarBriefing();
      expect((res as any).motivo).toBe("sin_sesion");
      expect(mockDb.from).not.toHaveBeenCalled();
    });
  });

  describe("E. PÁGINA COPILOTO", () => {
    it("19. Inmobiliaria continúa", async () => {
      setupMock("inmobiliaria");
      const page = await CopilotoPage();
      expect(page).toBeDefined(); // Did not throw redirect
    });
    it("20. Legal redirige antes de consultar", async () => {
      const mockDb = setupMock("legal");
      await expect(CopilotoPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(mockDb.from).not.toHaveBeenCalledWith("properties");
    });
    it("21. Escribanía redirige", async () => {
      const mockDb = setupMock("escribania");
      await expect(CopilotoPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(mockDb.from).not.toHaveBeenCalledWith("properties");
    });
    it("22. Industria desconocida redirige", async () => {
      const mockDb = setupMock("unknown");
      await expect(CopilotoPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(mockDb.from).not.toHaveBeenCalledWith("properties");
    });
    it("23. Rol cliente redirige a acceso-denegado", async () => {
      setupMock("inmobiliaria", "client"); // Role is client
      await expect(CopilotoPage()).rejects.toThrow("REDIRECT:/acceso-denegado");
    });
  });
  describe("F. RUTEO DE REDACTAR BORRADOR (T-AUD-P1-002)", () => {
    it("legal descarta redactar_borrador pero conserva sugerir_modelo", () => {
      const input = [
        { tipo: 'redactar_borrador', titulo: 'Borrador' },
        { tipo: 'sugerir_modelo', titulo: 'Modelo' }
      ];
      const result = validarAcciones(input, 'legal');
      expect(result).not.toContainEqual(expect.objectContaining({ tipo: 'redactar_borrador' }));
      expect(result).toContainEqual(expect.objectContaining({ tipo: 'sugerir_modelo' }));
    });
    
    it("escribania acepta redactar_borrador", () => {
      const input = [{ tipo: 'redactar_borrador', titulo: 'Borrador' }];
      const result = validarAcciones(input, 'escribania');
      expect(result).toContainEqual(expect.objectContaining({ tipo: 'redactar_borrador' }));
    });
    
    it("inmobiliaria acepta redactar_borrador", () => {
      const input = [{ tipo: 'redactar_borrador', titulo: 'Borrador' }];
      const result = validarAcciones(input, 'inmobiliaria');
      expect(result).toContainEqual(expect.objectContaining({ tipo: 'redactar_borrador' }));
    });
    
    it("una industria desconocida no acepta redactar_borrador", () => {
      const input = [{ tipo: 'redactar_borrador', titulo: 'Borrador' }];
      const result = validarAcciones(input, 'general' as any); // general o unknown
      expect(result).not.toContainEqual(expect.objectContaining({ tipo: 'redactar_borrador' }));
    });
  });
});
