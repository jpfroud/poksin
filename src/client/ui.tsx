import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './icons';
import { appPath } from './paths';

export function Logo() {
  return (
    <a href={appPath('/')} className="brand" aria-label="Poksin, accueil">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
      </span>
      <span>
        poksin<span className="brand-period">.</span>
      </span>
    </a>
  );
}

export function Dialog({
  title,
  subtitle,
  children,
  onClose,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const label = useId();
  const description = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-focus]')?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={label}
      aria-describedby={subtitle ? description : undefined}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <div>
            <h2 id={label}>{title}</h2>
            {subtitle && <p id={description}>{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p className="error-notice" role="alert">
      {message}
    </p>
  ) : null;
}

export function colorStyle(color: string): CSSProperties {
  return { '--tone': /^#[\da-f]{6}$/i.test(color) ? color : '#dfd1ff' } as CSSProperties;
}
