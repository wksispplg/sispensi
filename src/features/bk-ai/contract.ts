import { z } from "zod";

export const ANALYSIS_ENDPOINT = "/api/ai-analysis";
export const ANALYSIS_MAX_ITEMS = 40;

export const analysisSchema = z.object({
  ringkasan_pola: z.string().trim().min(1).max(1800),
  tingkat_risiko: z.enum(["Rendah", "Sedang", "Tinggi"]),
  rekomendasi_bk: z.array(z.string().trim().min(1).max(400)).min(1).max(5),
}).strict();

export const analysisResponseSchema = z.object({
  success: z.literal(true),
  source: z.enum(["gemini", "fallback"]),
  cached: z.boolean(),
  warning: z.string().optional(),
  data: analysisSchema,
  scope: z.object({
    total: z.number().int().nonnegative(),
    analyzed: z.number().int().min(0).max(ANALYSIS_MAX_ITEMS),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export type AnalysisPatterns = {
  total: number;
  analyzed: number;
  from: string | null;
  to: string | null;
  recent30Days: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byWeekday: Record<string, number>;
  byLessonPeriod: Record<string, number>;
  repeatedReasonCounts: number[];
};
