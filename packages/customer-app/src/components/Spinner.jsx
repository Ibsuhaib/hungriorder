export default function Spinner({ full = false }) {
  const ring = (
    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/10 border-t-ember-light" />
  );
  if (!full) return ring;
  return <div className="flex min-h-screen items-center justify-center">{ring}</div>;
}
