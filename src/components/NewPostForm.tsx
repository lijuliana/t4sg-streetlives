"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FormValues {
  content: string;
}

const MAX_CHARS = 500;

export default function NewPostForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { content: "" } });

  const content = watch("content");
  const charsLeft = MAX_CHARS - (content?.length ?? 0);

  const onSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    toast.success("Post created!");
    router.push("/feed");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <textarea
          {...register("content", {
            required: "Post content is required",
            maxLength: {
              value: MAX_CHARS,
              message: `Max ${MAX_CHARS} characters`,
            },
          })}
          placeholder="Share something with the community…"
          rows={6}
          className={cn(
            "w-full rounded-md border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition",
            errors.content ? "border-red-400" : "border-gray-300"
          )}
        />
        <div className="flex items-center justify-between mt-1">
          {errors.content ? (
            <p className="text-xs text-red-500">{errors.content.message}</p>
          ) : (
            <span />
          )}
          <p
            className={cn(
              "text-xs ml-auto",
              charsLeft < 50 ? "text-red-400" : "text-gray-400"
            )}
          >
            {charsLeft} left
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-brand-yellow text-gray-900 font-medium py-3 rounded-md hover:brightness-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
