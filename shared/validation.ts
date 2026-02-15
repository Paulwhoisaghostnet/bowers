import { z } from "zod";

export const mintRequestSchema = z.object({
  contractId: z.string(),
  tokenName: z.string().min(1, "Token name is required"),
  description: z.string().optional().default(""),
  artifactUri: z.string().url("Must be a valid URI"),
  displayUri: z.string().optional().default(""),
  thumbnailUri: z.string().optional().default(""),
  attributes: z.string().optional().default("[]"),
});

export type MintRequest = z.infer<typeof mintRequestSchema>;
