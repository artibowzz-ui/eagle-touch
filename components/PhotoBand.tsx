import Image from "next/image";

export function PhotoBand() {
  return (
    <section className="px-4 md:px-8">
      <div className="relative mx-auto aspect-[4/5] max-w-[1440px] overflow-hidden rounded-[20px] sm:aspect-[16/9] lg:aspect-[21/9]">
        <Image
          src="https://picsum.photos/seed/eagletouch-friends-walking-fairway/2400/1030"
          alt="Un groupe de golfeurs marche vers le green, l'un d'eux consulte son téléphone"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(8_14_11/0.82)] via-[rgb(8_14_11/0.2)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-[#eef1ec] md:p-12 lg:p-16">
          <h2 className="max-w-[16ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl lg:text-6xl">
            Entre deux trous, un coup d&apos;œil suffit.
          </h2>
          <p className="mt-4 max-w-[44ch] text-[#eef1ec]/85 md:text-lg">
            Les scores se saisissent directement sur le parcours. Le classement se met à jour en temps réel.
          </p>
        </div>
      </div>
    </section>
  );
}
