import { z } from "zod";

export const embedFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  message: z.string().optional(),
  fields: z.record(z.string()).optional(),
});

export type EmbedFormData = z.infer<typeof embedFormSchema>;
