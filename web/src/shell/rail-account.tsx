import { useAppContext } from "./app-context";

export function RailAccountFooter() {
  const { user } = useAppContext();
  const email = user?.email;
  if (!email) {
    return null;
  }

  return (
    <div className="epure-rail-footer mt-auto hidden lg:block">
      <p className="epure-rail-account-email truncate" title={email}>
        {email}
      </p>
    </div>
  );
}
