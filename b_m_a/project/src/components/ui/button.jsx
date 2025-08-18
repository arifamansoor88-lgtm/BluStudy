import React from "react";

const cn = (...a) => a.filter(Boolean).join(" ");

const VARIANT = {
  default: "bg-primary-600 text-white hover:bg-primary-700",
  secondary: "bg-gray-900 text-white hover:bg-gray-800",
  outline: "border border-gray-300 bg-white hover:bg-gray-50",
  ghost: "bg-transparent hover:bg-gray-100",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

const SIZE = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          VARIANT[variant],
          SIZE[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

