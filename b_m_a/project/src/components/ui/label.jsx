import React from 'react';

export function Label({ className = '', children, ...props }) {
  return (
    <label
      className={`block text-sm font-semibold text-gray-700 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
