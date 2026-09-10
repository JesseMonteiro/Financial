import React from 'react';

export function GlassSurface({
  children,
  variant = 'regular',
  tinted = false,
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  const classes = [
    'liquid-glass',
    `liquid-glass--${variant}`,
    tinted ? 'liquid-glass--tinted' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
