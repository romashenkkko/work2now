import { jobCategoryImagePath } from "../lib/jobCategories";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  xs: "h-8 w-8 rounded-lg",
  sm: "h-10 w-10 rounded-xl",
  md: "h-14 w-14 rounded-xl",
  lg: "h-20 w-20 rounded-2xl",
};

type Props = {
  categoryCode: number;
  size?: Size;
  className?: string;
};

/** 3D job category illustration (same assets as onboarding). */
export default function CategoryIllustration({ categoryCode, size = "md", className = "" }: Props) {
  return (
    <img
      src={jobCategoryImagePath(categoryCode)}
      alt=""
      aria-hidden
      loading="lazy"
      className={`shrink-0 object-cover bg-primary/5 ring-1 ring-gray-100 ${SIZE_CLASS[size]} ${className}`}
    />
  );
}
