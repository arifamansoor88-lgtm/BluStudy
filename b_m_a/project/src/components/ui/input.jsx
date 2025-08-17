import React from "react";
const cn = (...a) => a.filter(Boolean).join(" ");

export const Input = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
        "text-gray-900 placeholder-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
