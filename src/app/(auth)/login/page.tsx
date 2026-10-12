import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; redirectedFrom?: string }>;
}) {
  const { as, redirectedFrom } = await searchParams;
  return <LoginForm as={as} next={redirectedFrom} />;
}
