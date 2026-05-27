"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { embedFormSchema, type EmbedFormData } from "./schema";

export type SubmitFormResult = {
  data: {
    success: boolean;
  } | null;
  error: string | null;
};

export async function submitEmbedForm(
  formData: EmbedFormData
): Promise<SubmitFormResult> {
  try {
    const validatedData = embedFormSchema.parse(formData);

    console.log("[FormSubmit] Creating form submission for:", validatedData.email);

    await prisma.formSubmission.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        message: validatedData.message ?? null,
        fields: validatedData.fields ?? Prisma.JsonNull,
      },
    });

    console.log("[FormSubmit] Submission saved successfully");

    return {
      data: { success: true },
      error: null,
    };
  } catch (error) {
    console.error("[FormSubmit] Error:", error);

    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: error.errors[0]?.message || "Validation failed",
      };
    }

    return {
      data: null,
      error: "Something went wrong. Please try again.",
    };
  }
}
