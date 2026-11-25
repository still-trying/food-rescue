export default function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Adaptive base canvas */}
      <div className="absolute inset-0 bg-[#f4f8f5] transition-colors duration-300 dark:bg-[#08100d]" />

      {/* Atmospheric color wash — emerald, harvest amber, and fresh teal */}
      <div
        className="absolute inset-0 opacity-95 transition-opacity duration-300 dark:opacity-0"
        style={{
          backgroundImage: [
            'radial-gradient(62% 52% at 10% 8%, rgba(167, 243, 208, 0.55) 0%, transparent 72%)',
            'radial-gradient(52% 46% at 92% 12%, rgba(254, 215, 170, 0.5) 0%, transparent 72%)',
            'radial-gradient(56% 52% at 50% 96%, rgba(186, 230, 253, 0.42) 0%, transparent 75%)',
          ].join(', '),
        }}
      />
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 dark:opacity-100"
        style={{
          backgroundImage: [
            'radial-gradient(64% 54% at 12% 10%, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
            'radial-gradient(54% 48% at 90% 14%, rgba(249, 115, 22, 0.13) 0%, transparent 70%)',
            'radial-gradient(58% 52% at 50% 96%, rgba(20, 184, 166, 0.14) 0%, transparent 75%)',
          ].join(', '),
        }}
      />

      {/* Soft architectural grid for subtle depth */}
      <div className="fr-bg-grid absolute inset-0" />

      {/* Subtle shaded 3D spheres */}
      <div className="fr-orb-emerald fr-animate-float absolute -left-24 top-16 h-72 w-72 rounded-full opacity-70 blur-[1px] sm:h-88 sm:w-88 dark:opacity-65" />
      <div className="fr-orb-amber fr-animate-float-reverse absolute -right-20 top-24 h-64 w-64 rounded-full opacity-65 blur-[1px] sm:h-80 sm:w-80 dark:opacity-55" />
      <div className="fr-orb-teal fr-animate-float absolute -bottom-24 left-1/3 hidden h-72 w-72 rounded-full opacity-55 blur-[1px] md:block dark:opacity-50" />
    </div>
  )
}
