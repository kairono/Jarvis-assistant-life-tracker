import { Icon } from './Icon';

// ------------------------------------------------------------------ //
//  visionOS-style app icon: a round, layered glass disc with a bright  //
//  gradient, a specular highlight on top and a white glyph.            //
// ------------------------------------------------------------------ //

export function AppIcon({
  icon,
  colors,
  size = 44,
  active = false,
}: {
  icon: string;
  colors: [string, string];
  size?: number;
  active?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full transition duration-200 ${
        active ? 'scale-105' : ''
      }`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
        boxShadow: [
          'inset 0 1.5px 0 rgb(255 255 255 / 0.45)',
          'inset 0 -6px 12px rgb(0 0 0 / 0.18)',
          `0 ${size / 6}px ${size / 2.5}px -${size / 6}px ${colors[1]}`,
          active ? '0 0 0 2.5px rgb(255 255 255 / 0.85)' : '0 0 0 1px rgb(255 255 255 / 0.18)',
        ].join(', '),
      }}
    >
      {/* specular highlight */}
      <span
        className="pointer-events-none absolute inset-x-[14%] top-[6%] h-[42%] rounded-full"
        style={{ background: 'linear-gradient(180deg, rgb(255 255 255 / 0.42), rgb(255 255 255 / 0))' }}
      />
      <Icon
        name={icon}
        size={Math.round(size * 0.46)}
        strokeWidth={2.1}
        className="relative text-white drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.25)]"
      />
    </span>
  );
}
