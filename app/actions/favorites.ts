"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addFavorite(serviceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, service_id: serviceId });
  if (error) return { error: error.message };
  revalidatePath("/services");
  revalidatePath("/saved");
  return {};
}

export async function removeFavorite(serviceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("service_id", serviceId);
  if (error) return { error: error.message };
  revalidatePath("/services");
  revalidatePath("/saved");
  return {};
}
