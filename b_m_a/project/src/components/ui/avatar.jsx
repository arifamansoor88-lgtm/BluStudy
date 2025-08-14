import React from 'react';

export function Avatar({ className = '', children, ...props }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-gray-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function AvatarImage({ src, alt, className = '', ...props }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover w-full h-full ${className}`}
      {...props}
    />
  );
}

export function AvatarFallback({ className = '', children, ...props }) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-200 text-gray-500 w-full h-full ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
