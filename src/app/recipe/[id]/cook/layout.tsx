export default function CookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout overrides parent padding for true fullscreen
  return (
    <div className="fixed inset-0 z-50">
      {children}
    </div>
  );
}
