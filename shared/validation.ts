import { z } from "zod";

export const mintRequestSchema = z.object({
  contractId: z.string(),
  tokenName: z.string().min(1, "Token name is required"),
  description: z.string().optional().default(""),
  artifactUri: z.string().min(1, "Artifact URI is required"),
  displayUri: z.string().optional().default(""),
  thumbnailUri: z.string().optional().default(""),
  mimeType: z.string().min(1, "Media type is required"),
  editions: z.number().int().min(1).optional().default(1),
  tags: z.array(z.string()).optional().default([]),
  attributes: z.string().optional().default("[]"),
});

export type MintRequest = z.infer<typeof mintRequestSchema>;
