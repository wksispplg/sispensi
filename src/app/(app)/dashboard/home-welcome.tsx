export function HomeWelcome({
  name,
  identifier,
}: {
  name: string;
  identifier: string;
}) {
  return (
    <section
      aria-label="Sambutan pengguna"
      className="hidden min-h-[150px] rounded-[20px] border border-[#1c2832] bg-[#343b41] px-6 py-5 text-white lg:block"
    >
      <p className="text-xs leading-5 font-light text-[#afbdc8]">
        Halo, {identifier}
      </p>
      <h2 className="mt-0.5 text-2xl leading-8 font-medium tracking-tight wrap-anywhere">
        {name}
      </h2>
    </section>
  );
}
