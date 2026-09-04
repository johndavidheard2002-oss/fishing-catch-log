import { APP_DISPLAY_NAME, APP_SUBTITLE } from "@/lib/brand";

type BrandWordmarkProps = {
  as?: "h1" | "span";
  size: "header" | "home";
};

/** Display name on top, Saltwater Logbook on one nowrap line underneath. */
export function BrandWordmark({ as: Tag = "span", size }: BrandWordmarkProps) {
  const home = size === "home";
  return (
    <Tag
      data-testid={home ? "home-brand" : "header-brand"}
      className={home ? "block text-center" : "block min-w-0"}
    >
      <span
        className={
          home
            ? "block whitespace-nowrap font-display text-4xl leading-[1.05] tracking-tight text-teal sm:text-5xl"
            : "block min-w-0 font-display text-[1.35rem] leading-tight tracking-tight"
        }
      >
        {APP_DISPLAY_NAME}
      </span>
      <span
        className={
          home
            ? "mt-1 block whitespace-nowrap font-display text-xl leading-snug tracking-tight text-teal sm:text-2xl"
            : "block min-w-0 font-body text-[11px] font-normal tracking-wide text-ink-muted uppercase"
        }
      >
        {APP_SUBTITLE}
      </span>
    </Tag>
  );
}
