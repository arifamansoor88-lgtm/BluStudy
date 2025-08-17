import React from "react";
const cn = (...a) => a.filter(Boolean).join(" ");

export const Card = ({ className, ...props }) => (
  <div
    className={cn("rounded-lg border border-gray-200 bg-white", className)}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }) => (
  <div className={cn("px-6 pt-6 pb-4", className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn("text-lg font-semibold text-gray-900", className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn("px-6 pb-6", className)} {...props} />
);

export const CardFooter = ({ className, ...props }) => (
  <div className={cn("px-6 pb-6 pt-0", className)} {...props} />
);
