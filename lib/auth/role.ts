import { redirect } from "next/navigation";

export function redirectForRole(role: string | null | undefined): never {
  if (role === "ADMIN") redirect("/admin");
  if (role === "BUSINESS") redirect("/business");
  if (role === "CREATOR") redirect("/creator");
  redirect("/onboarding");
}
