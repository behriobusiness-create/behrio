import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import SetPasswordForm from "@/components/set-password-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const hasPassword = user.passwordHash != null;

  return (
    <main dir="rtl" className="min-h-screen bg-bg px-5 py-10">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-fg">تنظیمات</h1>
        <p className="mt-1 text-sm text-muted">
          {hasPassword
            ? "رمز عبور فعلی خود را تغییر دهید."
            : "رمز عبور بسازید تا با ایمیل و رمز وارد شوید."}
        </p>

        <div className="mt-6">
          <Card>
            <h2 className="text-lg font-semibold text-fg">
              رمز عبور
            </h2>
            <div className="mt-4">
              <SetPasswordForm />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
