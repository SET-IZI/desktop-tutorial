import { cloneElement, isValidElement } from 'react';

export const inputClass =
  'h-12 w-full rounded-2xl bg-fg/[0.06] px-4 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red/60';

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactElement;
}

/**
 * Champ de formulaire : libellé, aide et erreur reliés au contrôle
 * (aria-describedby, aria-invalid). Le contrôle peut être imbriqué : on
 * cherche l'élément portant l'id.
 */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  const aria = { 'aria-describedby': describedBy || undefined, 'aria-invalid': Boolean(error) };

  const enhance = (node: React.ReactNode): React.ReactNode => {
    if (!isValidElement<{ id?: string; children?: React.ReactNode }>(node)) return node;
    if (node.props.id === id) {
      return cloneElement(node as React.ReactElement<Record<string, unknown>>, aria);
    }
    if (node.props.children === undefined) return node;
    return cloneElement(node, {
      children: Array.isArray(node.props.children)
        ? node.props.children.map(enhance)
        : enhance(node.props.children),
    });
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {enhance(children)}
      {hint ? (
        <p id={`${id}-hint`} className="text-[14px] text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[15px] font-medium text-[#C00011] dark:text-red"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
