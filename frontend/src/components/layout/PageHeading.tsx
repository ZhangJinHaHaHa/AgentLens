import { cn } from "@/lib/utils";

interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
}

export function PageHeading({
  eyebrow,
  title,
  description,
  className,
  align = "left"
}: PageHeadingProps): JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {eyebrow ? (
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
      ) : null}
      <h1 className="text-display text-3xl sm:text-4xl">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
