type BrandWordmarkProps = {
  as?: "h1" | "span";
  size: "header" | "home";
};

/** Catch Compass + Saltwater Logbook on one row, beside the logo in the header. */
export function BrandWordmark({ as: Tag = "span", size }: BrandWordmarkProps) {
  const home = size === "home";
  return (
    <Tag
      data-testid={home ? "home-brand" : "header-brand"}
      className={
        home
          ? "flex items-baseline gap-2 whitespace-nowrap"
          : "flex min-w-0 items-baseline gap-1.5 whitespace-nowrap"
      }
    >
      <span
        className={
          home
            ? "font-display text-[1.7rem] leading-none tracking-tight text-teal sm:text-4xl"
            : "font-display text-[clamp(0.88rem,4.2vw,1.25rem)] leading-none tracking-tight"
        }
      >
        Catch Compass
      </span>
      <span aria-hidden="true" className={home ? "text-teal" : "text-ink-muted"}>
        ·
      </span>
      <span
        className={
          home
            ? "font-display text-[0.95rem] leading-none tracking-tight text-teal sm:text-lg"
            : "font-body text-[clamp(0.5625rem,2.3vw,0.6875rem)] font-normal uppercase tracking-wide text-ink-muted"
        }
      >
        Saltwater Logbook
      </span>
    </Tag>
  );
}
