"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitEmbedForm } from "./actions";
import { embedFormSchema, type EmbedFormData } from "./schema";

const TOTAL_STEPS = 3;

export function EmbedFormClient() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [direction, setDirection] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<EmbedFormData>({
    resolver: zodResolver(embedFormSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  const watchedValues = watch();

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return watchedValues.name?.length >= 2;
      case 2:
        return !!watchedValues.email && watchedValues.email.includes("@");
      case 3:
        return true;
      default:
        return false;
    }
  };

  const goToNextStep = async () => {
    const fieldsForStep: Record<number, (keyof EmbedFormData)[]> = {
      1: ["name"],
      2: ["email"],
      3: ["message"],
    };
    const isValid = await trigger(fieldsForStep[currentStep] || []);
    if (!isValid) return;

    if (currentStep < TOTAL_STEPS) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const onSubmit = async (data: EmbedFormData) => {
    setIsSubmitting(true);

    const result = await submitEmbedForm(data);

    setIsSubmitting(false);

    if (result.error) {
      return;
    }

    setIsSubmitted(true);
  };

  const slideVariants = {
    enter: (dir: number) => ({ y: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (dir: number) => ({ y: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  if (isSubmitted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F7F7F7] p-6">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-8 flex size-20 items-center justify-center rounded-2xl bg-[#2E2E2E]"
          >
            <svg
              className="size-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </motion.div>
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-4 text-3xl font-semibold text-[#2E2E2E]"
          >
            Thank you!
          </motion.h2>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-[#2E2E2E]/60"
          >
            Your submission has been received. We&apos;ll be in touch soon.
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-[#F7F7F7]">
      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-[#E5E5E5]">
        <motion.div
          className="h-full bg-[#2E2E2E]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="absolute right-6 top-6 z-10">
        <span className="text-sm font-medium text-[#2E2E2E]/40">
          {progressPercent}% completed
        </span>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex h-full flex-1 items-center justify-center px-6 py-20"
        onKeyDown={(e) => {
          if (e.key === "Enter" && currentStep === TOTAL_STEPS) {
            e.preventDefault();
            if (canProceed()) {
              handleSubmit(onSubmit)();
            }
          }
        }}
      >
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            {currentStep === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">
                  1 / {TOTAL_STEPS}
                </p>
                <h2 className="mb-8 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  What&apos;s your name?
                </h2>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Type your full name..."
                  autoFocus
                  autoComplete="name"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-lg text-[#2E2E2E] placeholder-[#2E2E2E]/30 outline-none transition-colors focus:border-[#2E2E2E]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed()) {
                      e.preventDefault();
                      goToNextStep();
                    }
                  }}
                />
                {errors.name && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 mt-3 text-sm"
                  >
                    {errors.name.message}
                  </motion.p>
                )}
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">
                  2 / {TOTAL_STEPS}
                </p>
                <h2 className="mb-8 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  What&apos;s your email?
                </h2>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@example.com"
                  autoFocus
                  autoComplete="email"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-lg text-[#2E2E2E] placeholder-[#2E2E2E]/30 outline-none transition-colors focus:border-[#2E2E2E]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed()) {
                      e.preventDefault();
                      goToNextStep();
                    }
                  }}
                />
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 mt-3 text-sm"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">
                  3 / {TOTAL_STEPS}
                </p>
                <h2 className="mb-8 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  Anything else you&apos;d like to share?
                </h2>
                <textarea
                  {...register("message")}
                  placeholder="Type your message... (optional)"
                  rows={4}
                  autoFocus
                  className="w-full resize-none rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-lg text-[#2E2E2E] placeholder-[#2E2E2E]/30 outline-none transition-colors focus:border-[#2E2E2E]"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex items-center gap-3"
          >
            {currentStep > 1 && (
              <motion.button
                type="button"
                tabIndex={-1}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 py-2.5 text-sm font-medium text-[#2E2E2E] transition-all hover:border-[#2E2E2E]/30"
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </motion.button>
            )}

            {currentStep === TOTAL_STEPS ? (
              <motion.button
                type="submit"
                whileHover={{ scale: !isSubmitting ? 1.02 : 1 }}
                whileTap={{ scale: !isSubmitting ? 0.98 : 1 }}
                disabled={isSubmitting}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                  !isSubmitting
                    ? "bg-[#2E2E2E] text-white hover:bg-[#1a1a1a]"
                    : "cursor-not-allowed bg-[#E5E5E5] text-[#2E2E2E]/40"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="size-4 rounded-full border-2 border-white/20 border-t-white"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit
                    <svg
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </>
                )}
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: canProceed() ? 1.02 : 1 }}
                whileTap={{ scale: canProceed() ? 0.98 : 1 }}
                onClick={goToNextStep}
                disabled={!canProceed()}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                  canProceed()
                    ? "bg-[#2E2E2E] text-white hover:bg-[#1a1a1a]"
                    : "cursor-not-allowed bg-[#E5E5E5] text-[#2E2E2E]/40"
                }`}
              >
                OK
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.button>
            )}

            <span className="text-xs text-[#2E2E2E]/40">
              press <strong>Enter</strong>
            </span>
          </motion.div>
        </div>
      </form>
    </div>
  );
}
