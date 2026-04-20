import Image from "next/image";

export function PhoneMock() {
  return (
    <div className="relative w-[320px] sm:w-95 md:w-195">
      {/* glow behind phone */}
      <div className="absolute -inset-10 rounded-full bg-accent/10 blur-3xl" />

      {/* screen inside phone (behind the frame) */}
      <div className="absolute left-[10.5%] top-[7.7%] z-5 h-[84.8%] w-[79%] overflow-hidden rounded-[28px]">
        <div className="relative h-full w-full">
          <Image
            src="/app-content.png"
            alt="App screen"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* subtle glass highlight (above the screen) */}
      <div className="pointer-events-none absolute left-[10.5%] top-[7.7%] z-6 h-[84.8%] w-[79%] rounded-[28px] bg-linear-to-b from-white/10 to-transparent opacity-30" />

      {/* phone frame (TOP) */}
      <Image
        src="/app-frame.jpg"
        alt="Phone frame"
        width={900}
        height={1800}
        className="relative z-10 h-auto w-full drop-shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        priority
      />
    </div>
  );
}
