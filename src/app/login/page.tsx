import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser, safeNextPath } from "@/server/auth";

export const metadata = { title: "Log in | TypeChaze" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4">
      <AuthForm mode="login" next={next} />
    </div>
  );
}
