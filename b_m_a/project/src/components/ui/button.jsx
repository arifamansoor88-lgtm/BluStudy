import React from 'react';

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    default:   'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    outline:   'border border-gray-300 text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    ghost:     'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  const sizes = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const v = variants[variant]   || variants.default;
  const s = sizes[size]         || sizes.md;

  return (
    <button
      className={`${base} ${v} ${s} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
