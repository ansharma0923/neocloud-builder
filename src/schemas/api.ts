import { z } from 'zod';

export const CreateChatSchema = z.object({
  title: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const UpdateChatSchema = z.object({
  title: z.string().min(1).max(200),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(100000),
  attachmentIds: z.array(z.string()).optional(),
});

export const GenerateArtifactSchema = z.object({
  type: z.enum(['summary', 'report', 'bom', 'cost_sheet', 'diagram_spec', 'generated_image', 'export_package', 'plantuml']),
  style: z.string().optional(),
});

export const MutatePlanSchema = z.object({
  instruction: z.string().min(1),
  messageId: z.string().optional(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
