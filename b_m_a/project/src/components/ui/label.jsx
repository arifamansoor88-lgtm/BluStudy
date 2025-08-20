import React from "react";
const cn = (...a) => a.filter(Boolean).join(" ");

export const Label = ({ className, ...props }) => (
  <label
    className={cn("text-sm font-semibold text-gray-700", className)}
    {...props}
  />
);

