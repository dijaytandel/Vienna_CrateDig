import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  block?: boolean;
}

export default function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  ...props
}: Props) {
  const classes = [`button-${variant}`, block && 'button-block', className].filter(Boolean);
  return <button type={type} className={classes.join(' ')} {...props} />;
}
