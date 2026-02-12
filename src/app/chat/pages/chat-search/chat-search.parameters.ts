import { ChatSearchCriteria as _ChatSearchCriteria, ChatType } from 'src/app/shared/generated';
import { z, ZodTypeAny } from 'zod';

export const chatSearchCriteriasSchema = z.object({
  type: z
    .string()
    .transform((v) => v as ChatType)
    .optional(),
  topic: z.string().optional(),
  participant: z.string().optional(),
  appId: z.string().optional(),
} satisfies Partial<Record<keyof _ChatSearchCriteria, ZodTypeAny>>);

export type ChatSearchCriteria = z.infer<typeof chatSearchCriteriasSchema>;
