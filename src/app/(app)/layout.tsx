import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, business } = await requireSession();

  return (
    <AppShell role={profile.role} businessName={business.name} userName={profile.full_name}>
      {children}
    </AppShell>
  );
}
