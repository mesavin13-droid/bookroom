import { NotificationPrefs } from "@/components/account/notification-prefs";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/data/account";
import { signOut } from "@/actions/auth";

export default async function SettingsPage() {
  const { profile } = await getAccount();
  return (
    <div className="grid gap-12">
      <section>
        <h1 className="text-3xl font-medium md:text-4xl">Настройки</h1>
        <p className="mt-3 text-muted-foreground">Уведомления в кабинете приходят всегда. Внешние каналы включаются, когда студия их подключит.</p>
        <div className="mt-6 max-w-lg">
          <NotificationPrefs
            initial={{
              notifyEmail: profile?.notify_email ?? true,
              notifySms: profile?.notify_sms ?? false,
              notifyTelegram: profile?.notify_telegram ?? false,
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="text-xl font-medium">Сессия</h2>
        <form action={signOut} className="mt-4">
          <Button variant="outline" type="submit">
            Выйти из аккаунта
          </Button>
        </form>
      </section>
    </div>
  );
}
