import { ProfileForm } from "@/components/account/profile-form";
import { getAccount } from "@/lib/data/account";
import { formatPhone } from "@/lib/format";

export default async function ProfilePage() {
  const { profile, user } = await getAccount();
  return (
    <div>
      <h1 className="text-3xl font-medium md:text-4xl">Профиль</h1>
      <div className="mt-8">
        <ProfileForm
          email={user.email ?? null}
          defaults={{
            fullName: profile?.full_name ?? "",
            phone: profile?.phone ? formatPhone(profile.phone) : "",
            telegramUsername: profile?.telegram_username ?? "",
          }}
        />
      </div>
    </div>
  );
}
