import React from "react";
const cn = (...a) => a.filter(Boolean).join(" ");

export const Avatar = ({ className, children, ...props }) => (
  <div
    className={cn(
      "relative inline-flex overflow-hidden rounded-full bg-gray-100 text-gray-500",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (
  <img ref={ref} className={cn("h-full w-full object-cover", className)} {...props} />
));
AvatarImage.displayName = "AvatarImage";

export const AvatarFallback = ({ className, children, ...props }) => (
  <div
    className={cn(
      "flex h-full w-full items-center justify-center text-gray-500",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
