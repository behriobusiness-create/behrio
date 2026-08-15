import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Benefits } from "@/components/landing/benefits";
import { CreatorSection } from "@/components/landing/creator-section";
import { Trust } from "@/components/landing/trust";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") redirect("/admin");
    if (user.role === "BUSINESS") redirect("/business");
    if (user.role === "CREATOR") redirect("/creator");
    redirect("/onboarding");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-bg">
      <Navbar />
      <Hero />
      <Problem />
      <HowItWorks />
      <Benefits />
      <CreatorSection />
      <Trust />
      <FinalCta />
      <Footer />
    </main>
  );
}