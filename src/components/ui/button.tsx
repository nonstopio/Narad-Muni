import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-narada-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]",
        success:
          "bg-narada-emerald text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]",
        danger:
          "bg-narada-rose text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]",
        "warning-soft":
          "bg-amber-500/10 text-narada-amber border border-amber-500/30 hover:bg-amber-500/20",
        "danger-soft":
          "bg-rose-500/10 text-narada-rose border border-rose-500/30 hover:bg-rose-500/20",
        "success-soft":
          "bg-emerald-500/10 text-narada-emerald border border-emerald-500/30 hover:bg-emerald-500/20",
        secondary:
          "bg-white/[0.05] text-narada-text-secondary border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.1] hover:text-narada-text",
        ghost:
          "text-narada-text-secondary hover:bg-white/[0.06] hover:text-narada-text",
        link:
          "text-narada-primary hover:underline underline-offset-4",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-sm",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
